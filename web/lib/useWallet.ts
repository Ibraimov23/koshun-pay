import { useCallback, useEffect, useMemo, useState } from "react";
import { getEthereum, getWalletState, connectWallet, type WalletState } from "@/lib/wallet";

export function useWallet() {
  const [state, setState] = useState<WalletState>({ provider: null, address: null, chainId: null });
  const isConnected = useMemo(() => Boolean(state.provider && state.address && state.chainId), [state]);

  const refresh = useCallback(async () => {
    const next = await getWalletState();
    setState(next);
  }, []);

  const connect = useCallback(async () => {
    const next = await connectWallet();
    setState(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    const onAccountsChanged = () => {
      void refresh();
    };
    const onChainChanged = () => {
      void refresh();
    };

    ethereum.on?.("accountsChanged", onAccountsChanged);
    ethereum.on?.("chainChanged", onChainChanged);

    return () => {
      ethereum.removeListener?.("accountsChanged", onAccountsChanged);
      ethereum.removeListener?.("chainChanged", onChainChanged);
    };
  }, [refresh]);

  return { ...state, isConnected, connect, refresh };
}
