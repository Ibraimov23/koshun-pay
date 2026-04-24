import type { TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: Props) {
  return (
    <textarea
      className={[
        "w-full min-h-24 resize-y rounded-2xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/15",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
