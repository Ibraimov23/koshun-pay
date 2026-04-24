"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import { KoshunProvider, useKoshun } from "@/components/KoshunProvider";
import { ToastProvider, useToast } from "@/components/ToastProvider";
import { UiActionsProvider } from "@/components/UiActions";
import type { NewTourState } from "@/lib/useKoshunPay";

function CoopModal({
  open,
  onClose,
  onOpenCreateTour
}: {
  open: boolean;
  onClose: () => void;
  onOpenCreateTour: () => void;
}) {
  const { roleBadge } = useKoshun();

  return (
    <Modal open={open} title="Cooperation" onClose={onClose}>
      <div className="space-y-4">
        <div className="text-sm text-slate-300">
          {roleBadge === "Guide"
            ? "Start hosting tours and earn on-chain."
            : roleBadge === "GOS"
              ? "Government access is enabled."
              : "Create your first tour to become a Guide."}
        </div>
        {roleBadge === "GOS" ? null : (
          <Button
            onClick={() => {
              onClose();
              onOpenCreateTour();
            }}
          >
            {roleBadge === "Guide" ? "Start Hosting" : "Become a Guide"}
          </Button>
        )}
      </div>
    </Modal>
  );
}

function CreateTourModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { push } = useToast();
  const { createTour, busy, token, roleBadge, networkOk, isConnected } = useKoshun();

  const [s, setS] = useState<NewTourState>({
    header: "",
    description: "",
    image: "",
    phone: "",
    price: "",
    seatsTotal: "1"
  });

  const canSubmit = useMemo(() => {
    if (!isConnected || !networkOk) return false;
    if (roleBadge === "GOS") return false;
    return Boolean(s.header && s.description && s.image && s.phone && s.price && Number(s.seatsTotal) > 0);
  }, [isConnected, networkOk, roleBadge, s]);

  return (
    <Modal open={open} title="Create Tour" onClose={onClose}>
      <div className="grid grid-cols-1 gap-3">
        <Input placeholder="Title" value={s.header} onChange={(e: any) => setS((p) => ({ ...p, header: e.target.value }))} />
        <Textarea
          placeholder="Description"
          value={s.description}
          onChange={(e: any) => setS((p) => ({ ...p, description: e.target.value }))}
        />
        <Input placeholder="Image URL" value={s.image} onChange={(e: any) => setS((p) => ({ ...p, image: e.target.value }))} />
        <Input placeholder="Phone" value={s.phone} onChange={(e: any) => setS((p) => ({ ...p, phone: e.target.value }))} />
        <div className="grid grid-cols-2 gap-3">
          <Input
            placeholder={`Price (${token.symbol})`}
            inputMode="decimal"
            value={s.price}
            onChange={(e: any) => setS((p) => ({ ...p, price: e.target.value }))}
          />
          <Input
            placeholder="Seats"
            inputMode="numeric"
            value={s.seatsTotal}
            onChange={(e: any) => setS((p) => ({ ...p, seatsTotal: e.target.value }))}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400">Publishing a tour registers you as a Guide.</div>
          <Button
            onClick={async () => {
              try {
                await createTour(s);
                push({ title: "Tour published", kind: "success" });
                setS({ header: "", description: "", image: "", phone: "", price: "", seatsTotal: "1" });
                onClose();
              } catch {
                push({ title: "Transaction failed", description: "Please try again in wallet.", kind: "error" });
              }
            }}
            disabled={!canSubmit || busy === "createTour"}
          >
            Publish
          </Button>
        </div>
        {!networkOk ? <div className="text-xs text-red-300">Switch to Sepolia to create tours.</div> : null}
        {roleBadge === "GOS" ? <div className="text-xs text-slate-400">Government accounts cannot create tours.</div> : null}
      </div>
    </Modal>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const [coopOpen, setCoopOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const { roleBadge } = useKoshun();

  return (
    <UiActionsProvider
      value={{
        openCooperation: () => setCoopOpen(true),
        openCreateTour: () => setCreateOpen(true)
      }}
    >
      <div className="min-h-screen bg-[#0f172a] text-slate-100">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-80 w-[56rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute -bottom-44 right-[-10rem] h-96 w-96 rounded-full bg-slate-400/10 blur-3xl" />
        </div>

        <Navbar onCooperation={() => setCoopOpen(true)} />

        <main className="relative mx-auto max-w-6xl px-5 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={String(roleBadge ?? "none")}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <button
          onClick={() => setCoopOpen(true)}
          className="fixed bottom-5 left-5 z-30 rounded-full border border-slate-800 bg-slate-950/40 px-4 py-2 text-sm font-medium text-slate-200 backdrop-blur hover:bg-slate-950/60 md:hidden"
        >
          Cooperation
        </button>

        <CoopModal
          open={coopOpen}
          onClose={() => setCoopOpen(false)}
          onOpenCreateTour={() => {
            setCreateOpen(true);
          }}
        />
        <CreateTourModal open={createOpen} onClose={() => setCreateOpen(false)} />
      </div>
    </UiActionsProvider>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <KoshunProvider>
        <ShellInner>{children}</ShellInner>
      </KoshunProvider>
    </ToastProvider>
  );
}
