"use client";

import { Button } from "@/components/Button";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { useKoshun } from "@/components/KoshunProvider";
import { useToast } from "@/components/ToastProvider";
import { shortAddr } from "@/lib/useKoshunPay";

export function GosDashboard() {
  const { push } = useToast();
  const { balances, token, withdrawGos, busy, gosAddr, networkOk, isGosVerified } = useKoshun();

  const taxes = Number(balances.gos ?? "0");

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xl font-semibold text-slate-100">Treasury</div>
          <div className="mt-1 text-sm text-slate-400">Taxes in Real Time</div>
        </div>
        <div className="hidden rounded-full border border-slate-800 bg-slate-950/30 px-4 py-2 text-sm text-slate-200 md:block">
          Beneficiary <span className="font-mono text-slate-300">{gosAddr ? shortAddr(gosAddr) : "—"}</span>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 shadow-[0_0_0_1px_rgba(15,23,42,0.6),0_24px_60px_rgba(2,6,23,0.75)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-100">Taxes in Real Time</div>
          <div className="inline-flex items-center gap-2 text-xs text-slate-400">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Live
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="text-5xl font-semibold tracking-tight text-slate-100 md:text-6xl">
            <AnimatedNumber value={taxes} decimals={2} />
          </div>
          <div className="pb-2 text-sm text-slate-400">{token.symbol}</div>
        </div>

        <div className="mt-6">
          <Button
            className="w-full rounded-full"
            onClick={async () => {
              try {
                await withdrawGos();
                push({ title: "Withdrawn", description: "Transferred to budget wallet.", kind: "success" });
              } catch {
                push({ title: "Withdraw failed", description: "Please confirm in wallet.", kind: "error" });
              }
            }}
            disabled={!networkOk || busy === "withdrawGos" || !isGosVerified || taxes <= 0}
          >
            Withdraw to Budget
          </Button>
        </div>
      </div>
    </div>
  );
}

