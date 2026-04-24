"use client";

import type { ReactNode } from "react";

export function Modal({
  open,
  title,
  children,
  onClose
}: {
  open: boolean;
  title?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4 py-8">
      <button className="absolute inset-0 bg-slate-950/70 backdrop-blur" onClick={onClose} aria-label="Close modal" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 shadow-[0_0_0_1px_rgba(15,23,42,0.7),0_24px_60px_rgba(2,6,23,0.75)] backdrop-blur">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div className="text-sm font-semibold text-slate-100">{title ?? ""}</div>
          <button
            className="rounded-full border border-slate-800 bg-slate-950/30 px-3 py-1 text-xs text-slate-200 hover:bg-slate-950/50"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

