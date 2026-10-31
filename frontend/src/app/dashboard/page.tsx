"use client";

import { useMemo, useState } from "react";
import { useOAA } from "@/context/OAAContext";
import LiveTelemetry from "@/components/dashboard/LiveTelemetry";
import type { ScenarioKey, TelemetryPayload } from "@/types/oaa";

const SCENARIOS: { key: ScenarioKey; label: string }[] = [
  { key: "SCENARIO_1_STATELESS", label: "S1 · Stateless RAM leak" },
  { key: "SCENARIO_2_STATEFUL_DB", label: "S2 · Stateful DB lock" },
  { key: "SCENARIO_3_CODE_BUG", label: "S3 · Pricing KeyError" },
];

const NODE_LABELS = ["Ingest", "Forensics", "FinOps", "Arbiter", "Blast", "Sandbox", "Execute", "GitOps", "Report", "Ledger"];

function Metric({ label, value, note, tone = "" }: { label: string; value: string; note: string; tone?: string }) {
  return (
    <div className="panel panel-pad reveal">
      <div className="eyebrow">{label}</div>
      <div className={`metric-number mt-3 ${tone}`}>{value}</div>
      <div className="mt-2 text-[11px] text-[var(--muted)]">{note}</div>
    </div>
  );
}

export default function Page() {
  const { status, sla, state, nodeEvents, hitlPaused, incidents, lastHealthySummary, ingest, approve, activeIncidentId } = useOAA();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const telemetry = state.telemetry as unknown as TelemetryPayload | undefined;
  const metrics = telemetry?.metrics;
  const decision = state.arbiter_decision ?? {};
  const transcript = Array.isArray(state.debate_transcript) ? state.debate_transcript : [];
  const arbiter = decision.winning_summary;

  const verdicts = useMemo(() => {
    const forensics = [...transcript].reverse().find((m) => m.speaker === "Forensics");
    const finops = [...transcript].reverse().find((m) => m.speaker === "FinOps");
    return [
      { vendor: "Llama-3.3-70B", role: "Forensics", text: forensics?.argument ?? "Awaiting Round 1…", tone: "var(--danger)" },
      { vendor: "GPT-OSS-120B", role: "FinOps", text: finops?.argument ?? "Awaiting Round 2…", tone: "var(--blue)" },
      { vendor: "Gemini 2.5 Flash", role: "Arbiter", text: arbiter ?? "Awaiting consensus…", tone: "var(--warn)" },
    ];
  }, [transcript, arbiter]);

  const resolved = incidents.filter((i) => i.status === "RESOLVED").length;
  const paused = incidents.filter((i) => i.status === "PAUSED_HITL").length;
  const blast = state.blast_radius_score ?? 0;
  const threshold = 0.4;

  const nodeStates = Array.from({ length: 10 }, (_, i) => {
    const id = i + 1;
    const ev = nodeEvents[id];
    if (!ev) return "pending" as const;
    if (ev.status === "COMPLETED") return "done" as const;
    if (ev.status === "PAUSED") return "paused" as const;
    if (ev.status === "HALTED") return "failed" as const;
    return "active" as const;
  });
  const doneCount = nodeStates.filter((s) => s === "done").length;

  const activeRow = incidents.find((i) => i.incident_id === activeIncidentId);
  const pill =
    status === "TIER_2_PAUSED"
      ? { cls: "tag tag-warn", text: "● TIER 2 · HITL PAUSED" }
      : status === "INCIDENT_ACTIVE"
        ? { cls: "tag tag-danger", text: "● INCIDENT ACTIVE" }
        : { cls: "tag tag-good", text: "● HEALTHY" };

  const launch = async (key: ScenarioKey) => {
    setBusy(key);
    setMenuOpen(false);
    try {
      await ingest(key);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4 reveal">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span className="live-dot pulse" /> live operations · {status === "HEALTHY" ? "all systems nominal" : "incident in progress"}
          </div>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-.05em] md:text-5xl">War Room</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Agents are watching <b className="text-[var(--text)]">{incidents.length} tickets</b> across the blackbox ledger.
          </p>
        </div>

        <div className="relative flex gap-2">
          <div className="relative">
            <button className="btn btn-primary" onClick={() => setMenuOpen((o) => !o)} disabled={busy !== null}>
              {busy ? "Launching…" : "＋ Simulate outage"}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-[110%] z-40 w-64 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xl">
                {SCENARIOS.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => void launch(s.key)}
                    className="block w-full border-b border-[var(--line)] px-3 py-2.5 text-left text-xs last:border-0 hover:bg-[var(--surface-2)]"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="panel flex flex-wrap items-center gap-3 p-3">
        <span className={pill.cls}>{pill.text}</span>
        <span className="data">{activeIncidentId ?? "—"}</span>
        <span className="text-sm text-[var(--muted)]">
          {state.service ?? activeRow?.service ?? lastHealthySummary?.service ?? "no active incident"}
        </span>
        <span className="ml-auto data text-[var(--accent)]">
          SLA {sla.elapsed.toFixed(2)}s / 20.0s {sla.breached ? "· BREACH" : sla.frozen ? "· frozen" : ""}
        </span>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Tickets in ledger" value={String(incidents.length)} note={`${resolved} resolved`} tone="text-[var(--good)]" />
        <Metric label="Nodes completed" value={`${doneCount}/10`} note={activeIncidentId ? "current run" : "idle"} tone="text-[var(--accent)]" />
        <Metric label="Blast radius" value={blast.toFixed(2)} note={`threshold ${threshold.toFixed(2)}`} tone={blast > threshold ? "text-[var(--danger)]" : "text-[var(--good)]"} />
        <Metric label="Open interventions" value={String(paused)} note={paused ? "needs your attention" : "none"} tone="text-[var(--warn)]" />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <section className="panel panel-pad xl:col-span-7">
          <LiveTelemetry
            telemetry={{
              dbPool: { used: metrics?.db_pool?.used ?? 0, max: metrics?.db_pool?.max ?? 100 },
              http504Pct: metrics?.http_504_count_5m ?? 0,
              ramLoadPct: metrics?.ram_pct ?? 0,
              liveError: telemetry?.logs?.[telemetry.logs.length - 2],
            }}
          />
        </section>

        <section className="panel panel-pad xl:col-span-5">
          <div className="flex justify-between">
            <div>
              <h2 className="section-title">Agent consensus</h2>
              <p className="section-sub">Three models, one safe decision</p>
            </div>
            <span className="tag tag-good">{transcript.length ? `${transcript.length}/3 turns` : "idle"}</span>
          </div>
          <div className="mt-5 space-y-3">
            {verdicts.map((v) => (
              <div key={v.vendor} className="rounded-lg border border-[var(--line)] p-3" style={{ borderLeftColor: v.tone, borderLeftWidth: 3 }}>
                <div className="flex justify-between">
                  <b className="text-xs">{v.vendor}</b>
                  <span className="eyebrow">{v.role}</span>
                </div>
                <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-[var(--muted)]">{v.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="panel panel-pad lg:col-span-7">
          <div className="flex justify-between">
            <div>
              <h2 className="section-title">Human intervention required</h2>
              <p className="section-sub">{hitlPaused ? `${state.service ?? ""} · Tier 2 gate armed` : "No gate currently armed"}</p>
            </div>
            <span className={hitlPaused ? "tag tag-warn" : "tag tag-good"}>{hitlPaused ? "AWAITING HUMAN" : "CLEAR"}</span>
          </div>

          {hitlPaused ? (
            <>
              <div className="mt-4 rounded-lg bg-[var(--surface-2)] p-4">
                <div className="eyebrow">3:00 AM live briefing</div>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[var(--muted)]">
                  {state.live_engineer_briefing || "Briefing unavailable."}
                </p>
                <code className="mt-3 block text-xs text-[var(--accent)]">{decision.command_to_run ?? "—"}</code>
                <div className="mt-3 flex items-center gap-2 text-xs text-[var(--good)]">
                  ✓ {state.verification_badge ?? state.sandbox_result?.verification_badge ?? "Sandbox dry-run passed"}
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="btn btn-primary" onClick={() => activeIncidentId && void approve(activeIncidentId, "APPROVED")}>
                  Approve &amp; execute
                </button>
                <button className="btn" onClick={() => activeIncidentId && void approve(activeIncidentId, "REJECTED")}>
                  Reject &amp; escalate
                </button>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-lg bg-[var(--surface-2)] p-4 text-xs text-[var(--muted)]">
              {state.hitl_decision === "AUTO_APPROVED"
                ? "Tier 1 — auto-approved. No human required."
                : lastHealthySummary
                  ? `Last healthy request: ${lastHealthySummary.incident_id} · ${lastHealthySummary.service} · B=${lastHealthySummary.blast_radius_score?.toFixed(2) ?? "n/a"}`
                  : "Launch a scenario to arm the gate."}
            </div>
          )}
        </section>

        <section className="panel panel-pad lg:col-span-5">
          <h2 className="section-title">Blast radius</h2>
          <p className="section-sub">Safety gate · threshold {(threshold * 100).toFixed(0)}%</p>
          <div className="mt-5 flex items-center gap-5">
            <div
              className="grid h-24 w-24 place-items-center rounded-full border-[9px] text-center"
              style={{
                borderColor: `color-mix(in srgb, ${blast > threshold ? "var(--danger)" : "var(--good)"} 20%, transparent)`,
                borderTopColor: blast > threshold ? "var(--danger)" : "var(--good)",
              }}
            >
              <b className="text-xl">{blast.toFixed(2)}</b>
            </div>
            <div className="text-xs text-[var(--muted)]">
              <p>
                <b className="text-[var(--text)]">{blast > threshold ? "Tier 2 required" : "Tier 1 safe"}</b>
                <br />
                {decision.affected_pods ?? 0}/{decision.total_pods ?? 0} pods · D={decision.d_risk ?? 0} · P={decision.p_reversibility ?? 0}
              </p>
              <p className="mt-3">{state.selected_tier || "awaiting verdict"}</p>
            </div>
          </div>
          <div className="mt-5">
            <div className="flex justify-between text-[11px] text-[var(--muted)]">
              <span>safe</span>
              <span>threshold</span>
              <span>critical</span>
            </div>
            <div className="bar mt-2">
              <i style={{ width: `${Math.min(blast, 1) * 100}%`, background: blast > threshold ? "var(--danger)" : "var(--good)" }} />
            </div>
          </div>
          {decision.is_code_bug ? (
            <div className="mt-4 rounded-lg border border-[var(--line)] p-3 text-xs">
              <div className="eyebrow">Tier 3 · GitOps PR</div>
              <p className="mt-1 text-[var(--muted)]">
                {state.patch_bundle?.pr_url ? (
                  <a className="text-[var(--accent)] underline" href={state.patch_bundle.pr_url} target="_blank" rel="noreferrer">
                    {state.patch_bundle.pr_url}
                  </a>
                ) : state.patch_bundle ? (
                  `pytest ${state.patch_bundle.pytest_passed ? "passed" : "failing"} · strike ${state.patch_bundle.strike_count}`
                ) : (
                  "Queued for Node 8 after stabilization."
                )}
              </p>
            </div>
          ) : null}
        </section>
      </div>

      <section className="panel panel-pad">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Workflow activity</h2>
            <p className="section-sub">Current incident · {doneCount} nodes completed</p>
          </div>
          <a className="btn" href="/history">
            View blackbox →
          </a>
        </div>
        <div className="mt-5 flex min-w-[600px] items-start">
          {nodeStates.map((st, i) => (
            <div key={i} className="relative flex-1 text-center">
              <div
                className={`mx-auto grid h-8 w-8 place-items-center rounded-full border-2 text-xs ${
                  st === "done"
                    ? "border-[var(--good)] bg-[var(--good)]/10 text-[var(--good)]"
                    : st === "paused"
                      ? "border-[var(--warn)] bg-[var(--warn)]/10 text-[var(--warn)]"
                      : st === "failed"
                        ? "border-[var(--danger)] bg-[var(--danger)]/10 text-[var(--danger)]"
                        : st === "active"
                          ? "border-[var(--accent)] text-[var(--accent)]"
                          : "border-[var(--line)] text-[var(--muted)]"
                }`}
              >
                {st === "done" ? "✓" : i + 1}
              </div>
              <div className="mt-2 text-[10px] text-[var(--muted)]">{NODE_LABELS[i]}</div>
              {i < nodeStates.length - 1 && (
                <i className="absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-4 border-t border-dashed border-[var(--line)]" />
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
        <span className="live-dot" /> Last resolved:{" "}
        <b className="text-[var(--text)]">{lastHealthySummary?.incident_id ?? "—"}</b> · {lastHealthySummary?.alert_name ?? "no history yet"}
      </div>
    </div>
  );
}
