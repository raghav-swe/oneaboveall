"use client";
import { useState } from "react";
import { liveIncident, lastResolved } from "@/lib/mockData";
import LiveTelemetry from "@/components/dashboard/LiveTelemetry";

function Metric({ label, value, note, tone = "" }: { label: string; value: string; note: string; tone?: string }) {
  return <div className="panel panel-pad reveal"><div className="eyebrow">{label}</div><div className={`metric-number mt-3 ${tone}`}>{value}</div><div className="mt-2 text-[11px] text-[var(--muted)]">{note}</div></div>;
}
export default function Page() {
  const [picked, setPicked] = useState("Postgres lock · checkout-worker");
  const [action, setAction] = useState<"idle"|"approved">("idle");
  const { telemetry, verdicts, hitl, blast, nodes } = liveIncident;
  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-4 reveal">
      <div><div className="eyebrow flex items-center gap-2"><span className="live-dot pulse" /> live operations · updated just now</div><h1 className="mt-2 font-display text-4xl font-semibold tracking-[-.05em] md:text-5xl">Good afternoon, Naitik.</h1><p className="mt-2 text-sm text-[var(--muted)]">Your agents are watching <b className="text-[var(--text)]">3 services</b> across production.</p></div>
      <div className="flex gap-2"><button className="btn">Export report</button><button className="btn btn-primary">＋ New simulation</button></div>
    </header>
    <section className="panel flex flex-wrap items-center gap-3 p-3">
      <span className="tag tag-warn">● TIER 2 · HITL PAUSED</span><span className="data">{liveIncident.incidentId}</span><span className="text-sm text-[var(--muted)]">{picked}</span><span className="ml-auto data text-[var(--accent)]">SLA {liveIncident.slaElapsedSec.toFixed(2)}s / {liveIncident.slaLimitSec}s</span>
      <select aria-label="Select incident simulation" value={picked} onChange={e => setPicked(e.target.value)} className="btn bg-transparent"><option>Postgres lock · checkout-worker</option><option>Redis OOM · auth-cache</option><option>KeyError · payment-api</option></select>
    </section>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Incidents resolved" value="128" note="+18.4% from last week" tone="text-[var(--good)]"/><Metric label="Mean time to heal" value="4.1s" note="↓ 1.8s faster than baseline"/><Metric label="Agent confidence" value="94.8%" note="Across 38 decisions" tone="text-[var(--accent)]"/><Metric label="Open interventions" value="02" note="1 needs your attention" tone="text-[var(--warn)]"/>
    </div>
    <div className="grid gap-4 xl:grid-cols-12">
      <section className="panel panel-pad xl:col-span-7"><LiveTelemetry telemetry={telemetry} /></section>
      <section className="panel panel-pad xl:col-span-5"><div className="flex justify-between"><div><h2 className="section-title">Agent consensus</h2><p className="section-sub">Three models, one safe decision</p></div><span className="tag tag-good">94% aligned</span></div><div className="mt-5 space-y-3">{verdicts.map(v=><div key={v.vendor} className="rounded-lg border border-[var(--line)] p-3"><div className="flex justify-between"><b className="text-xs">{v.vendor}</b><span className="eyebrow">{v.role}</span></div><p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{v.text}</p></div>)}</div></section>
    </div>
    <div className="grid gap-4 lg:grid-cols-12">
      <section className="panel panel-pad lg:col-span-7"><div className="flex justify-between"><div><h2 className="section-title">Human intervention required</h2><p className="section-sub">{hitl.service} · {hitl.rootCause}</p></div><span className="tag tag-warn">BLAST {Math.round(blast.score*100)}%</span></div><div className="mt-5 rounded-lg bg-[var(--surface-2)] p-4"><div className="eyebrow">Proposed safe command</div><code className="mt-2 block text-xs text-[var(--accent)]">{hitl.command}</code><div className="mt-3 flex items-center gap-2 text-xs text-[var(--good)]">✓ Sandbox dry-run passed in {hitl.sandboxDryRun.ms}ms</div></div><div className="mt-4 flex gap-2"><button className="btn btn-primary" onClick={()=>setAction("approved")}>{action==="approved"?"✓ Approved":"Approve & execute"}</button><button className="btn">Request review</button></div></section>
      <section className="panel panel-pad lg:col-span-5"><h2 className="section-title">Blast radius</h2><p className="section-sub">Safety gate · threshold 40%</p><div className="mt-5 flex items-center gap-5"><div className="grid h-24 w-24 place-items-center rounded-full border-[9px] border-[var(--danger)]/20 border-t-[var(--danger)] text-center"><b className="text-xl">{Math.round(blast.score*100)}%</b></div><div className="text-xs text-[var(--muted)]"><p><b className="text-[var(--text)]">High impact</b><br/>Stateful primary database</p><p className="mt-3">Tier 2 policy engaged</p></div></div><div className="mt-5"><div className="flex justify-between text-[11px] text-[var(--muted)]"><span>safe</span><span>threshold</span><span>critical</span></div><div className="bar mt-2"><i style={{width:`${blast.score*100}%`,background:"var(--danger)"}} /></div></div></section>
    </div>
    <section className="panel panel-pad"><div className="flex items-center justify-between"><div><h2 className="section-title">Workflow activity</h2><p className="section-sub">Current incident · {nodes.filter(n=>n.state==="done").length} nodes completed</p></div><button className="btn">View blackbox →</button></div><div className="mt-5 flex min-w-[600px] items-start">{nodes.map((node,i)=><div key={node.id} className="relative flex-1 text-center"><div className={`mx-auto grid h-8 w-8 place-items-center rounded-full border-2 text-xs ${node.state==="done"?"border-[var(--good)] bg-[var(--good)]/10 text-[var(--good)]":"border-[var(--line)] text-[var(--muted)]"}`}>{node.state==="done"?"✓":node.id}</div><div className="mt-2 text-[10px] text-[var(--muted)]">{node.label}</div>{i<nodes.length-1&&<i className="absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-4 border-t border-dashed border-[var(--line)]"/>}</div>)}</div></section>
    <div className="flex items-center gap-2 text-xs text-[var(--muted)]"><span className="live-dot" /> Last resolved: <b className="text-[var(--text)]">{lastResolved.incidentId}</b> · {lastResolved.summary}</div>
  </div>;
}
