import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export function Button({ variant = "primary", className, ...props }: Props) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition active:translate-y-px disabled:opacity-50 disabled:pointer-events-none";
  const styles =
    variant === "primary"
      ? "bg-accent-600 text-white hover:bg-accent-700"
      : "bg-white text-slate-900 hover:bg-slate-50 border border-slate-200";

  return <button className={[base, styles, className].filter(Boolean).join(" ")} {...props} />;
}
