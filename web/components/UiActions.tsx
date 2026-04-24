"use client";

import { createContext, useContext, type ReactNode } from "react";

type UiActions = {
  openCooperation: () => void;
  openCreateTour: () => void;
};

const Ctx = createContext<UiActions | null>(null);

export function UiActionsProvider({ value, children }: { value: UiActions; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUiActions() {
  const v = useContext(Ctx);
  if (!v) throw new Error("UiActionsProvider missing");
  return v;
}
