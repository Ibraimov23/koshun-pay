import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: Props) {
  return (
    <input
      className={[
        "w-full rounded-2xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/15",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
