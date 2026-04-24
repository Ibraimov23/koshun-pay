import type { ReactNode } from "react";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.6),0_12px_30px_rgba(2,6,23,0.6)] backdrop-blur">
      {title ? <div className="mb-4 text-sm font-semibold text-slate-100">{title}</div> : null}
      <div className="space-y-3">{children}</div>
    </div>
  );
}
