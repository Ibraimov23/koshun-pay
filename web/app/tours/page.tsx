"use client";

import { useMemo } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useKoshun } from "@/components/KoshunProvider";
import { useUiActions } from "@/components/UiActions";

export default function ToursPage() {
  const { openCreateTour } = useUiActions();
  const { roleBadge, guideTourIds, toursById, networkOk } = useKoshun();

  const myTours = useMemo(() => {
    return guideTourIds
      .slice()
      .sort((a, b) => b - a)
      .map((id) => toursById[id])
      .filter(Boolean);
  }, [guideTourIds, toursById]);

  if (roleBadge !== "Guide") {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-950/30 p-6 text-sm text-slate-300">
        My Tours is available for Guide only.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xl font-semibold text-slate-100">My Tours</div>
          <div className="mt-1 text-sm text-slate-400">Tours you have created.</div>
        </div>
        <Button className="rounded-full" onClick={openCreateTour} disabled={!networkOk}>
          + Add Tour
        </Button>
      </div>

      <Card title="Created Tours">
        {myTours.length === 0 ? (
          <div className="text-sm text-slate-400">No tours yet.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {myTours.map((t) => {
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
  );
}

