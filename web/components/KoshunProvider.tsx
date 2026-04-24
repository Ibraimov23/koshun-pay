"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useKoshunPay } from "@/lib/useKoshunPay";

const Ctx = createContext<ReturnType<typeof useKoshunPay> | null>(null);

export function useKoshun() {
  const v = useContext(Ctx);
  if (!v) throw new Error("KoshunProvider missing");
  return v;
}

export function KoshunProvider({ children }: { children: ReactNode }) {
  const v = useKoshunPay();
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}
