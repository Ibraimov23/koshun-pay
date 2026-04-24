import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "pill";
};

export function Button({ variant = "primary", className, ...props }: Props) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition active:translate-y-px disabled:pointer-events-none disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "border border-emerald-500/40 bg-emerald-500/90 text-slate-950 hover:bg-emerald-400"
      : variant === "pill"
        ? "rounded-full border border-slate-800 bg-slate-900/60 px-5 py-2 text-slate-100 shadow-sm backdrop-blur hover:bg-slate-900/80"
        : "border border-slate-800 bg-slate-900/40 text-slate-100 backdrop-blur hover:bg-slate-900/70";

  return <button className={[base, styles, className].filter(Boolean).join(" ")} {...props} />;
}
