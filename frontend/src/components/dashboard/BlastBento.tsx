import { liveIncident } from "@/lib/mockData";

export default function BlastBento() {
  const { blast, queuedNext } = liveIncident;
  const isHigh = blast.score > blast.tier1Max;
  const safePct = Math.min(blast.score, blast.tier1Max) * 100;
  const overPct = Math.max(0, Math.min(blast.score, 1) - blast.tier1Max) * 100;

  return (
    <section className="h-full rounded-lg border border-oaa-line bg-oaa-panel p-4">
      <header className="flex items-start justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-oaa-muted">
          Bento 4 // Blast Radius &amp; PR Queue
        </h2>
        <span
          className={`shrink-0 font-mono text-sm font-bold ${
            isHigh ? "text-oaa-amber" : "text-oaa-green"
          }`}
        >
          B = {blast.score.toFixed(2)} ({isHigh ? "HIGH" : "SAFE"})
        </span>
      </header>

      <div className="mt-4 rounded-md border border-oaa-line bg-oaa-raised p-3">
        <div className="flex justify-between font-mono text-[11px]">
          <span className="text-oaa-muted">
            Tier 1 Safe (≤{blast.tier1Max.toFixed(2)})
          </span>
          <span className={isHigh ? "text-oaa-amber" : "text-oaa-green"}>
            Current: {blast.score.toFixed(2)}
          </span>
        </div>

        <div
          className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-oaa-line"
          role="img"
          aria-label={`Blast radius ${blast.score} against Tier 1 limit ${blast.tier1Max}`}
        >
          <div className="bg-oaa-green" style={{ width: `${safePct}%` }} />
          <div className="bg-oaa-amber" style={{ width: `${overPct}%` }} />
        </div>

        <div className="mt-2 font-mono text-[11px] text-oaa-muted">
          Ratio: {blast.ratio.toFixed(1)} | D_risk: {blast.dRisk.toFixed(1)} (DB) | P_rev:{" "}
          {blast.pRev.toFixed(1)}
        </div>
      </div>

      {queuedNext && (
        <div className="mt-4 rounded-md border border-oaa-violet/50 bg-oaa-violet/10 p-3 font-mono text-xs text-oaa-violet">
          Queued Next: {queuedNext}
        </div>
      )}
    </section>
  );
}