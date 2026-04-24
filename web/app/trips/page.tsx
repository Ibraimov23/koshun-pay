"use client";

import { useMemo, useState } from "react";
import { formatUnits } from "ethers";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/Input";
import { useKoshun } from "@/components/KoshunProvider";
import { useToast } from "@/components/ToastProvider";
import { orderStatusLabel, shortAddr, type OrderView, type TourView } from "@/lib/useKoshunPay";

function formatMoney(x: string) {
  const n = Number(x);
  if (!Number.isFinite(n)) return x;
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function StatusBadge({ status }: { status: number }) {
  const t =
    status === 1
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : status === 2
        ? "border-slate-700 bg-slate-900/40 text-slate-200"
        : status === 3
          ? "border-red-400/30 bg-red-400/10 text-red-200"
          : "border-slate-800 bg-slate-950/30 text-slate-300";
  return <div className={["rounded-full border px-3 py-1 text-xs", t].join(" ")}>{orderStatusLabel(status)}</div>;
}

export default function TripsPage() {
  const { push } = useToast();
  const { roleBadge, myOrderIds, orders, toursById, token, transferBooking, busy, networkOk, isConnected } = useKoshun();
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferOrderId, setTransferOrderId] = useState<number | null>(null);
  const [newOwner, setNewOwner] = useState("");

  const items = useMemo(() => {
    return myOrderIds
      .slice()
      .sort((a, b) => b - a)
      .map((id) => {
        const o = orders[id];
        if (!o) return null;
        const t = toursById[o.tourId];
        return { o, t };
      })
      .filter(Boolean) as Array<{ o: OrderView; t?: TourView }>;
  }, [myOrderIds, orders, toursById]);

  if (roleBadge !== "Tourist") {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-950/30 p-6 text-sm text-slate-300">
        My Trips is available for Tourist only.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xl font-semibold text-slate-100">My Trips</div>
          <div className="mt-1 text-sm text-slate-400">Your bookings and statuses.</div>
        </div>
      </div>

      <Card title="Orders">
        {!isConnected ? <div className="text-sm text-slate-400">Connect wallet to see your orders.</div> : null}
        {isConnected && myOrderIds.length === 0 ? <div className="text-sm text-slate-400">No trips yet.</div> : null}

        <div className="grid grid-cols-1 gap-3">
          {items.map(({ o, t }) => {
            const isCompleted = o.status === 2;
            const price = formatMoney(formatUnits(o.amount, token.decimals));
            return (
              <div key={o.id} className="rounded-3xl border border-slate-800 bg-slate-950/30 p-4">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-semibold text-slate-100">Order #{o.id}</div>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      Tour #{o.tourId} {t?.header ? <span className="text-slate-200">· {t.header}</span> : null}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      Guide <span className="font-mono text-slate-300">{shortAddr(o.guide)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 md:justify-end">
                    <div className="rounded-full border border-slate-800 bg-slate-900/40 px-3 py-1.5 text-xs text-slate-200">
                      <span className="font-semibold text-slate-100">{price}</span> <span className="text-slate-400">{token.symbol}</span>
                    </div>

                    {isCompleted ? (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setTransferOrderId(o.id);
                          setNewOwner("");
                          setTransferOpen(true);
                        }}
                        disabled={!networkOk}
                      >
                        Transfer Booking
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Modal open={transferOpen} title="Transfer Booking" onClose={() => setTransferOpen(false)}>
        <div className="space-y-3">
          <div className="text-sm text-slate-300">
            This action is available only for <span className="text-slate-100">Completed</span> orders.
          </div>
          <Input placeholder="New owner address" value={newOwner} onChange={(e: any) => setNewOwner(e.target.value)} />
          <Button
            className="w-full"
            onClick={async () => {
              if (!transferOrderId) return;
              try {
                await transferBooking(transferOrderId, newOwner);
                push({ title: "Transferred", description: `Order #${transferOrderId} transferred.`, kind: "success" });
                setTransferOpen(false);
              } catch {
                push({ title: "Transfer failed", description: "Please confirm in wallet.", kind: "error" });
              }
            }}
            disabled={!transferOrderId || !newOwner || busy === `transfer:${transferOrderId}` || !networkOk}
          >
            Confirm Transfer
          </Button>
        </div>
      </Modal>
    </div>
  );
}
