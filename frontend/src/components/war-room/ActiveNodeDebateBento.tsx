"use client";

/**
 * Bento 2 — Active Working Node & Debate (CONTEXT.md §4.1).
 *
 * Shows the currently executing node (1–10) and the live cards for the three
 * debate participants: Forensics (Llama 3.3), FinOps (GPT-OSS-120B) and the
 * Arbiter (Gemini 2.5 Flash). The cards are fed by the `debate_transcript`
 * deltas and the `arbiter_decision` published on the SSE stream.
 */

import type { ReactNode } from "react";
import { Brain, Scale, Sparkles } from "lucide-react";

import { useOAA } from "@/context/OAAContext";
import type { DebateMessage } from "@/types/oaa";

const NODE_NAMES: Record<number, string> = {
  1: "Ingestion",
  2: "Forensics",
  3: "FinOps",
  4: "Arbiter",
  5: "Blast Radius",
  6: "Sandbox",
  7: "Execution",
  8: "GitOps PR",
  9: "Reporting",
  10: "Flight Ledger",
};

function CardShell({
  title,
  model,
  icon,
  accent,
  children,
}: {
  title: string;
  model: string;
  icon: ReactNode;
  accent: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-oaa-border bg-oaa-bg/70 p-3">
      <div className="flex items-center gap-2">
        <span className={accent}>{icon}</span>
        <span className="text-xs font-semibold text-slate-200">{title}</span>
        <span className="ml-auto font-mono text-[9px] text-slate-600">{model}</span>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function DebateBody({ message }: { message: DebateMessage }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 font-mono text-[10px]">
        <span className="rounded bg-white/5 px-1.5 py-0.5 uppercase text-slate-400">
          R{message.round_num}
        </span>
        <span className="uppercase text-slate-500">{message.stance}</span>
      </div>
      <p className="text-[11px] leading-relaxed text-slate-400">{message.argument}</p>
      <p className="break-words font-mono text-[10px] text-slate-600">
        → {message.proposed_action}
      </p>
    </div>
  );
}

export default function ActiveNodeDebateBento() {
  const { nodeEvents, state } = useOAA();

  const transcript = Array.isArray(state.debate_transcript) ? state.debate_transcript : [];
  const forensics = [...transcript].reverse().find((m) => m.speaker === "Forensics");
  const finops = [...transcript].reverse().find((m) => m.speaker === "FinOps");
  const arbiter = state.arbiter_decision;

  // The active node is the highest node id currently RUNNING or PAUSED; when
  // nothing is running we surface the last node that reported progress.
  const activeNodeId = Object.values(nodeEvents)
    .filter((event) => event.status === "RUNNING" || event.status === "PAUSED")
    .reduce<number>((max, event) => Math.max(max, event.node_id), 0);

  const lastNodeId = Object.values(nodeEvents).reduce<number>(
    (max, event) => Math.max(max, event.node_id),
    0,
  );
  const focusNodeId = activeNodeId || lastNodeId;
  const focusEvent = focusNodeId ? nodeEvents[focusNodeId] : undefined;
  const paused = focusEvent?.status === "PAUSED";

  return (
    <section className="flex h-full flex-col rounded-lg border border-oaa-border bg-oaa-panel">
      <header className="flex items-center gap-2 border-b border-oaa-border px-4 py-2.5">
        <Brain className="h-3.5 w-3.5 text-oaa-accent" />
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">
          Active Node &amp; Debate
        </h2>
        <span className="ml-auto font-mono text-[10px] text-slate-600">
          {focusNodeId ? `NODE ${focusNodeId} · ${NODE_NAMES[focusNodeId] ?? ""}` : "IDLE"}
        </span>
      </header>

      <div className="flex flex-col gap-3 p-4">
        {/* Node indicator strip (1 → 10) */}
        <div className="flex gap-1">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((nodeId) => {
            const event = nodeEvents[nodeId];
            const isActive = nodeId === focusNodeId;
            const completed = event?.status === "COMPLETED";
            const halted = event?.status === "HALTED";
            const isPaused = event?.status === "PAUSED";
            return (
              <div
                key={nodeId}
                title={`${nodeId}. ${NODE_NAMES[nodeId]} — ${event?.status ?? "PENDING"}`}
                className={`flex h-9 flex-1 flex-col items-center justify-center rounded border font-mono text-[10px] transition-colors ${
                  completed
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : halted
                      ? "border-red-500/50 bg-red-500/10 text-red-400"
                      : isPaused
                        ? "border-oaa-amber/60 bg-oaa-amber/15 text-oaa-amber"
                        : isActive
                          ? "border-oaa-accent/60 bg-oaa-accent/15 text-oaa-accent"
                          : "border-oaa-border bg-oaa-bg/60 text-slate-600"
                }`}
              >
                <span>{nodeId}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`font-mono text-2xl font-semibold tabular-nums ${
              paused ? "text-oaa-amber" : activeNodeId ? "text-oaa-accent" : "text-slate-600"
            }`}
          >
            {focusNodeId ? `NODE ${focusNodeId}` : "—"}
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            {focusNodeId ? NODE_NAMES[focusNodeId] : "awaiting ingestion"}
          </span>
          {focusEvent && (
            <span className="ml-auto rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] uppercase text-slate-400">
              {focusEvent.status}
            </span>
          )}
        </div>

        <div className="space-y-2">
          <CardShell
            title="Forensics"
            model="llama-3.3-70b"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            accent="text-sky-400"
          >
            {forensics ? (
              <DebateBody message={forensics} />
            ) : (
              <p className="text-[11px] text-slate-600">Waiting for Round 1 / Round 3…</p>
            )}
          </CardShell>

          <CardShell
            title="FinOps"
            model="gpt-oss-120b"
            icon={<Scale className="h-3.5 w-3.5" />}
            accent="text-violet-400"
          >
            {finops ? (
              <DebateBody message={finops} />
            ) : (
              <p className="text-[11px] text-slate-600">
                Waiting for Round 2 counter-argument…
              </p>
            )}
          </CardShell>

          <CardShell
            title="Arbiter"
            model="gemini-2.5-flash"
            icon={<Brain className="h-3.5 w-3.5" />}
            accent="text-emerald-400"
          >
            {arbiter?.winning_summary ? (
              <div className="space-y-1.5">
                <p className="text-[11px] leading-relaxed text-slate-400">
                  {arbiter.winning_summary}
                </p>
                <p className="break-words font-mono text-[10px] text-slate-600">
                  → {arbiter.command_to_run}
                </p>
                <p className="font-mono text-[10px] text-slate-600">
                  {arbiter.affected_pods}/{arbiter.total_pods} pods · D={arbiter.d_risk} · P=
                  {arbiter.p_reversibility} · code bug:{" "}
                  {arbiter.is_code_bug ? "yes" : "no"}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-600">Waiting for the consensus verdict…</p>
            )}
          </CardShell>
        </div>
      </div>
    </section>
  );
}
