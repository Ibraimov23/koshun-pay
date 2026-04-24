import type { TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: Props) {
  return (
    <textarea
      className={[
        "w-full min-h-24 resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent-500",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
