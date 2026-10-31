"use client";

import { useState } from "react";
import { liveIncident } from "@/lib/mockData";

type Decision = "pending" | "approved" | "rejected";

export default function HitlBento() {
  const [decision, setDecision] = useState<Decision>("pending");
  const { rootCause, whyHitl, command, sandboxDryRun } = liveIncident.hitl;

  return (
    <section className="h-full rounded-lg border border-oaa-amber/70 bg-oaa-panel p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-oaa-amber">
          Bento 3 // Tier 2 HITL Action Required (3:00 AM Live Brief)
        </h2>
        <span
          className={`shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] ${
            sandboxDryRun.passed
              ? "border-oaa-green/40 bg-oaa-green/10 text-oaa-green"
              : "border-oaa-red/40 bg-oaa-red/10 text-oaa-red"
          }`}
        >
          {sandboxDryRun.passed ? "✓" : "✕"} Node 6 Sandbox Dry-Run:{" "}
          {sandboxDryRun.passed ? "PASS" : "FAIL"} ({sandboxDryRun.ms}ms)
        </span>
      </header>

      <ul className="mt-4 space-y-2 text-sm text-oaa-text">
        <li>
          • <span className="font-semibold">Root Cause:</span> {rootCause}
        </li>
        <li>
          • <span className="font-semibold">Why HITL:</span> {whyHitl}
        </li>
      </ul>

      <div className="mt-4 overflow-x-auto rounded-md border border-oaa-line bg-oaa-raised p-3 font-mono text-xs text-oaa-cyan">
        CMD: {command}
      </div>

      <div className="mt-4">
        {decision === "pending" ? (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setDecision("approved")}
              className="rounded-md bg-oaa-green px-4 py-2 text-xs font-bold text-oaa-bg transition hover:opacity-90"
            >
              ✓ APPROVE &amp; EXECUTE (NODE 7)
            </button>
            <button
              onClick={() => setDecision("rejected")}
              className="rounded-md border border-oaa-line bg-oaa-raised px-4 py-2 text-xs font-bold text-oaa-text transition hover:border-oaa-red hover:text-oaa-red"
            >
              ✕ REJECT &amp; ESCALATE
            </button>
          </div>
        ) : (
          <div
            role="status"
            className={`rounded-md border px-4 py-2 font-mono text-xs font-semibold ${
              decision === "approved"
                ? "border-oaa-green/40 bg-oaa-green/10 text-oaa-green"
                : "border-oaa-red/40 bg-oaa-red/10 text-oaa-red"
            }`}
          >
            {decision === "approved"
              ? "Approved: executing on Node 7"
              : "Rejected: escalated to on-call"}
          </div>
        )}
      </div>
    </section>
  );
}