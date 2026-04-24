"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits, MaxUint256, parseUnits } from "ethers";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import {
  getKoshunPayContractRO,
  getKoshunPayContractRW,
  getPaymentTokenContractRO,
  getPaymentTokenContractRW
} from "@/lib/contracts";
import { SEPOLIA_CHAIN_ID, KOSHUNPAY_ADDRESS } from "@/lib/config";
import { useWallet } from "@/lib/useWallet";

type TokenMeta = { symbol: string; decimals: number };

type TourView = {
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

type OrderView = {
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

type Role = "DISCONNECTED" | "TOURIST" | "GUIDE" | "GOS" | "OWNER";

type NewTourState = {
  header: string;
  description: string;
  image: string;
  phone: string;
  price: string;
  seatsTotal: string;
};

type TransferState = { orderId: string; newOwner: string };
type AdminState = { orderId: string; approve: boolean; maxCount: string };

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function orderStatusLabel(v: number) {
  if (v === 1) return "PAID";
  if (v === 2) return "COMPLETED";
  if (v === 3) return "DISPUTED";
  if (v === 4) return "REFUNDED";
  return "NONE";
}

function disputeStatusLabel(v: number) {
  if (v === 1) return "PENDING";
  if (v === 2) return "APPROVED";
  if (v === 3) return "REJECTED";
  return "NONE";
}

export default function Page() {
  const { provider, address, chainId, isConnected, connect } = useWallet();
  const [token, setToken] = useState<TokenMeta>({ symbol: "USDT", decimals: 6 });
  const [role, setRole] = useState<Role>("DISCONNECTED");
  const [ownerAddr, setOwnerAddr] = useState<string | null>(null);
  const [gosAddr, setGosAddr] = useState<string | null>(null);

  const [tours, setTours] = useState<TourView[]>([]);
  const [myOrderIds, setMyOrderIds] = useState<number[]>([]);
  const [orders, setOrders] = useState<Record<number, OrderView>>({});
  const [pendingOrderIds, setPendingOrderIds] = useState<number[]>([]);

  const [busy, setBusy] = useState<string | null>(null);

  const [newTour, setNewTour] = useState<NewTourState>({
    header: "",
    description: "",
    image: "",
    phone: "",
    price: "",
    seatsTotal: "1"
  });

  const [transfer, setTransfer] = useState<TransferState>({ orderId: "", newOwner: "" });
  const [admin, setAdmin] = useState<AdminState>({ orderId: "", approve: true, maxCount: "25" });

  const networkOk = useMemo(() => chainId === SEPOLIA_CHAIN_ID, [chainId]);

  const contractRO = useMemo(() => {
    if (!provider) return null;
    return getKoshunPayContractRO(provider);
  }, [provider]);

  const tokenRO = useMemo(() => {
    if (!provider) return null;
    return getPaymentTokenContractRO(provider);
  }, [provider]);

  const refreshMeta = useCallback(async () => {
    if (!contractRO || !tokenRO || !address) return;
    const [owner, gos, isGuide] = await Promise.all([
      contractRO.owner(),
      contractRO.gosAddress(),
      contractRO.isGuide(address)
    ]);
    setOwnerAddr(owner);
    setGosAddr(gos);

    const roleNext: Role =
      address.toLowerCase() === String(owner).toLowerCase()
        ? "OWNER"
        : address.toLowerCase() === String(gos).toLowerCase()
          ? "GOS"
          : Boolean(isGuide)
            ? "GUIDE"
            : "TOURIST";
    setRole(roleNext);

    const [symbol, decimals] = await Promise.all([tokenRO.symbol(), tokenRO.decimals()]);
    setToken({ symbol, decimals: Number(decimals) });
  }, [contractRO, tokenRO, address]);

  const refreshTours = useCallback(async () => {
    if (!contractRO) return;
    const count = Number(await contractRO.tourCount());
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
    setTours(fetched.filter((x) => x.active));
  }, [contractRO]);

  const refreshMyOrders = useCallback(async () => {
    if (!contractRO || !address) return;
    const ids = (await contractRO.getUserOrderIds(address)) as unknown as bigint[];
    const orderIds = ids.map((x) => Number(x));
    setMyOrderIds(orderIds);
  }, [contractRO, address]);

  const refreshPendingOrders = useCallback(async () => {
    if (!contractRO) return;
    const ids = (await contractRO.getPendingOrderIds()) as unknown as bigint[];
    setPendingOrderIds(ids.map((x) => Number(x)));
  }, [contractRO]);

  const refreshOrders = useCallback(async () => {
    if (!contractRO) return;
    const ids = role === "OWNER" ? pendingOrderIds : myOrderIds;
    if (ids.length === 0) return;
    const unique: number[] = Array.from(new Set<number>(ids)).slice(0, 50);
    const fetched: OrderView[] = await Promise.all(
      unique.map(async (id: number) => {
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
    setOrders((prev: Record<number, OrderView>) => {
      const next = { ...prev };
      for (const o of fetched) next[o.id] = o;
      return next;
    });
  }, [contractRO, myOrderIds, pendingOrderIds, role]);

  useEffect(() => {
    if (!isConnected) {
      setRole("DISCONNECTED");
      setTours([]);
      setMyOrderIds([]);
      setOrders({});
      setPendingOrderIds([]);
      return;
    }
    void refreshMeta();
  }, [isConnected, refreshMeta]);

  useEffect(() => {
    if (!isConnected) return;
    void refreshTours();
    void refreshMyOrders();
    void refreshPendingOrders();
  }, [isConnected, refreshTours, refreshMyOrders, refreshPendingOrders]);

  useEffect(() => {
    if (!isConnected) return;
    void refreshOrders();
  }, [isConnected, refreshOrders]);

  const payForTour = useCallback(
    async (tourId: number) => {
      if (!provider || !tokenRO || !address) return;
      setBusy(`pay:${tourId}`);
      try {
        const tour = tours.find((t: TourView) => t.id === tourId);
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
        await refreshMyOrders();
        await refreshPendingOrders();
        await refreshOrders();
      } finally {
        setBusy(null);
      }
    },
    [provider, tokenRO, address, tours, refreshMyOrders, refreshPendingOrders, refreshOrders]
  );

  const confirmPayment = useCallback(
    async (orderId: number) => {
      if (!provider) return;
      setBusy(`confirm:${orderId}`);
      try {
        const contractRW = await getKoshunPayContractRW(provider);
        const tx = await contractRW.confirmPayment(orderId);
        await tx.wait();
        await refreshMyOrders();
        await refreshPendingOrders();
        await refreshOrders();
      } finally {
        setBusy(null);
      }
    },
    [provider, refreshMyOrders, refreshPendingOrders, refreshOrders]
  );

  const openDispute = useCallback(
    async (orderId: number) => {
      if (!provider) return;
      setBusy(`dispute:${orderId}`);
      try {
        const contractRW = await getKoshunPayContractRW(provider);
        const tx = await contractRW.openDispute(orderId);
        await tx.wait();
        await refreshOrders();
      } finally {
        setBusy(null);
      }
    },
    [provider, refreshOrders]
  );

  const refund = useCallback(
    async (orderId: number) => {
      if (!provider) return;
      setBusy(`refund:${orderId}`);
      try {
        const contractRW = await getKoshunPayContractRW(provider);
        const tx = await contractRW.refund(orderId);
        await tx.wait();
        await refreshOrders();
      } finally {
        setBusy(null);
      }
    },
    [provider, refreshOrders]
  );

  const withdrawGuide = useCallback(async () => {
    if (!provider) return;
    setBusy("withdrawGuide");
    try {
      const contractRW = await getKoshunPayContractRW(provider);
      const tx = await contractRW.withdrawGuide();
      await tx.wait();
    } finally {
      setBusy(null);
    }
  }, [provider]);

  const withdrawGos = useCallback(async () => {
    if (!provider) return;
    setBusy("withdrawGos");
    try {
      const contractRW = await getKoshunPayContractRW(provider);
      const tx = await contractRW.withdrawGos();
      await tx.wait();
    } finally {
      setBusy(null);
    }
  }, [provider]);

  const withdrawReserve = useCallback(async () => {
    if (!provider) return;
    setBusy("withdrawReserve");
    try {
      const contractRW = await getKoshunPayContractRW(provider);
      const tx = await contractRW.withdrawReserve();
      await tx.wait();
    } finally {
      setBusy(null);
    }
  }, [provider]);

  const createTour = useCallback(async () => {
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
      setNewTour({ header: "", description: "", image: "", phone: "", price: "", seatsTotal: "1" });
      await refreshTours();
      await refreshMeta();
    } finally {
      setBusy(null);
    }
  }, [provider, newTour, token.decimals, refreshTours, refreshMeta]);

  const transferBooking = useCallback(async () => {
    if (!provider) return;
    const orderId = Number(transfer.orderId || "0");
    if (!orderId || !transfer.newOwner) return;
    setBusy("transferBooking");
    try {
      const contractRW = await getKoshunPayContractRW(provider);
      const tx = await contractRW.transferBooking(orderId, transfer.newOwner);
      await tx.wait();
      setTransfer({ orderId: "", newOwner: "" });
      await refreshOrders();
      await refreshMyOrders();
    } finally {
      setBusy(null);
    }
  }, [provider, transfer, refreshOrders, refreshMyOrders]);

  const confirmAll = useCallback(async () => {
    if (!provider) return;
    setBusy("confirmAll");
    try {
      const contractRW = await getKoshunPayContractRW(provider);
      const maxCount = Number(admin.maxCount || "0");
      const tx = await contractRW.confirmAll(maxCount);
      await tx.wait();
      await refreshPendingOrders();
      await refreshOrders();
    } finally {
      setBusy(null);
    }
  }, [provider, admin.maxCount, refreshPendingOrders, refreshOrders]);

  const resolveDispute = useCallback(async () => {
    if (!provider) return;
    const orderId = Number(admin.orderId || "0");
    if (!orderId) return;
    setBusy("resolveDispute");
    try {
      const contractRW = await getKoshunPayContractRW(provider);
      const tx = await contractRW.resolveDispute(orderId, Boolean(admin.approve));
      await tx.wait();
      setAdmin((p: AdminState) => ({ ...p, orderId: "" }));
      await refreshOrders();
      await refreshPendingOrders();
    } finally {
      setBusy(null);
    }
  }, [provider, admin.orderId, admin.approve, refreshOrders, refreshPendingOrders]);

  const balances = useMemo(() => {
    const guideBal = role === "GUIDE" && contractRO && address ? contractRO.guideBalance(address) : null;
    const gosBal = role === "GOS" && contractRO ? contractRO.gosBalance() : null;
    const reserveBal = role === "OWNER" && contractRO ? contractRO.reserveBalance() : null;
    return { guideBal, gosBal, reserveBal };
  }, [role, contractRO, address]);

  const [balanceView, setBalanceView] = useState<{ guide?: string; gos?: string; reserve?: string }>({});

  useEffect(() => {
    if (!contractRO) return;
    let cancelled = false;
    const run = async () => {
      const guideBal = balances.guideBal ? await balances.guideBal : null;
      const gosBal = balances.gosBal ? await balances.gosBal : null;
      const reserveBal = balances.reserveBal ? await balances.reserveBal : null;
      if (cancelled) return;
      setBalanceView({
        guide: guideBal != null ? formatUnits(guideBal as unknown as bigint, token.decimals) : undefined,
        gos: gosBal != null ? formatUnits(gosBal as unknown as bigint, token.decimals) : undefined,
        reserve: reserveBal != null ? formatUnits(reserveBal as unknown as bigint, token.decimals) : undefined
      });
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [balances, contractRO, token.decimals, orders]);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold text-slate-900">Koshun Pay</div>
          <div className="mt-1 text-sm text-slate-600">
            Contract: <span className="font-mono">{shortAddr(KOSHUNPAY_ADDRESS)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {isConnected && address ? (
            <div className="text-right text-sm">
              <div className="font-mono text-slate-900">{shortAddr(address)}</div>
              <div className="text-slate-600">
                Role: <span className="font-medium text-accent-700">{role}</span>
              </div>
              <div className="text-slate-600">
                Network:{" "}
                <span className={networkOk ? "text-accent-700" : "text-red-600"}>
                  {chainId ?? "—"} {networkOk ? "" : "(switch to Sepolia)"}
                </span>
              </div>
            </div>
          ) : null}
          <Button onClick={connect} disabled={busy != null}>
            {isConnected ? "Подключено" : "Подключить кошелек"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Активные туры">
          {tours.length === 0 ? <div className="text-sm text-slate-600">Нет активных туров</div> : null}
          {tours.map((t: TourView) => (
            <div key={t.id} className="rounded-xl border border-slate-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    #{t.id} {t.header}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{t.description}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    Guide: <span className="font-mono">{shortAddr(t.guide)}</span> · Seats: {t.seatsRemaining}/
                    {t.seatsTotal}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900">
                    {formatUnits(t.price, token.decimals)} {token.symbol}
                  </div>
                  <Button
                    className="mt-3"
                    onClick={() => payForTour(t.id)}
                    disabled={!isConnected || role !== "TOURIST" || !networkOk || busy === `pay:${t.id}`}
                  >
                    Оплатить
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </Card>

        <Card title="Добавить тур">
          <div className="grid grid-cols-1 gap-3">
            <Input
              placeholder="Заголовок"
              value={newTour.header}
              onChange={(e: any) => setNewTour((p: NewTourState) => ({ ...p, header: e.target.value }))}
            />
            <Textarea
              placeholder="Описание"
              value={newTour.description}
              onChange={(e: any) => setNewTour((p: NewTourState) => ({ ...p, description: e.target.value }))}
            />
            <Input
              placeholder="Ссылка на картинку"
              value={newTour.image}
              onChange={(e: any) => setNewTour((p: NewTourState) => ({ ...p, image: e.target.value }))}
            />
            <Input
              placeholder="Телефон"
              value={newTour.phone}
              onChange={(e: any) => setNewTour((p: NewTourState) => ({ ...p, phone: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder={`Цена (${token.symbol})`}
                inputMode="decimal"
                value={newTour.price}
                onChange={(e: any) => setNewTour((p: NewTourState) => ({ ...p, price: e.target.value }))}
              />
              <Input
                placeholder="Мест"
                inputMode="numeric"
                value={newTour.seatsTotal}
                onChange={(e: any) => setNewTour((p: NewTourState) => ({ ...p, seatsTotal: e.target.value }))}
              />
            </div>
            <Button onClick={createTour} disabled={!isConnected || !networkOk || busy === "createTour"}>
              Создать тур
            </Button>
          </div>
          <div className="text-xs text-slate-500">
            Создатель тура автоматически становится гидом. Дедлайн тура задаётся контрактом: now + 72h.
          </div>
        </Card>

        <Card title="Мои заказы">
          {!isConnected ? <div className="text-sm text-slate-600">Подключи кошелёк</div> : null}
          {isConnected && myOrderIds.length === 0 ? (
            <div className="text-sm text-slate-600">Заказов нет</div>
          ) : null}
          {myOrderIds
            .slice()
            .sort((a: number, b: number) => b - a)
            .slice(0, 20)
            .map((id: number) => {
              const o = orders[id];
              if (!o) return null;
              const canConfirm = o.status === 1 && !o.isProcessed && !o.isDisputed && o.disputeStatus === 0;
              const canDispute = o.status === 1 && !o.isProcessed && o.disputeStatus === 0;
              const canRefund = o.status === 3 && !o.isProcessed && o.disputeStatus === 2;
              const now = Math.floor(Date.now() / 1000);
              const releaseIn = o.releaseTime - now;

              return (
                <div key={id} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Order #{id}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Tour #{o.tourId} · Status {orderStatusLabel(o.status)} · Dispute{" "}
                        {disputeStatusLabel(o.disputeStatus)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Release:{" "}
                        {releaseIn > 0 ? `${Math.ceil(releaseIn / 60)} min` : "ready"} · Guide{" "}
                        <span className="font-mono">{shortAddr(o.guide)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-900">
                        {formatUnits(o.amount, token.decimals)} {token.symbol}
                      </div>
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => openDispute(id)}
                          disabled={!networkOk || busy === `dispute:${id}` || !canDispute}
                        >
                          Спор
                        </Button>
                        <Button
                          onClick={() => confirmPayment(id)}
                          disabled={!networkOk || busy === `confirm:${id}` || !canConfirm || releaseIn > 0}
                        >
                          Подтвердить
                        </Button>
                        <Button variant="ghost" onClick={() => refund(id)} disabled={!networkOk || !canRefund}>
                          Refund
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </Card>

        <Card title="Передача бронирования (только COMPLETED)">
          <div className="grid grid-cols-1 gap-3">
            <Input
              placeholder="OrderId"
              inputMode="numeric"
              value={transfer.orderId}
              onChange={(e: any) => setTransfer((p: TransferState) => ({ ...p, orderId: e.target.value }))}
            />
            <Input
              placeholder="Новый адрес"
              value={transfer.newOwner}
              onChange={(e: any) => setTransfer((p: TransferState) => ({ ...p, newOwner: e.target.value }))}
            />
            <Button onClick={transferBooking} disabled={!isConnected || !networkOk || busy === "transferBooking"}>
              Передать
            </Button>
          </div>
        </Card>

        <Card title="Баланс и вывод">
          {role === "GUIDE" ? (
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-700">
                Guide balance:{" "}
                <span className="font-semibold text-slate-900">
                  {balanceView.guide ?? "—"} {token.symbol}
                </span>
              </div>
              <Button onClick={withdrawGuide} disabled={!networkOk || busy === "withdrawGuide"}>
                Withdraw
              </Button>
            </div>
          ) : null}
          {role === "GOS" ? (
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-700">
                Gos balance:{" "}
                <span className="font-semibold text-slate-900">
                  {balanceView.gos ?? "—"} {token.symbol}
                </span>
              </div>
              <Button onClick={withdrawGos} disabled={!networkOk || busy === "withdrawGos"}>
                Withdraw
              </Button>
            </div>
          ) : null}
          {role === "OWNER" ? (
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-700">
                Reserve (5%):{" "}
                <span className="font-semibold text-slate-900">
                  {balanceView.reserve ?? "—"} {token.symbol}
                </span>
              </div>
              <Button onClick={withdrawReserve} disabled={!networkOk || busy === "withdrawReserve"}>
                Withdraw
              </Button>
            </div>
          ) : null}
          {role !== "GUIDE" && role !== "GOS" && role !== "OWNER" ? (
            <div className="text-sm text-slate-600">Вывод доступен только гиду/госу/owner</div>
          ) : null}
        </Card>

        {role === "OWNER" ? (
          <Card title="Админ панель (owner)">
            <div className="text-sm text-slate-600">
              Owner: <span className="font-mono">{ownerAddr ? shortAddr(ownerAddr) : "—"}</span> · Gos:{" "}
              <span className="font-mono">{gosAddr ? shortAddr(gosAddr) : "—"}</span>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-3">
              <div className="flex items-center gap-3">
                <Input
                  placeholder="maxCount"
                  inputMode="numeric"
                  value={admin.maxCount}
                  onChange={(e: any) => setAdmin((p: AdminState) => ({ ...p, maxCount: e.target.value }))}
                />
                <Button onClick={confirmAll} disabled={!networkOk || busy === "confirmAll"}>
                  confirmAll
                </Button>
              </div>
              <div className="text-xs text-slate-500">Pending orders: {pendingOrderIds.length}</div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <Input
                placeholder="orderId для resolveDispute"
                inputMode="numeric"
                value={admin.orderId}
                onChange={(e: any) => setAdmin((p: AdminState) => ({ ...p, orderId: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button
                  variant={admin.approve ? "primary" : "ghost"}
                  onClick={() => setAdmin((p: AdminState) => ({ ...p, approve: true }))}
                >
                  APPROVE
                </Button>
                <Button
                  variant={!admin.approve ? "primary" : "ghost"}
                  onClick={() => setAdmin((p: AdminState) => ({ ...p, approve: false }))}
                >
                  REJECT
                </Button>
                <Button onClick={resolveDispute} disabled={!networkOk || busy === "resolveDispute"}>
                  resolve
                </Button>
              </div>
            </div>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
