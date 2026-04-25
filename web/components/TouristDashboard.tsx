/*<@Nursultan2026-04-25> */

"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { formatUnits } from "ethers";
import { Button } from "@/components/Button";
import { useKoshun } from "@/components/KoshunProvider";
import { useToast } from "@/components/ToastProvider";
import { shortAddr } from "@/lib/useKoshunPay";
import { resolveTourImageSrc } from "@/lib/tourImage";

function formatMoney(x: string) {
  const n = Number(x);
  if (!Number.isFinite(n)) return x;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// Улучшенный скелетон с более сильным скруглением
function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-[32px] border border-slate-800 bg-slate-900/20 backdrop-blur">
      <div className="h-52 animate-pulse bg-slate-800/40" />
      <div className="space-y-4 p-5">
        <div className="h-5 w-2/3 animate-pulse rounded-full bg-slate-800/40" />
        <div className="h-4 w-full animate-pulse rounded-full bg-slate-800/40" />
        <div className="h-12 w-full animate-pulse rounded-[20px] bg-slate-800/40" />
      </div>
    </div>
  );
}

function TourChatFab() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { activeTours } = useKoshun();
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState<Array<{ who: "you" | "ai"; text: string }>>([
    { who: "ai", text: "Hi! Ask me anything about tours in Kyrgyzstan." }
  ]);

  const tips = useMemo(() => {
    const n = activeTours.length;
    return n ? `${n} tours available today.` : "Looking for new adventures...";
  }, [activeTours.length]);

  return (
    <div className="fixed bottom-24 right-5 z-50 md:bottom-8">
      {open && (
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="mb-4 w-[calc(100vw-40px)] max-w-[350px] overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/80 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
            <div className="font-semibold text-white">AI Guide</div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <div className="max-h-[300px] space-y-3 overflow-auto p-5">
            <div className="rounded-2xl bg-white/5 p-3 text-xs text-emerald-400">{tips}</div>
            {log.map((m, i) => (
              <div key={i} className={`rounded-2xl px-4 py-2 text-sm ${m.who === "ai" ? "bg-white/5 text-slate-200" : "bg-emerald-600 text-white ml-8"}`}>
                {m.text}
              </div>
            ))}
          </div>
          <div className="p-4 pt-0">
            <div className="flex gap-2 rounded-2xl bg-white/5 p-1">
              <input
                className="w-full bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-500"
                placeholder="Ask something..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button
                className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950"
                onClick={async () => {
                  const text = q.trim();
                  if (!text || sending) return;
                  setQ("");
                  setSending(true);
                  setLog((p) => [...p, { who: "you", text }, { who: "ai", text: "Thinking..." }]);
                  try {
                    const res = await fetch("/api/ai-guide", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ question: text, log, tips })
                    });
                    const data = (await res.json().catch(() => null)) as { answer?: string; error?: string } | null;
                    if (!res.ok || !data?.answer) {
                      throw new Error(data?.error || "AI request failed");
                    }
                    setLog((p) => {
                      const next = [...p];
                      for (let i = next.length - 1; i >= 0; i--) {
                        if (next[i]?.who === "ai" && next[i]?.text === "Thinking...") {
                          next[i] = { who: "ai", text: data.answer as string };
                          return next;
                        }
                      }
                      next.push({ who: "ai", text: data.answer as string });
                      return next;
                    });
                  } catch {
                    setLog((p) => {
                      const next = [...p];
                      for (let i = next.length - 1; i >= 0; i--) {
                        if (next[i]?.who === "ai" && next[i]?.text === "Thinking...") {
                          next[i] = { who: "ai", text: "Sorry — I couldn&apos;t reach AI right now. Try again." };
                          return next;
                        }
                      }
                      next.push({ who: "ai", text: "Sorry — I couldn&apos;t reach AI right now. Try again." });
                      return next;
                    });
                  } finally {
                    setSending(false);
                  }
                }}
                disabled={sending}
              >
                Send
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <button
        className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 transition-transform active:scale-90"
        onClick={() => setOpen(!open)}
      >
        <span className="text-xl">💬</span>
      </button>
    </div>
  );
}

