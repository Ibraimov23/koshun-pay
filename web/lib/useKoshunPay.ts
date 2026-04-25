import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { JsonRpcProvider, formatUnits, MaxUint256, parseUnits } from "ethers";
import { getKoshunPayContractRO, getKoshunPayContractRW, getPaymentTokenContractRO, getPaymentTokenContractRW } from "@/lib/contracts";
import { KOSHUNPAY_ADDRESS, SEPOLIA_CHAIN_ID, SEPOLIA_RPC_URL } from "@/lib/config";
import { useWallet } from "@/lib/useWallet";

export type TokenMeta = { symbol: string; decimals: number };

export type Role = "DISCONNECTED" | "TOURIST" | "GUIDE" | "GOS" | "OWNER";
export type RoleBadge = "Tourist" | "Guide" | "GOS" | "Owner";

export type TourView = {
  id: number;
  guide: string;
  header: string;
  description: string;
  image: string;
  phone: string;
  price: bigint;
  deadline: number;
  seatsTotal: number;
  seatsRemaining: number;
  active: boolean;
};

export type OrderView = {
  id: number;
  tourId: number;
  owner: string;
  guide: string;
  amount: bigint;
  paidAt: number;
  releaseTime: number;
  status: number;
  isProcessed: boolean;
  isDisputed: boolean;
  disputeStatus: number;
};

export type NewTourState = {
  header: string;
  description: string;
  image: string;
  phone: string;
  price: string;
  seatsTotal: string;
};

export function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function orderStatusLabel(v: number) {
  if (v === 1) return "Paid";
  if (v === 2) return "Completed";
  if (v === 3) return "Disputed";
  if (v === 4) return "Refunded";
  return "None";
}

function uniqNums(xs: number[]) {
  return Array.from(new Set(xs));
}

