"use client";

import { useState } from "react";
import type { IncidentRow, NodeSnapshotRow } from "@/types/oaa";

interface TicketOverridePanelProps {
  incident: IncidentRow;
  snapshots: NodeSnapshotRow[];
  /** Returns the message to show after the attempt (live or simulated). */
  onSubmit: (hint: string) => Promise<string>;
}

export default function TicketOverridePanel({ incident, snapshots, onSubmit }: TicketOverridePanelProps) {
  const [hint, setHint] = useState("Use dict.get('tax', 0.0)");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const retryable = incident.status === "HALTED_STRIKES";

  const node8 = snapshots.filter((s) => s.node_id === 8);
  const failureLog = node8.length
    ? node8
        .map((s) => {
          try {
            const state = JSON.parse(s.state_json) as Record<string, unknown>;
            const bundle = state.patch_bundle as { pr_markdown_report?: string } | null;
            return `strike ${s.status} (${s.elapsed_ms}ms) ${bundle?.pr_markdown_report ?? ""}`.trim();
          } catch {
            return `strike ${s.status} (${s.elapsed_ms}ms)`;
          }
        })
        .join("\n")
    : "No Node 8 attempts recorded.";

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      setResult(await onSubmit(hint));
    } catch (err) {
      setResult(`Retry failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel panel-pad">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">ticket override console</div>
          <h2 className="section-title mt-1">{incident.incident_id}</h2>
        </div>
        <span className={retryable ? "tag tag-danger" : "tag tag-good"}>
          {retryable ? "CIRCUIT BREAKER TRIPPED" : incident.status}
        </span>
      </div>

      <div className="eyebrow mt-5">node 8 pytest failure log</div>
      <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--surface-2)] p-3 font-mono text-[10px] leading-relaxed text-[var(--danger)]">
        {failureLog}
      </pre>

      {retryable ? (
        <div className="mt-4 rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/10 p-3">
          <div className="eyebrow text-[var(--warn)]">temporary ticket exception</div>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
            Grant a one-time 4th sandbox strike for {incident.incident_id} without changing the global{" "}
            {incident.max_strikes_override}-strike policy.
          </p>
          <input
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            aria-label="Prompt hint for the 4th strike"
            className="mt-3 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 font-mono text-[11px]"
          />
          <button className="btn btn-primary mt-2 w-full" onClick={() => void run()} disabled={busy || !hint.trim()}>
            {busy ? "Running Node 8…" : "↻ Run 4th try on Node 8 now"}
          </button>
          {result && <p className="mt-2 font-mono text-[10px] text-[var(--good)]">{result}</p>}
        </div>
      ) : (
        <p className="mt-4 text-[11px] leading-relaxed text-[var(--muted)]">
          {incident.status === "RESOLVED"
            ? "Ticket resolved — no override required."
            : "The override console only activates for HALTED_STRIKES tickets."}
        </p>
      )}
    </div>
  );
}
