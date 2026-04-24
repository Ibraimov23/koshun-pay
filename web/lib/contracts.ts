import { Contract, BrowserProvider } from "ethers";
import { KOSHUNPAY_ABI } from "@/lib/abi/koshunPay";
import { ERC20_ABI } from "@/lib/abi/erc20";
import { KOSHUNPAY_ADDRESS, PYUSDT_ADDRESS } from "@/lib/config";

export function getKoshunPayContractRO(provider: BrowserProvider) {
  return new Contract(KOSHUNPAY_ADDRESS, KOSHUNPAY_ABI, provider);
}

export async function getKoshunPayContractRW(provider: BrowserProvider) {
  const signer = await provider.getSigner();
  return new Contract(KOSHUNPAY_ADDRESS, KOSHUNPAY_ABI, signer);
}

export function getPaymentTokenContractRO(provider: BrowserProvider) {
  return new Contract(PYUSDT_ADDRESS, ERC20_ABI, provider);
}

export async function getPaymentTokenContractRW(provider: BrowserProvider) {
  const signer = await provider.getSigner();
  return new Contract(PYUSDT_ADDRESS, ERC20_ABI, signer);
}