export function TouristDashboard() {
  const { push } = useToast();
  const {
    isConnected,
    connect,
    roleBadge,
    networkOk,
    toursById,
    hasLoadedTours,
    myOrderIds,
    orders,
    payForTour,
    confirmPayment,
    busy,
    token
  } = useKoshun();

  const allTours = useMemo(() => {
    return Object.values(toursById).slice().sort((a, b) => b.id - a.id);
  }, [toursById]);

  const canBook = isConnected && networkOk && roleBadge === "Tourist";
  const myOrderByTourId = useMemo(() => {
    const out: Record<number, typeof orders[number]> = {};
    for (const id of myOrderIds) {
      const order = orders[id];
      if (!order) continue;
      const prev = out[order.tourId];
      if (!prev || order.id > prev.id) {
        out[order.tourId] = order;
      }
    }
    return out;
  }, [myOrderIds, orders]);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-4 md:pb-8">
      {/* Шапка секции - Убрали лишнее, добавили акцент */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Discover Kyrgyzstan with Confidence</h1>
          <p className="text-sm text-slate-400">Verified adventures protected by smart contracts. Explore the hidden gems of the Tien Shan mountains with an AI-powered guide</p>
        </div>
      </div>

      {!networkOk && isConnected && (
        <div className="mb-6 rounded-2xl bg-red-500/10 p-4 text-center text-sm text-red-400 border border-red-500/20">
          Please switch to Sepolia Network
        </div>
      )}

      {/* Сетка туров - Более "Приложенческий" вид */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {!hasLoadedTours ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : allTours.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center rounded-[32px] border border-dashed border-slate-800 text-slate-500 sm:col-span-2 lg:col-span-3">
            <span className="mb-2 text-2xl">🏔️</span>
            <p>No tours found. Check back later!</p>
          </div>
        ) : (
          allTours.map((t) => (
            (() => {
              const myOrder = myOrderByTourId[t.id];
              const hasOrder = Boolean(myOrder);
              const isPaid = myOrder?.status === 1;
              const isCompleted = myOrder?.status === 2;
              const canConfirm = Boolean(
                myOrder &&
                  isPaid &&
                  !myOrder.isDisputed &&
                  !myOrder.isProcessed
              );

              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group overflow-hidden rounded-[32px] border border-white/5 bg-slate-900/20 transition-all hover:border-emerald-500/30 hover:bg-slate-900/40 shadow-xl"
                >
                  {/* Блок с картинкой - теперь поддерживает локальные пути */}
                  <div className="relative h-52">
                    <img
                      src={resolveTourImageSrc(t.image)}
                      alt={t.header}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />

                    <div
                      className={
                        "absolute left-4 top-4 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md " +
                        (t.active ? "text-emerald-400" : "text-slate-300")
                      }
                    >
                      {t.active ? "Active" : "Expired"}
                    </div>
                  </div>

                  {/* Контент карточки */}
                  <div className="p-5">
                    <h3 className="mb-1 truncate text-lg font-bold text-white">{t.header}</h3>
                    <p className="mb-4 text-xs text-slate-500 font-mono">by {shortAddr(t.guide)}</p>

                    <div className="mb-5 flex items-end justify-between">
                      <div>
                        <span className="text-2xl font-black text-white">{formatMoney(formatUnits(t.price, token.decimals))}</span>
                        <span className="ml-1 text-xs font-bold text-emerald-500">{token.symbol}</span>
                      </div>
                      <div className="text-right text-[10px] text-slate-400 uppercase tracking-tighter leading-tight">
                        <p>{t.seatsRemaining} seats left</p>
                        <p>{new Date(t.deadline * 1000).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {!hasOrder && (
                      <Button
                        variant={!isConnected ? "ghost" : "primary"}
                        className={
                          "h-12 w-full rounded-2xl font-bold shadow-lg active:scale-[0.98] transition-all " +
                          (!isConnected
                            ? "border-slate-700 bg-slate-900/40 text-slate-400 shadow-slate-950/20 hover:bg-slate-900/40"
                            : "bg-emerald-500 text-slate-950 shadow-emerald-500/10 hover:bg-emerald-400")
                        }
                        onClick={async () => {
                          try {
                            if (!isConnected) {
                              await connect();
                              return;
                            }
                            await payForTour(t.id);
                            push({ title: "Success!", description: "Your adventure starts now.", kind: "success" });
                          } catch {
                            push({ title: "Error", description: "Payment failed or rejected.", kind: "error" });
                          }
                        }}
                        disabled={
                          (isConnected && !canBook) ||
                          busy === `pay:${t.id}` ||
                          t.seatsRemaining <= 0 ||
                          !t.active
                        }
                      >
                        {busy === `pay:${t.id}`
                          ? "Processing..."
                          : !isConnected
                            ? "Connect Wallet"
                            : !networkOk
                              ? "Switch Network"
                              : !t.active
                                ? "Not Available"
                                : "Book Now"}
                      </Button>
                    )}

                    {hasOrder && isPaid && (
                      <Button
                        className="h-12 w-full rounded-2xl bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/10 hover:bg-emerald-400 active:scale-[0.98] transition-all disabled:opacity-60"
                        onClick={async () => {
                          if (!myOrder) return;
                          try {
                            await confirmPayment(myOrder.id);
                            push({ title: "Payment Confirmed", description: "Funds were released by your confirmation.", kind: "success" });
                          } catch {
                            push({ title: "Cannot confirm yet", description: "Wait until release time, or check dispute status.", kind: "error" });
                          }
                        }}
                        disabled={!networkOk || !canConfirm || !myOrder || busy === `confirm:${myOrder?.id}`}
                      >
                        {myOrder && busy === `confirm:${myOrder.id}` ? "Confirming..." : "Confirm Payment"}
                      </Button>
                    )}

                    {hasOrder && isCompleted && (
                      <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-center text-xs font-semibold text-blue-300">
                        Trip completed
                      </div>
                    )}

                    {hasOrder && !isPaid && !isCompleted && (
                      <div className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-3 text-center text-xs font-semibold text-slate-300">
                        Booking already exists for this tour
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })()
          ))
        )}
      </div>

      {/* Кнопка чата - только для туристов */}
      {roleBadge === "Tourist" && <TourChatFab />}
    </div>
  );
}