export function useKoshunPay() {
  const { provider, address, chainId, isConnected, connect } = useWallet();
  const networkOk = useMemo(() => chainId === SEPOLIA_CHAIN_ID, [chainId]);

  const roProvider = useMemo(() => {
    return provider ?? new JsonRpcProvider(SEPOLIA_RPC_URL);
  }, [provider]);

  const contractRO = useMemo(() => getKoshunPayContractRO(roProvider), [roProvider]);
  const tokenRO = useMemo(() => getPaymentTokenContractRO(roProvider), [roProvider]);

  const [busy, setBusy] = useState<string | null>(null);
  const [token, setToken] = useState<TokenMeta>({ symbol: "PYUSD", decimals: 6 });

  const [role, setRole] = useState<Role>("DISCONNECTED");
  const [roleBadge, setRoleBadge] = useState<RoleBadge | null>(null);
  const [ownerAddr, setOwnerAddr] = useState<string | null>(null);
  const [gosAddr, setGosAddr] = useState<string | null>(null);
  const [hasLoadedRole, setHasLoadedRole] = useState(false);
  const [isGuideVerified, setIsGuideVerified] = useState(false);
  const [isTouristVerified, setIsTouristVerified] = useState(false);
  const [isGosVerified, setIsGosVerified] = useState(false);
  const [isOwnerVerified, setIsOwnerVerified] = useState(false);

  const [toursById, setToursById] = useState<Record<number, TourView>>({});
  const [hasLoadedTours, setHasLoadedTours] = useState(false);
  const activeTours = useMemo(
    () => Object.values(toursById).filter((t) => t.active).sort((a, b) => b.id - a.id),
    [toursById]
  );

  const [myOrderIds, setMyOrderIds] = useState<number[]>([]);
  const [orders, setOrders] = useState<Record<number, OrderView>>({});
  const [hasLoadedMyOrders, setHasLoadedMyOrders] = useState(false);

  const [guideTourIds, setGuideTourIds] = useState<number[]>([]);
  const [hasLoadedGuideTours, setHasLoadedGuideTours] = useState(false);

  const [balances, setBalances] = useState<{ guide?: string; gos?: string; reserve?: string }>({});
  const [walletBal, setWalletBal] = useState<string | null>(null);

  const loadingRef = useRef({
    meta: false,
    tours: false,
    myOrders: false,
    orders: false,
    guideTours: false,
    balances: false,
    wallet: false
  });

  const refreshTokenMeta = useCallback(async () => {
    if (!tokenRO) return;
    const [symbol, decimals] = await Promise.all([tokenRO.symbol(), tokenRO.decimals()]);
    setToken({ symbol: String(symbol), decimals: Number(decimals) });
  }, [tokenRO]);

  const refreshRole = useCallback(async () => {
    if (!contractRO || !address) return;
    loadingRef.current.meta = true;
    try {
      const [owner, gos, isGuideFlag, touristFlag, guideIds] = await Promise.all([
        contractRO.owner(),
        contractRO.gosAddress(),
        contractRO.isGuide(address),
        contractRO.isTourist(address),
        contractRO.getGuideTourIds(address)
      ]);
      const ownerStr = String(owner);
      const gosStr = String(gos);
      setOwnerAddr(ownerStr);
      setGosAddr(gosStr);

      const guideTourNums = (guideIds as unknown as bigint[]).map((x) => Number(x));
      setGuideTourIds(guideTourNums);

      const lower = address.toLowerCase();
      const isOwner = lower === ownerStr.toLowerCase();
      const isGos = lower === gosStr.toLowerCase();
      const isGuide = Boolean(isGuideFlag) || guideTourNums.length > 0;
      const isTourist = Boolean(touristFlag);
      setIsGuideVerified(isGuide);
      setIsTouristVerified(isTourist);
      setIsGosVerified(isGos);
      setIsOwnerVerified(isOwner);

      const nextRole: Role = isOwner ? "OWNER" : isGos ? "GOS" : isGuide ? "GUIDE" : isTourist ? "TOURIST" : "TOURIST";
      setRole(nextRole);
      setRoleBadge(nextRole === "OWNER" ? "Owner" : nextRole === "GOS" ? "GOS" : nextRole === "GUIDE" ? "Guide" : "Tourist");
      setHasLoadedRole(true);
    } finally {
      loadingRef.current.meta = false;
    }
  }, [contractRO, address]);

  const refreshTours = useCallback(async () => {
    if (!contractRO) return;
    loadingRef.current.tours = true;
    try {
      const count = Number(await contractRO.tourCount());
      if (!count) {
        setToursById({});
        return;
      }
      const ids: number[] = [];
      for (let i = 1; i <= count; i++) ids.push(i);
      const fetched = await Promise.all(
        ids.map(async (id) => {
          const t = await contractRO.getTour(id);
          return {
            id,
            guide: String(t[0]),
            header: String(t[1]),
            description: String(t[2]),
            image: String(t[3]),
            phone: String(t[4]),
            price: BigInt(t[5]),
            deadline: Number(t[6]),
            seatsTotal: Number(t[7]),
            seatsRemaining: Number(t[8]),
            active: Boolean(t[9])
          } satisfies TourView;
        })
      );
      setToursById((prev) => {
        const next = { ...prev };
        for (const t of fetched) next[t.id] = t;
        return next;
      });
    } finally {
      loadingRef.current.tours = false;
      setHasLoadedTours(true);
    }
  }, [contractRO]);

  const refreshMyOrders = useCallback(async () => {
    if (!contractRO || !address) return;
    loadingRef.current.myOrders = true;
    try {
      const ids = (await contractRO.getUserOrderIds(address)) as unknown as bigint[];
      setMyOrderIds(ids.map((x) => Number(x)));
    } finally {
      loadingRef.current.myOrders = false;
      setHasLoadedMyOrders(true);
    }
  }, [contractRO, address]);

  const refreshOrders = useCallback(async () => {
    if (!contractRO) return;
    const ids = uniqNums(myOrderIds).slice(0, 80);
    if (ids.length === 0) return;
    loadingRef.current.orders = true;
    try {
      const fetched = await Promise.all(
        ids.map(async (id) => {
          const o = await contractRO.getOrder(id);
          return {
            id,
            tourId: Number(o[0]),
            owner: String(o[1]),
            guide: String(o[2]),
            amount: BigInt(o[3]),
            paidAt: Number(o[4]),
            releaseTime: Number(o[5]),
            status: Number(o[6]),
            isProcessed: Boolean(o[7]),
            isDisputed: Boolean(o[8]),
            disputeStatus: Number(o[9])
          } satisfies OrderView;
        })
      );
      setOrders((prev) => {
        const next = { ...prev };
        for (const o of fetched) next[o.id] = o;
        return next;
      });
    } finally {
      loadingRef.current.orders = false;
    }
  }, [contractRO, myOrderIds]);

  const refreshGuideTours = useCallback(async () => {
    if (!contractRO || !address) return;
    loadingRef.current.guideTours = true;
    try {
      const ids = (await contractRO.getGuideTourIds(address)) as unknown as bigint[];
      setGuideTourIds(ids.map((x) => Number(x)));
    } finally {
      loadingRef.current.guideTours = false;
      setHasLoadedGuideTours(true);
    }
  }, [contractRO, address]);

  const refreshBalances = useCallback(async () => {
    if (!contractRO || !address) return;
    loadingRef.current.balances = true;
    try {
      const [guideBal, gosBal, reserveBal] = await Promise.all([
        contractRO.guideBalance(address),
        contractRO.gosBalance(),
        contractRO.reserveBalance()
      ]);
      setBalances({
        guide: formatUnits(guideBal as unknown as bigint, token.decimals),
        gos: formatUnits(gosBal as unknown as bigint, token.decimals),
        reserve: formatUnits(reserveBal as unknown as bigint, token.decimals)
      });
    } finally {
      loadingRef.current.balances = false;
    }
  }, [contractRO, address, token.decimals]);

  const refreshWalletBalance = useCallback(async () => {
    if (!tokenRO || !address) {
      setWalletBal(null);
      return;
    }
    loadingRef.current.wallet = true;
    try {
      const bal = (await tokenRO.balanceOf(address)) as unknown as bigint;
      setWalletBal(formatUnits(bal, token.decimals));
    } finally {
      loadingRef.current.wallet = false;
    }
  }, [tokenRO, address, token.decimals]);

  const refreshAll = useCallback(async () => {
    if (!isConnected) return;
    await Promise.all([refreshTokenMeta(), refreshRole()]);
    await Promise.all([refreshTours(), refreshMyOrders(), refreshGuideTours()]);
  }, [isConnected, refreshTokenMeta, refreshRole, refreshTours, refreshMyOrders, refreshGuideTours]);

  useEffect(() => {
    if (!isConnected) {
      setRole("DISCONNECTED");
      setRoleBadge(null);
      setOwnerAddr(null);
      setGosAddr(null);
      setHasLoadedRole(false);
      setIsGuideVerified(false);
      setIsTouristVerified(false);
      setIsGosVerified(false);
      setIsOwnerVerified(false);
      setMyOrderIds([]);
      setOrders({});
      setHasLoadedMyOrders(false);
      setGuideTourIds([]);
      setHasLoadedGuideTours(false);
      setBalances({});
      setWalletBal(null);
      return;
    }
    void refreshAll();
  }, [isConnected, refreshAll]);

  useEffect(() => {
    void refreshTokenMeta();
    void refreshTours();
  }, [roProvider, refreshTokenMeta, refreshTours]);

  useEffect(() => {
    if (!isConnected) return;
    void refreshOrders();
  }, [isConnected, refreshOrders]);

  useEffect(() => {
    if (!isConnected) return;
    void refreshBalances();
    void refreshWalletBalance();
  }, [isConnected, refreshBalances, refreshWalletBalance, orders, toursById]);

  const payForTour = useCallback(
    async (tourId: number) => {
      if (!provider || !tokenRO || !address) return;
      setBusy(`pay:${tourId}`);
      try {
        const tour = toursById[tourId];
        if (!tour) return;
        const tokenRW = await getPaymentTokenContractRW(provider);
        const contractRW = await getKoshunPayContractRW(provider);
        const allowance = (await tokenRO.allowance(address, KOSHUNPAY_ADDRESS)) as unknown as bigint;
        if (allowance < tour.price) {
          const txA = await tokenRW.approve(KOSHUNPAY_ADDRESS, MaxUint256);
          await txA.wait();
        }
        const tx = await contractRW.pay(tourId);
        await tx.wait();
        await Promise.all([refreshMyOrders(), refreshOrders(), refreshTours(), refreshWalletBalance()]);
      } finally {
        setBusy(null);
      }
    },
    [provider, tokenRO, address, toursById, refreshMyOrders, refreshOrders, refreshTours, refreshWalletBalance]
  );

  const createTour = useCallback(
    async (newTour: NewTourState) => {
      if (!provider) return;
      setBusy("createTour");
      try {
        const contractRW = await getKoshunPayContractRW(provider);
        const priceWei = parseUnits(newTour.price || "0", token.decimals);
        const seats = Number(newTour.seatsTotal || "0");
        const tx = await contractRW.createTour(
          newTour.header,
          newTour.description,
          newTour.image,
          newTour.phone,
          priceWei,
          seats
        );
        await tx.wait();
        await Promise.all([refreshTours(), refreshRole(), refreshGuideTours()]);
      } finally {
        setBusy(null);
      }
    },
    [provider, token.decimals, refreshTours, refreshRole, refreshGuideTours]
  );

  const withdrawGuide = useCallback(async () => {
    if (!provider) return;
    setBusy("withdrawGuide");
    try {
      const contractRW = await getKoshunPayContractRW(provider);
      const tx = await contractRW.withdrawGuide();
      await tx.wait();
      await Promise.all([refreshBalances(), refreshWalletBalance()]);
    } finally {
      setBusy(null);
    }
  }, [provider, refreshBalances, refreshWalletBalance]);

  const withdrawGos = useCallback(async () => {
    if (!provider) return;
    setBusy("withdrawGos");
    try {
      const contractRW = await getKoshunPayContractRW(provider);
      const tx = await contractRW.withdrawGos();
      await tx.wait();
      await Promise.all([refreshBalances(), refreshWalletBalance()]);
    } finally {
      setBusy(null);
    }
  }, [provider, refreshBalances, refreshWalletBalance]);

  const withdrawReserve = useCallback(async () => {
    if (!provider) return;
    setBusy("withdrawReserve");
    try {
      const contractRW = await getKoshunPayContractRW(provider);
      const tx = await contractRW.withdrawReserve();
      await tx.wait();
      await Promise.all([refreshBalances(), refreshWalletBalance()]);
    } finally {
      setBusy(null);
    }
  }, [provider, refreshBalances, refreshWalletBalance]);

  const transferBooking = useCallback(
    async (orderId: number, newOwner: string) => {
      if (!provider) return;
      setBusy(`transfer:${orderId}`);
      try {
        const contractRW = await getKoshunPayContractRW(provider);
        const tx = await contractRW.transferBooking(orderId, newOwner);
        await tx.wait();
        await Promise.all([refreshMyOrders(), refreshOrders()]);
      } finally {
        setBusy(null);
      }
    },
    [provider, refreshMyOrders, refreshOrders]
  );

  const confirmPayment = useCallback(
    async (orderId: number) => {
      if (!provider) return;
      setBusy(`confirm:${orderId}`);
      try {
        const contractRW = await getKoshunPayContractRW(provider);
        const tx = await contractRW.confirmPayment(orderId);
        await tx.wait();
        await Promise.all([refreshMyOrders(), refreshOrders(), refreshTours(), refreshBalances()]);
      } finally {
        setBusy(null);
      }
    },
    [provider, refreshMyOrders, refreshOrders, refreshTours, refreshBalances]
  );

  const openDispute = useCallback(
    async (orderId: number) => {
      if (!provider) return;
      setBusy(`dispute:${orderId}`);
      try {
        const contractRW = await getKoshunPayContractRW(provider);
        const tx = await contractRW.openDispute(orderId);
        await tx.wait();
        await Promise.all([refreshMyOrders(), refreshOrders()]);
      } finally {
        setBusy(null);
      }
    },
    [provider, refreshMyOrders, refreshOrders]
  );

  const refund = useCallback(
    async (orderId: number) => {
      if (!provider) return;
      setBusy(`refund:${orderId}`);
      try {
        const contractRW = await getKoshunPayContractRW(provider);
        const tx = await contractRW.refund(orderId);
        await tx.wait();
        await Promise.all([refreshMyOrders(), refreshOrders(), refreshTours(), refreshWalletBalance()]);
      } finally {
        setBusy(null);
      }
    },
    [provider, refreshMyOrders, refreshOrders, refreshTours, refreshWalletBalance]
  );

  return {
    provider,
    address,
    chainId,
    isConnected,
    connect,
    networkOk,
    busy,

    token,
    walletBal,

    role,
    roleBadge,
    hasLoadedRole,
    isGuideVerified,
    isTouristVerified,
    isGosVerified,
    isOwnerVerified,
    gosAddr,
    ownerAddr,

    toursById,
    activeTours,
    hasLoadedTours,
    myOrderIds,
    orders,
    hasLoadedMyOrders,
    guideTourIds,
    hasLoadedGuideTours,

    balances,

    refreshAll,
    refreshTours,
    refreshMyOrders,
    refreshOrders,
    refreshGuideTours,
    refreshBalances,

    payForTour,
    createTour,
    withdrawGuide,
    withdrawGos,
    withdrawReserve,
    transferBooking,
    confirmPayment,
    openDispute,
    refund,

    contracts: {
      KOSHUNPAY_ADDRESS
    }
  };
}
