"use client";

/**
 * Bento 1 — Live Telemetry & Baseline (CONTEXT.md §4.1).
 *
 * During an incident it renders the live read-only MCP telemetry pulled by
 * Node 1 (CPU, RAM, DB pool, HTTP 504 rate, stderr tail). When the control
 * plane is idle it renders the "Last Healthy Resolved Request" digest
 * (`last_healthy_summary` from `GET /api/v1/incidents`).
 */

import { Activity, Cpu, FileWarning, Server } from "lucide-react";

import { useOAA } from "@/context/OAAContext";
import type { TelemetryPayload } from "@/types/oaa";

function MetricTile({
  label,
  value,
  suffix,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: "default" | "warn" | "danger";
  hint?: string;
}) {
  const toneClass =
    tone === "danger"
      ? "text-red-400"
      : tone === "warn"
        ? "text-oaa-amber"
        : "text-slate-200";
  return (
    <div
      className="rounded-md border border-oaa-border bg-oaa-bg/70 px-3 py-2"
      title={hint}
    >
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className={`mt-1 font-mono text-lg leading-none tabular-nums ${toneClass}`}>
        {value}
        {suffix ? <span className="ml-0.5 text-[11px] text-slate-500">{suffix}</span> : null}
      </p>
    </div>
  );
}

export default function TelemetryBento() {
  const { state, activeIncidentId, lastHealthySummary } = useOAA();

  const telemetry = state.telemetry as unknown as TelemetryPayload | undefined;
  const metrics = telemetry?.metrics;
  const logs = Array.isArray(telemetry?.logs) ? telemetry.logs : [];

  const hasLiveTelemetry = Boolean(activeIncidentId && metrics);

  return (
    <section className="flex h-full flex-col rounded-lg border border-oaa-border bg-oaa-panel">
      <header className="flex items-center gap-2 border-b border-oaa-border px-4 py-2.5">
        <Activity className="h-3.5 w-3.5 text-oaa-accent" />
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">
          Live Telemetry &amp; Baseline
        </h2>
        <span className="ml-auto font-mono text-[10px] text-slate-600">
          {hasLiveTelemetry ? "READ-ONLY MCP · NODE 1" : "IDLE"}
        </span>
      </header>

      <div className="flex-1 p-4">
        {hasLiveTelemetry && metrics ? (
          <div className="flex h-full flex-col gap-3">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <MetricTile
                label="CPU"
                value={metrics.cpu_pct.toFixed(1)}
                suffix="%"
                tone={metrics.cpu_pct > 85 ? "danger" : metrics.cpu_pct > 60 ? "warn" : "default"}
                hint="get_pod_metrics · cpu_pct"
              />
              <MetricTile
                label="RAM"
                value={metrics.ram_pct.toFixed(1)}
                suffix="%"
                tone={metrics.ram_pct > 90 ? "danger" : metrics.ram_pct > 75 ? "warn" : "default"}
                hint={metrics.ram_trend ?? "get_pod_metrics · ram_pct"}
              />
              <MetricTile
                label="DB Pool"
                value={`${metrics.db_pool?.used ?? 0}/${metrics.db_pool?.max ?? 0}`}
                tone={
                  (metrics.db_pool?.used ?? 0) / Math.max(metrics.db_pool?.max ?? 1, 1) > 0.9
                    ? "danger"
                    : "default"
                }
                hint="PgBouncer connection pool"
              />
              <MetricTile
                label="HTTP 504"
                value={String(metrics.http_504_count_5m ?? 0)}
                suffix="/5m"
                tone={(metrics.http_504_count_5m ?? 0) > 100 ? "danger" : "default"}
                hint="Gateway timeouts in the last 5 minutes"
              />
            </div>

            <div className="min-h-0 flex-1">
              <p className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                <FileWarning className="h-3 w-3" />
                container stderr · tail
              </p>
              <div className="max-h-40 overflow-y-auto rounded-md border border-oaa-border bg-black/40 p-2.5">
                {logs.length === 0 ? (
                  <p className="font-mono text-[11px] text-slate-600">awaiting stderr tail…</p>
                ) : (
                  <ul className="space-y-1">
                    {logs.slice(-8).map((line, index) => (
                      <li
                        key={`${index}-${line.slice(0, 24)}`}
                        className="break-all font-mono text-[11px] leading-relaxed text-slate-400"
                      >
                        <span className="text-slate-600">{String(index + 1).padStart(2, "0")}</span>{" "}
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {metrics.ram_trend && (
              <p className="font-mono text-[10px] text-slate-500">
                trend: {metrics.ram_trend}
                {metrics.lock_waits !== undefined && ` · lock waits: ${metrics.lock_waits}`}
                {metrics.blocking_pid !== undefined && ` · blocking pid: ${metrics.blocking_pid}`}
              </p>
            )}
          </div>
        ) : lastHealthySummary ? (
          <div className="flex h-full flex-col gap-3">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-emerald-400" />
              <p className="text-sm font-medium text-slate-200">
                Last healthy resolved request
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <MetricTile
                label="Ticket"
                value={lastHealthySummary.incident_id}
                tone="default"
                hint="Most recent RESOLVED ticket"
              />
              <MetricTile
                label="Blast Radius"
                value={
                  lastHealthySummary.blast_radius_score === null
                    ? "n/a"
                    : lastHealthySummary.blast_radius_score.toFixed(2)
                }
                hint="B-score of the last resolved ticket"
              />
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px]">
              <dt className="text-slate-500">service</dt>
              <dd className="truncate text-slate-300">{lastHealthySummary.service}</dd>
              <dt className="text-slate-500">alert</dt>
              <dd className="truncate text-slate-300">{lastHealthySummary.alert_name}</dd>
              <dt className="text-slate-500">tier</dt>
              <dd className="truncate text-slate-300">
                {lastHealthySummary.selected_tier ?? "—"}
              </dd>
              <dt className="text-slate-500">resolved at</dt>
              <dd className="truncate text-slate-300">{lastHealthySummary.resolved_at}</dd>
              <dt className="text-slate-500">snapshots</dt>
              <dd className="text-slate-300">{lastHealthySummary.snapshot_count}</dd>
            </dl>

            {lastHealthySummary.final_report_md && (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-oaa-border bg-black/30 p-3">
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-400">
                  {lastHealthySummary.final_report_md.slice(0, 900)}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Cpu className="h-7 w-7 text-slate-700" />
            <p className="text-sm text-slate-500">No telemetry yet.</p>
            <p className="font-mono text-[11px] text-slate-600">
              launch a scenario from the top bar to stream live diagnostics.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
