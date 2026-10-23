"use client";

/**
 * Bento 5 — Bottom Timeline Scrubber (CONTEXT.md §4.1).
 *
 * Full-width 10-node progress bar that lights up in real time from the SSE
 * `node_update` events, with a one-click link into the `/history` DAG replay.
 */

import Link from "next/link";
import { ArrowRight, History } from "lucide-react";

import { useOAA } from "@/context/OAAContext";

const NODE_NAMES: Record<number, string> = {
  1: "Ingest",
  2: "Forensics",
  3: "FinOps",
  4: "Arbiter",
  5: "Blast Gate",
  6: "Sandbox",
  7: "Execute",
  8: "GitOps PR",
  9: "Report",
  10: "Ledger",
};

export default function BottomScrubberBento() {
  const { nodeEvents, activeIncidentId, state } = useOAA();

  const execution = state.execution_status;
  const tier = state.selected_tier;

  return (
    <section className="flex h-full flex-col rounded-lg border border-oaa-border bg-oaa-panel">
      <header className="flex items-center gap-2 border-b border-oaa-border px-4 py-2.5">
        <History className="h-3.5 w-3.5 text-oaa-accent" />
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">
          Timeline Scrubber
        </h2>
        {activeIncidentId && (
          <span className="font-mono text-[10px] text-slate-600">{activeIncidentId}</span>
        )}
        {tier && (
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
            {tier}
          </span>
        )}
        {execution && (
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
              execution === "STABILIZED"
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {execution}
          </span>
        )}
        <Link
          href="/history"
          className="ml-auto flex items-center gap-1.5 rounded-md border border-oaa-border bg-oaa-bg/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-400 transition-colors hover:border-oaa-accent/40 hover:text-oaa-accent"
        >
          Replay in /history
          <ArrowRight className="h-3 w-3" />
        </Link>
      </header>

      <div className="p-4">
        <div className="flex gap-1.5">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((nodeId) => {
            const event = nodeEvents[nodeId];
            const status = event?.status;
            const isCompleted = status === "COMPLETED";
            const isHalted = status === "HALTED";
            const isPaused = status === "PAUSED";
            const isRunning = status === "RUNNING";
            return (
              <div key={nodeId} className="flex min-w-0 flex-1 flex-col gap-1">
                <div
                  className={`h-2 rounded-full transition-colors duration-300 ${
                    isCompleted
                      ? "bg-emerald-500"
                      : isHalted
                        ? "bg-red-500"
                        : isPaused
                          ? "bg-oaa-amber"
                          : isRunning
                            ? "bg-oaa-accent oaa-pulse"
                            : "bg-white/[0.07]"
                  }`}
                />
                <div className="flex items-baseline gap-1">
                  <span
                    className={`font-mono text-[10px] ${
                      isCompleted
                        ? "text-emerald-400"
                        : isHalted
                          ? "text-red-400"
                          : isPaused
                            ? "text-oaa-amber"
                            : isRunning
                              ? "text-oaa-accent"
                              : "text-slate-600"
                    }`}
                  >
                    {nodeId}
                  </span>
                  <span className="truncate text-[10px] text-slate-600">
                    {NODE_NAMES[nodeId]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-2.5 font-mono text-[10px] text-slate-600">
          {activeIncidentId
            ? "Segments light up from the live SSE stream — every node transition is committed to the SQLite WAL blackbox ledger."
            : "No active incident. Launch a scenario to light up the 10-node pipeline."}
        </p>
      </div>
    </section>
  );
}
