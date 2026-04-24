"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/Button";
import { useKoshun } from "@/components/KoshunProvider";
import { shortAddr } from "@/lib/useKoshunPay";

function cn(...xs: Array<string | undefined | false | null>) {
  return xs.filter(Boolean).join(" ");
}

function TokenDot() {
  return <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.55)]" />;
}

export function Navbar({ onCooperation }: { onCooperation: () => void }) {
  const p = usePathname();
  const { isConnected, connect, address, walletBal, token, roleBadge, networkOk } = useKoshun();

  const tabs: Array<{ href: string; label: string; show: boolean }> = [
    { href: "/", label: "Home", show: true },
    { href: "/trips", label: "My Trips", show: roleBadge === "Tourist" },
    { href: "/tours", label: "My Tours", show: roleBadge === "Guide" }
  ];

  return (
    <div className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/40 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-3xl border border-slate-800 bg-slate-900/60">
            <div className="h-4 w-4 rounded-full bg-gradient-to-br from-emerald-300 to-emerald-700" />
          </div>
          <div className="text-sm font-semibold text-slate-100">Koshun Pay</div>
        </div>

        <div className="flex flex-1 items-center gap-1 overflow-x-auto rounded-full border border-slate-800 bg-slate-950/30 p-1 md:flex-none">
          {tabs
            .filter((t) => t.show)
            .map((t) => {
              const active = p === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition",
                    active ? "bg-slate-800/60 text-slate-100" : "text-slate-300 hover:bg-slate-900/50"
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onCooperation}
            className="hidden rounded-full border border-slate-800 bg-slate-950/30 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-950/50 md:inline-flex"
          >
            Cooperation
          </button>

          {roleBadge ? (
            <div className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-950/30 px-3 py-2 text-sm text-slate-200 md:flex">
              <TokenDot />
              <span>{roleBadge}</span>
              <span className="text-slate-500">·</span>
              <span className={networkOk ? "text-emerald-300" : "text-red-300"}>{networkOk ? "Sepolia" : "Wrong net"}</span>
            </div>
          ) : null}

          <Button variant="pill" onClick={connect}>
            {isConnected && address ? (
              <span className="flex items-center gap-2">
                <span className="font-mono">{shortAddr(address)}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-200">
                  {walletBal ? Number(walletBal).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"} {token.symbol}
                </span>
              </span>
            ) : (
              "Connect Wallet"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
