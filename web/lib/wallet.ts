import { BrowserProvider } from "ethers";

export type WalletState = {
  provider: BrowserProvider | null;
  address: string | null;
  chainId: number | null;
};

export function getEthereum(): any {
  return typeof window !== "undefined" ? (window as any).ethereum : undefined;
}

export async function connectWallet(): Promise<WalletState> {
  const ethereum = getEthereum();
  if (!ethereum) {
    return { provider: null, address: null, chainId: null };
  }

  await ethereum.request({ method: "eth_requestAccounts" });
  const provider = new BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const network = await provider.getNetwork();
  return { provider, address, chainId: Number(network.chainId) };
}

export async function getWalletState(): Promise<WalletState> {
  const ethereum = getEthereum();
  if (!ethereum) {
    return { provider: null, address: null, chainId: null };
  }

  const accounts: string[] = await ethereum.request({ method: "eth_accounts" });
  if (!accounts || accounts.length === 0) {
    return { provider: null, address: null, chainId: null };
  }

  const provider = new BrowserProvider(ethereum);
  const network = await provider.getNetwork();
  return { provider, address: accounts[0] ?? null, chainId: Number(network.chainId) };
}
