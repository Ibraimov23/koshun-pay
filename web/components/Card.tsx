import type { ReactNode } from "react";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {title ? <div className="mb-4 text-sm font-semibold text-slate-900">{title}</div> : null}
      <div className="space-y-3">{children}</div>
    </div>
  );
}
