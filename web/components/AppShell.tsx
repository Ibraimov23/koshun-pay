/*<@Nursultan2026-04-25> */

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
      <div className="space-y-6 py-2">
        <div className="text-center">
          <div className="mb-2 text-3xl">🤝</div>
          <div className="text-base font-medium text-white">
            {roleBadge === "Guide" ? "Dashboard Access" : "Partner Program"}
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {roleBadge === "Guide"
              ? "Manage your tours and track your earnings."
              : "Launch your tour business on-chain."}
          </p>
        </div>
        
        {roleBadge !== "GOS" && roleBadge !== "Owner" && (
          <Button
            className="w-full h-12 rounded-2xl bg-emerald-500 text-slate-950 font-bold"
            onClick={() => {
              onClose();
              onOpenCreateTour();
            }}
          >
            {roleBadge === "Guide" ? "Go to Dashboard" : "Become a Guide"}
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

  const [preview, setPreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const canSubmit = useMemo(() => {
    if (!isConnected || !networkOk) return false;
    if (roleBadge === "GOS" || roleBadge === "Owner") return false;
    return Boolean(s.header && s.description && imageFile && s.phone && s.price && Number(s.seatsTotal) > 0);
  }, [isConnected, networkOk, roleBadge, s, imageFile]);

  return (
    <Modal open={open} title="Create New Tour" onClose={onClose}>
      <div className="grid grid-cols-1 gap-4 py-2">
        {/* Кастомный загрузчик фото */}
        <div className="group relative flex h-40 flex-col items-center justify-center overflow-hidden rounded-[24px] border-2 border-dashed border-slate-800 bg-slate-900/50 transition-colors hover:border-emerald-500/50">
          {preview ? (
            <>
              <img src={preview} alt="Preview" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs text-white font-bold">Change Photo</span>
              </div>
            </>
          ) : (
            <div className="text-center">
              <span className="text-2xl mb-1 block">📸</span>
              <span className="text-xs text-slate-400">Add Tour Photo</span>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setPreview(URL.createObjectURL(file));
                setImageFile(file);
              }
            }}
          />
        </div>

        <Input placeholder="Tour Title (e.g. Son-Kul Magic)" className="rounded-2xl" value={s.header} onChange={(e: any) => setS((p) => ({ ...p, header: e.target.value }))} />
        
        <Textarea
          placeholder="What&apos;s included?"
          className="rounded-2xl min-h-[100px]"
          value={s.description}
          onChange={(e: any) => setS((p) => ({ ...p, description: e.target.value }))}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            placeholder={`Price (${token.symbol})`}
            className="rounded-2xl"
            inputMode="decimal"
            value={s.price}
            onChange={(e: any) => setS((p) => ({ ...p, price: e.target.value }))}
          />
          <Input
            placeholder="Max Seats"
            className="rounded-2xl"
            inputMode="numeric"
            value={s.seatsTotal}
            onChange={(e: any) => setS((p) => ({ ...p, seatsTotal: e.target.value }))}
          />
        </div>

        <Input placeholder="WhatsApp Phone" className="rounded-2xl" value={s.phone} onChange={(e: any) => setS((p) => ({ ...p, phone: e.target.value }))} />

        <Button
          className="mt-2 h-12 w-full rounded-2xl bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20"
          onClick={async () => {
            try {
              if (!imageFile) {
                push({ title: "Image required", description: "Please upload a tour image.", kind: "error" });
                return;
              }
              setIsUploading(true);
              const form = new FormData();
              form.append("file", imageFile);
              const res = await fetch("/api/upload-tour-image", {
                method: "POST",
                body: form
              });
              const data = (await res.json().catch(() => null)) as { path?: string; error?: string } | null;
              if (!res.ok || !data?.path) {
                throw new Error(data?.error || "Upload failed");
              }
              await createTour({ ...s, image: data.path });
              push({ title: "Tour Published", kind: "success" });
              setS({ header: "", description: "", image: "", phone: "", price: "", seatsTotal: "1" });
              setPreview(null);
              setImageFile(null);
              onClose();
            } catch {
              push({ title: "Failed", description: "Check wallet confirmation.", kind: "error" });
            } finally {
              setIsUploading(false);
            }
          }}
          disabled={!canSubmit || busy === "createTour" || isUploading}
        >
          {isUploading ? "Uploading image..." : busy === "createTour" ? "Publishing..." : "Launch Tour"}
        </Button>
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
      <div className="min-h-screen bg-[#020617] text-slate-100 selection:bg-emerald-500/30">
        {/* Более мягкий фон */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-80 w-[56rem] -translate-x-1/2 rounded-full bg-emerald-500/5 blur-[120px]" />
        </div>

        <Navbar onCooperation={() => setCoopOpen(true)} />

        <main className="relative mx-auto max-w-5xl px-4 py-6 md:py-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={String(roleBadge ?? "none")}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <CoopModal
          open={coopOpen}
          onClose={() => setCoopOpen(false)}
          onOpenCreateTour={() => setCreateOpen(true)}
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