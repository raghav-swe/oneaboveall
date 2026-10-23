"use client";

/**
 * Sidebar — 4-route navigation + live governance chips (CONTEXT.md §4.1).
 *
 * The MOCK_ENV (Offline Shield) and circuit-breaker chips are read from
 * `GET /api/v1/config` (the `runtime_config` singleton) so the operator always
 * sees the *effective* policy, not a hard-coded copy.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  History,
  LayoutDashboard,
  LifeBuoy,
  Radio,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

import { useOAA } from "@/context/OAAContext";

const NAV_ITEMS = [
  { href: "/dashboard", label: "War Room", icon: LayoutDashboard, hint: "Page 1" },
  { href: "/history", label: "Blackbox History", icon: History, hint: "Page 2" },
  { href: "/config", label: "Governance", icon: SlidersHorizontal, hint: "Page 3" },
  { href: "/support", label: "Support", icon: LifeBuoy, hint: "Page 4" },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const { config, connected } = useOAA();

  const mockEnv = config?.mock_env ?? true;
  const maxStrikes = config?.global_max_strikes ?? 3;
  const threshold = config?.blast_threshold ?? 0.4;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-oaa-border bg-oaa-panel">
      <div className="flex items-center gap-2.5 border-b border-oaa-border px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-oaa-accent/15 text-oaa-accent">
          <Radio className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="font-mono text-sm font-semibold tracking-wide text-slate-100">
            ONABOVEALL
          </p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
            SRE Control Plane
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-oaa-accent/12 text-oaa-accent ring-1 ring-inset ring-oaa-accent/30"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              <span className="font-mono text-[10px] text-slate-600">{item.hint}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-oaa-border p-3">
        <div className="flex items-center justify-between rounded-md border border-oaa-border bg-oaa-bg/60 px-3 py-2">
          <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Offline Shield
          </span>
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
              mockEnv
                ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30"
                : "bg-amber-500/15 text-amber-400 ring-1 ring-inset ring-amber-500/30"
            }`}
            title={mockEnv ? "MOCK_ENV=true — deterministic fixtures" : "MOCK_ENV=false — live mode"}
          >
            {mockEnv ? "MOCK_ENV" : "LIVE"}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-md border border-oaa-border bg-oaa-bg/60 px-3 py-2">
          <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500">
            <ShieldAlert className="h-3.5 w-3.5" />
            Circuit Breaker
          </span>
          <span className="font-mono text-[11px] text-slate-300">
            {maxStrikes} strike{maxStrikes === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-md border border-oaa-border bg-oaa-bg/60 px-3 py-2">
          <span className="text-[11px] uppercase tracking-wider text-slate-500">
            Blast threshold
          </span>
          <span className="font-mono text-[11px] text-slate-300">
            B &gt; {threshold.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center gap-2 px-1 pt-1 font-mono text-[10px] text-slate-600">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              connected ? "bg-emerald-500" : "bg-slate-600"
            }`}
          />
          {connected ? "SSE LINK UP" : "SSE LINK DOWN"}
        </div>
      </div>
    </aside>
  );
}
