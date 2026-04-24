"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Toast = { id: string; title: string; description?: string; kind?: "success" | "error" | "info" };

const ToastCtx = createContext<{ push: (t: Omit<Toast, "id">) => void } | null>(null);

export function useToast() {
  const v = useContext(ToastCtx);
  if (!v) throw new Error("ToastProvider missing");
  return v;
}

function ToastView({ t, onClose }: { t: Toast; onClose: () => void }) {
  const tone =
    t.kind === "success"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
      : t.kind === "error"
        ? "border-red-400/30 bg-red-400/10 text-red-100"
        : "border-slate-700 bg-slate-900/60 text-slate-100";
  return (
    <div className={["w-[22rem] rounded-3xl border px-4 py-3 shadow-lg backdrop-blur", tone].join(" ")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{t.title}</div>
          {t.description ? <div className="mt-1 text-xs text-slate-300">{t.description}</div> : null}
        </div>
        <button
          className="rounded-full border border-slate-700 bg-slate-950/30 px-2 py-0.5 text-xs text-slate-200 hover:bg-slate-950/50"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { ...t, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 3200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastView key={t.id} t={t} onClose={() => setToasts((p) => p.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

