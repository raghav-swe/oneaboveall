"use client";

/**
 * Bento 3 — Tier 2 HITL Action Alert (CONTEXT.md §4.1, ARCHITECTURE §3.2).
 *
 * Flashes amber while the graph is parked on Node 6's `interrupt()`, renders
 * the 3:00 AM Live Engineer Briefing plus the Node 6 Sandbox Dry-Run PASS
 * badge, and exposes [Approve & Execute] / [Reject & Escalate] which resume the
 * graph through `POST /api/v1/incidents/{id}/approve`.
 */

import { useState } from "react";
import { CheckCircle2, ShieldAlert } from "lucide-react";

import { useOAA } from "@/context/OAAContext";

export default function HITLApprovalBento() {
  const { hitlPaused, activeIncidentId, state, approve, sla } = useOAA();
  const [busy, setBusy] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const briefing = state.live_engineer_briefing ?? "";
  const badge =
    state.verification_badge ?? state.sandbox_result?.verification_badge ?? "";

  const decide = async (decision: "APPROVED" | "REJECTED") => {
    if (!activeIncidentId) return;
    setBusy(decision);
    setResult(null);
    const ok = await approve(activeIncidentId, decision);
    setBusy(null);
    setResult(
      ok
        ? decision === "APPROVED"
          ? "Approved — execution resumed."
          : "Rejected — routed to the audit report."
        : "Action failed — see the top bar.",
    );
  };

  return (
    <section
      className={`flex h-full flex-col rounded-lg border bg-oaa-panel transition-colors ${
        hitlPaused
          ? "oaa-amber-flash border-oaa-amber/70 bg-oaa-amber/[0.07]"
          : "border-oaa-border"
      }`}
    >
      <header className="flex items-center gap-2 border-b border-oaa-border/70 px-4 py-2.5">
        <ShieldAlert
          className={`h-3.5 w-3.5 ${hitlPaused ? "text-oaa-amber" : "text-slate-500"}`}
        />
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">
          Tier 2 HITL Gate
        </h2>
        <span
          className={`ml-auto font-mono text-[10px] uppercase tracking-wider ${
            hitlPaused ? "text-oaa-amber" : "text-slate-600"
          }`}
        >
          {hitlPaused ? "Awaiting human" : "No pending gate"}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {hitlPaused ? (
          <>
            <div className="rounded-md border border-oaa-amber/40 bg-oaa-amber/10 px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-oaa-amber">
                3:00 AM Live Engineer Briefing
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">
                {briefing || "Briefing unavailable — check the Node 4 verdict."}
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span className="font-mono text-[11px] text-emerald-300">
                {badge || "PASS — 0 Syntax Errors, 0 Destructive Mutations"}
              </span>
            </div>

            <div className="mt-auto grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => void decide("APPROVED")}
                disabled={busy !== null}
                className="rounded-md border border-emerald-500/50 bg-emerald-500/15 px-3 py-2.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
              >
                {busy === "APPROVED" ? "Approving…" : "[ Approve & Execute ]"}
              </button>
              <button
                type="button"
                onClick={() => void decide("REJECTED")}
                disabled={busy !== null}
                className="rounded-md border border-red-500/45 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
              >
                {busy === "REJECTED" ? "Rejecting…" : "[ Reject & Escalate ]"}
              </button>
            </div>

            <p className="font-mono text-[10px] text-slate-600">
              SLA frozen at {sla.elapsed.toFixed(1)}s while the gate is open.
            </p>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <ShieldAlert className="h-7 w-7 text-slate-700" />
            <p className="text-sm text-slate-500">No human gate is armed.</p>
            <p className="max-w-[24ch] font-mono text-[11px] leading-relaxed text-slate-600">
              Tier 2 runs pause here after the Node 6 dry-run and wait for an
              operator decision.
            </p>
            {result && (
              <p className="mt-1 font-mono text-[11px] text-slate-400">{result}</p>
            )}
            {state.hitl_decision && state.hitl_decision !== "AUTO_APPROVED" && (
              <p className="font-mono text-[11px] text-slate-400">
                Last decision: {state.hitl_decision}
              </p>
            )}
            {state.hitl_decision === "AUTO_APPROVED" && (
              <p className="font-mono text-[11px] text-emerald-400">
                Tier 1 — auto-approved (no human required).
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
