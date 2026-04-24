"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { formatUnits } from "ethers";
import { Button } from "@/components/Button";
import { useKoshun } from "@/components/KoshunProvider";
import { useToast } from "@/components/ToastProvider";
import { shortAddr } from "@/lib/useKoshunPay";

function formatMoney(x: string) {
  const n = Number(x);
  if (!Number.isFinite(n)) return x;
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40 backdrop-blur">
      <div className="h-44 animate-pulse bg-slate-800/60" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-800/60" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-slate-800/60" />
        <div className="h-9 w-full animate-pulse rounded-2xl bg-slate-800/60" />
      </div>
    </div>
  );
}

function TourChatFab() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { activeTours } = useKoshun();
  const [log, setLog] = useState<Array<{ who: "you" | "ai"; text: string }>>([
    { who: "ai", text: "Ask about tours: availability, pricing, booking steps." }
  ]);

  const tips = useMemo(() => {
    const n = activeTours.length;
    return n ? `There are ${n} active tours right now.` : "No active tours yet.";
  }, [activeTours.length]);

  return (
    <div className="fixed bottom-5 right-5 z-30">
      {open ? (
        <div className="w-[22rem] overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/50 shadow-[0_0_0_1px_rgba(15,23,42,0.7),0_24px_60px_rgba(2,6,23,0.75)] backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div className="text-sm font-semibold text-slate-100">AI Assistant</div>
            <button
              className="rounded-full border border-slate-800 bg-slate-900/40 px-3 py-1 text-xs text-slate-200 hover:bg-slate-900/60"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
          <div className="max-h-72 space-y-2 overflow-auto p-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
              {tips}
            </div>
            {log.map((m, i) => (
              <div
                key={i}
                className={[
                  "rounded-2xl px-3 py-2 text-sm",
                  m.who === "ai"
                    ? "border border-slate-800 bg-slate-900/40 text-slate-200"
                    : "bg-emerald-500/15 text-emerald-100"
                ].join(" ")}
              >
                {m.text}
              </div>
            ))}
          </div>
          <div className="border-t border-slate-800 p-3">
            <div className="flex gap-2">
              <input
                className="w-full rounded-2xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/15"
                placeholder="Ask a tour question…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button
                className="rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                disabled={!q.trim()}
                onClick={() => {
                  const text = q.trim();
                  setQ("");
                  setLog((p) => [
                    ...p,
                    { who: "you", text },
                    { who: "ai", text: "I can help with tours only. Check price, seats, and then press Book Now." }
                  ]);
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <button
        className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm font-medium text-slate-200 shadow-lg backdrop-blur hover:bg-slate-950/60"
        onClick={() => setOpen((v) => !v)}
      >
        AI Chat
      </button>
    </div>
  );
}

export function TouristDashboard() {
  const { push } = useToast();
  const { isConnected, connect, roleBadge, networkOk, activeTours, hasLoadedTours, payForTour, busy, token } = useKoshun();

  const canBook = isConnected && networkOk && roleBadge === "Tourist";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xl font-semibold text-slate-100">Home</div>
          <div className="mt-1 text-sm text-slate-400">Discover verified tours. Book with on-chain escrow.</div>
        </div>
        {!isConnected ? (
          <Button variant="pill" onClick={connect}>
            Connect
          </Button>
        ) : null}
      </div>

      {!networkOk && isConnected ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-200 backdrop-blur">
          Switch to Sepolia to continue.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {!hasLoadedTours ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : activeTours.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-950/30 p-6 text-sm text-slate-300 sm:col-span-2 lg:col-span-3">
            No tours available.
          </div>
        ) : (
          activeTours.map((t) => (
            <motion.div
              key={t.id}
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40 shadow-[0_0_0_1px_rgba(15,23,42,0.6),0_18px_44px_rgba(2,6,23,0.65)] backdrop-blur"
            >
              <div className="relative h-44 overflow-hidden">
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: t.image
                      ? `url(${t.image})`
                      : "radial-gradient(1200px 400px at 20% 10%, rgba(16,185,129,0.25), transparent 55%), radial-gradient(900px 300px at 80% 30%, rgba(148,163,184,0.15), transparent 60%), linear-gradient(135deg, rgba(2,6,23,0.8), rgba(15,23,42,0.8))"
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
                <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200 backdrop-blur">
                  AI Verified
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="truncate text-sm font-semibold text-slate-100">
                    #{t.id} {t.header}
                  </div>
                  <div className="mt-1 text-xs text-slate-300">
                    Guide <span className="font-mono">{shortAddr(t.guide)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-100">
                    {formatMoney(formatUnits(t.price, token.decimals))}
                  </div>
                  <div className="text-sm text-slate-400">{token.symbol}</div>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                  <div>
                    Seats <span className="text-slate-200">{t.seatsRemaining}</span>/{t.seatsTotal}
                  </div>
                  <div>{new Date(t.deadline * 1000).toLocaleDateString()}</div>
                </div>
                <Button
                  className="w-full"
                  onClick={async () => {
                    try {
                      await payForTour(t.id);
                      push({ title: "Booked", description: `Order created for Tour #${t.id}`, kind: "success" });
                    } catch {
                      push({ title: "Booking failed", description: "Please confirm in wallet.", kind: "error" });
                    }
                  }}
                  disabled={!canBook || busy === `pay:${t.id}` || t.seatsRemaining <= 0}
                >
                  Book Now
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {roleBadge === "Tourist" ? <TourChatFab /> : null}
    </div>
  );
}
