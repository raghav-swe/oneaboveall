import { liveIncident, lastResolved } from "@/lib/mockData";

export default function TelemetryBento() {
  const { telemetry } = liveIncident;
  const { dbPool, http504Pct, ramLoadPct, liveError } = telemetry;

  return (
    <section className="h-full rounded-lg border border-oaa-line bg-oaa-panel p-4">
      <header className="flex items-start justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-oaa-muted">
          Bento 1 // Live Telemetry &amp; Baseline
        </h2>
        <span className="shrink-0 rounded border border-oaa-green/40 bg-oaa-green/10 px-2 py-0.5 font-mono text-[10px] text-oaa-green">
          MCP Read-Only
        </span>
      </header>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Metric label="DB Pool" value={`${dbPool.used}/${dbPool.max}`} tone="text-oaa-red" />
        <Metric label="HTTP 504s" value={`${http504Pct}%`} tone="text-oaa-amber" />
        <Metric label="RAM Load" value={`${ramLoadPct}%`} tone="text-oaa-text" />
      </div>

      <div className="mt-4 rounded-md border border-oaa-line bg-oaa-raised p-3 font-mono text-xs">
        <div className="text-oaa-muted">{"// Last Healthy Request (2h ago):"}</div>
        <div className="mt-2 text-oaa-green">
          ✓ {lastResolved.incidentId} ({lastResolved.summary})
        </div>
        {liveError && <div className="mt-1 text-oaa-red">✕ LIVE ERR: {liveError}</div>}
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-md border border-oaa-line bg-oaa-raised p-3 text-center">
      <div className="font-mono text-[10px] uppercase text-oaa-muted">{label}</div>
      <div className={`mt-1 font-mono text-xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}