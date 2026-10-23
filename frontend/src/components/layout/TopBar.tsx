"use client";

/**
 * TopBar — Global Status Pill, live 20.0 s SLA stopwatch and the
 * "Simulate Outage ▼" chaos launcher (CONTEXT.md §4.1).
 *
 * The stopwatch starts when an incident is ingested, freezes when the live
 * service stabilizes (Node 7) or when the Tier 2 gate pauses the graph
 * (Node 6 `interrupt()`), and turns red past the 20.0 s SLA target.
 */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Clock, Flame, TriangleAlert, Zap } from "lucide-react";

import { SLA_TARGET_SECONDS, useOAA } from "@/context/OAAContext";
import type { GlobalStatus, ScenarioKey } from "@/types/oaa";

const STATUS_STYLES: Record<GlobalStatus, { pill: string; dot: string; label: string }> = {
  HEALTHY: {
    pill: "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
    label: "HEALTHY",
  },
  INCIDENT_ACTIVE: {
    pill: "border-red-500/40 bg-red-500/10 text-red-300",
    dot: "bg-red-400",
    label: "INCIDENT ACTIVE",
  },
  TIER_2_PAUSED: {
    pill: "border-amber-500/50 bg-amber-500/15 text-amber-300",
    dot: "bg-amber-400",
    label: "TIER 2 PAUSED",
  },
};

const SCENARIOS: Array<{
  key: ScenarioKey;
  label: string;
  detail: string;
}> = [
  {
    key: "SCENARIO_1_STATELESS",
    label: "Scenario 1 — Stateless RAM Leak",
    detail: "2/12 pods OOMKilled · Tier 1 autonomous",
  },
  {
    key: "SCENARIO_2_STATEFUL_DB",
    label: "Scenario 2 — Stateful DB Lock",
    detail: "PID 4821 · pool 99/100 · Tier 2 HITL",
  },
  {
    key: "SCENARIO_3_CODE_BUG",
    label: "Scenario 3 — Pricing KeyError",
    detail: "pricing.py:87 · Tier 1 + Tier 3 PR",
  },
];

export default function TopBar() {
  const { status, sla, ingest, activeIncidentId, error, clearError } = useOAA();
  const [menuOpen, setMenuOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const styles = STATUS_STYLES[status];

  // Close the chaos launcher on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const launch = async (scenarioKey: ScenarioKey) => {
    setMenuOpen(false);
    setLaunching(true);
    try {
      await ingest(scenarioKey);
    } finally {
      setLaunching(false);
    }
  };

  const slaPercent = Math.min((sla.elapsed / SLA_TARGET_SECONDS) * 100, 100);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-oaa-border bg-oaa-panel/95 px-5 py-3 backdrop-blur">
      <span
        className={`flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.14em] ${styles.pill}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${styles.dot} ${status === "INCIDENT_ACTIVE" ? "oaa-pulse" : ""}`} />
        {styles.label}
      </span>

      {activeIncidentId && (
        <span className="font-mono text-[11px] text-slate-500">
          {activeIncidentId}
        </span>
      )}

      {/* SLA stopwatch */}
      <div
        className={`flex items-center gap-3 rounded-md border px-3 py-1.5 ${
          sla.breached
            ? "border-red-500/50 bg-red-500/10"
            : sla.frozen
              ? "border-oaa-border bg-oaa-bg/60"
              : "border-oaa-border bg-oaa-bg/60"
        }`}
        title="End-to-end SLA target: < 20.0s from ingestion to stabilization / interrupt"
      >
        <Clock
          className={`h-3.5 w-3.5 ${
            sla.breached ? "text-red-400" : sla.running ? "text-oaa-accent" : "text-slate-500"
          }`}
        />
        <span
          className={`font-mono text-sm tabular-nums ${
            sla.breached ? "font-semibold text-red-400" : "text-slate-200"
          }`}
        >
          {sla.elapsed.toFixed(1)}s
        </span>
        <span className="font-mono text-[11px] text-slate-500">
          / {SLA_TARGET_SECONDS.toFixed(1)}s
        </span>
        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
          <span
            className={`block h-full rounded-full transition-[width] duration-100 ${
              sla.breached ? "bg-red-500" : sla.running ? "bg-oaa-accent" : "bg-emerald-500"
            }`}
            style={{ width: `${slaPercent}%` }}
          />
        </span>
        {sla.breached ? (
          <span className="flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-red-400">
            <TriangleAlert className="h-3 w-3" />
            Breach
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            {sla.frozen ? "Frozen" : sla.running ? "Running" : "Idle"}
          </span>
        )}
      </div>

      {error && (
        <button
          type="button"
          onClick={clearError}
          className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 font-mono text-[10px] text-red-300 hover:bg-red-500/20"
          title={error}
        >
          {error.slice(0, 64)} ✕
        </button>
      )}

      <div className="flex-1" />

      {/* Chaos launcher */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          disabled={launching}
          className="flex items-center gap-2 rounded-md border border-oaa-amber/40 bg-oaa-amber/10 px-3 py-2 text-xs font-semibold text-oaa-amber transition-colors hover:bg-oaa-amber/20 disabled:opacity-60"
        >
          <Flame className="h-4 w-4" />
          Simulate Outage
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-lg border border-oaa-border bg-oaa-panel shadow-2xl shadow-black/60">
            <p className="border-b border-oaa-border px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Chaos launcher · deterministic fixtures
            </p>
            {SCENARIOS.map((scenario) => (
              <button
                key={scenario.key}
                type="button"
                onClick={() => void launch(scenario.key)}
                className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
              >
                <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-oaa-amber" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-slate-200">
                    {scenario.label}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-slate-500">
                    {scenario.detail}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
