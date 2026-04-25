/*<@Nursultan2026-04-25> */

"use client";

import { useMemo, useState } from "react";
import { formatUnits } from "ethers";
import { motion } from "framer-motion";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/Input";
import { useKoshun } from "@/components/KoshunProvider";
import { useToast } from "@/components/ToastProvider";
import { orderStatusLabel, shortAddr, type OrderView, type TourView } from "@/lib/useKoshunPay";
import { resolveTourImageSrc } from "@/lib/tourImage";

function formatMoney(x: string) {
  const n = Number(x);
  if (!Number.isFinite(n)) return x;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// Улучшенные бейджи статусов
function StatusBadge({ status }: { status: number }) {
  const styles =
    status === 1 // Active / Paid
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      : status === 2 // Completed
        ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
        : status === 3 // Cancelled / Disputed
          ? "border-red-500/30 bg-red-500/10 text-red-400"
          : "border-slate-700 bg-slate-800/40 text-slate-400";
          
  return (
    <div className={`rounded-full border px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles}`}>
      {orderStatusLabel(status)}
    </div>
  );
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
      <div className="flex h-60 flex-col items-center justify-center rounded-[32px] border border-slate-800 bg-slate-900/20 p-6 text-center">
        <span className="text-3xl mb-3">🔒</span>
        <p className="text-sm text-slate-400">My Trips is available for Tourists only.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-24 md:pb-8">
      {/* Заголовок страницы */}
      <div>
        <h1 className="text-3xl font-bold text-white">My Trips</h1>
        <p className="text-sm text-slate-400">Manage your bookings and digital tickets.</p>
      </div>

      <div className="space-y-4">
        {!isConnected && (
          <div className="rounded-[32px] border border-dashed border-slate-800 p-12 text-center">
            <p className="text-sm text-slate-500">Connect wallet to see your travel history</p>
          </div>
        )}

        {isConnected && items.length === 0 && (
          <div className="rounded-[32px] border border-dashed border-slate-800 p-12 text-center">
            <span className="text-3xl mb-3 block">🎫</span>
            <p className="text-sm text-slate-500">You haven't booked any trips yet.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {items.map(({ o, t }) => {
            const isCompleted = o.status === 2;
            const price = formatMoney(formatUnits(o.amount, token.decimals));
            
            return (
              <motion.div 
                key={o.id} 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="overflow-hidden rounded-[32px] border border-white/5 bg-slate-900/20 p-5 shadow-lg backdrop-blur-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    {/* Мини-иконка тура или заглушка */}
                    <div className="hidden h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-slate-800 sm:block">
                      {t?.image ? (
                        <img 
                          src={resolveTourImageSrc(t.image)}
                          className="h-full w-full object-cover" 
                          alt="" 
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-emerald-500/10 text-emerald-500">🏞️</div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-500">#{o.id}</span>
                        <StatusBadge status={o.status} />
                      </div>
                      <h3 className="truncate font-bold text-slate-100">
                        {t?.header || `Tour #${o.tourId}`}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Guide: {shortAddr(o.guide)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-4 sm:border-0 sm:pt-0">
                    <div className="mr-4">
                      <span className="text-lg font-black text-white">{price}</span>
                      <span className="ml-1 text-[10px] font-bold text-emerald-500">{token.symbol}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isCompleted && (
                        <Button
                          className="rounded-xl bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/10"
                          onClick={() => {
                            setTransferOrderId(o.id);
                            setNewOwner("");
                            setTransferOpen(true);
                          }}
                          disabled={!networkOk}
                        >
                          Gift Trip
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Модалка передачи (Gift/Transfer) */}
      <Modal open={transferOpen} title="Gift this Trip" onClose={() => setTransferOpen(false)}>
        <div className="space-y-4 py-2">
          <div className="rounded-2xl bg-emerald-500/5 p-4 border border-emerald-500/10 text-xs text-emerald-200">
            You can transfer your completed booking to another traveler's wallet address.
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Recipient Address</label>
            <Input 
              placeholder="0x..." 
              className="rounded-2xl"
              value={newOwner} 
              onChange={(e: any) => setNewOwner(e.target.value)} 
            />
          </div>

          <Button
            className="h-12 w-full rounded-2xl bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20"
            onClick={async () => {
              if (!transferOrderId) return;
              try {
                await transferBooking(transferOrderId, newOwner);
                push({ title: "Success!", description: "Ticket sent to new owner.", kind: "success" });
                setTransferOpen(false);
              } catch {
                push({ title: "Failed", description: "Could not transfer ticket.", kind: "error" });
              }
            }}
            disabled={!transferOrderId || !newOwner || busy === `transfer:${transferOrderId}` || !networkOk}
          >
            {busy === `transfer:${transferOrderId}` ? "Transferring..." : "Send Ticket"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}