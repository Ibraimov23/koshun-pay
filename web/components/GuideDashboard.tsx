"use client";

import { useMemo } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { useKoshun } from "@/components/KoshunProvider";
import { useToast } from "@/components/ToastProvider";
import { useUiActions } from "@/components/UiActions";

export function GuideDashboard() {
  const { push } = useToast();
  const { openCreateTour } = useUiActions();
  const { guideTourIds, toursById, balances, token, withdrawGuide, busy, isGuideVerified, networkOk } = useKoshun();

  const myTours = useMemo(() => {
    return guideTourIds
      .slice()
      .sort((a, b) => b - a)
      .map((id) => toursById[id])
      .filter(Boolean);
  }, [guideTourIds, toursById]);

  const earnings = Number(balances.guide ?? "0");

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xl font-semibold text-slate-100">Dashboard</div>
          <div className="mt-1 text-sm text-slate-400">Host tours. Track bookings. Withdraw earnings.</div>
        </div>
        <Button
          onClick={openCreateTour}
          disabled={!networkOk}
          className="rounded-full"
        >
          + Add Tour
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="My Tours">
            {myTours.length === 0 ? (
              <div className="text-sm text-slate-400">No tours yet. Publish your first tour.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {myTours.slice(0, 6).map((t) => {
                  const bookings = Math.max(0, t.seatsTotal - t.seatsRemaining);
                  return (
                    <div key={t.id} className="rounded-3xl border border-slate-800 bg-slate-950/30 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-100">
                            #{t.id} {t.header}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            Bookings <span className="text-slate-200">{bookings}</span> · Seats{" "}
                            <span className="text-slate-200">{t.seatsRemaining}</span>/{t.seatsTotal}
                          </div>
                        </div>
                        <div
                          className={[
                            "rounded-full border px-3 py-1 text-xs",
                            t.active
                              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                              : "border-slate-700 bg-slate-900/40 text-slate-300"
                          ].join(" ")}
                        >
                          {t.active ? "Active" : "Expired"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.6),0_18px_44px_rgba(2,6,23,0.65)] backdrop-blur">
            <div className="text-sm font-semibold text-slate-100">Finance</div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="text-3xl font-semibold text-slate-100">
                <AnimatedNumber value={earnings} decimals={2} />
              </div>
              <div className="pb-1 text-sm text-slate-400">{token.symbol}</div>
            </div>
            <div className="mt-4">
              <Button
                className="w-full"
                onClick={async () => {
                  try {
                    await withdrawGuide();
                    push({ title: "Withdrawn", description: "Earnings sent to your wallet.", kind: "success" });
                  } catch {
                    push({ title: "Withdraw failed", description: "Please confirm in wallet.", kind: "error" });
                  }
                }}
                disabled={!networkOk || busy === "withdrawGuide" || !isGuideVerified}
              >
                Withdraw Earnings
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

