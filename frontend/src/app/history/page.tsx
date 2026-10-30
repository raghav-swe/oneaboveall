"use client";
import { useEffect, useState } from "react";
import { dagNodes, replaySteps, tickets } from "@/lib/mockData";
import TicketList from "@/components/history/TicketList";
import DagCanvas from "@/components/history/DagCanvas";

export default function Page() {
  const [selectedId, setSelectedId] = useState(tickets[1].id);
  const [selectedNodeId, setSelectedNodeId] = useState("n8");
  const [revealedCount, setRevealedCount] = useState(replaySteps.length);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { if (!playing) return; const timer = window.setInterval(() => setRevealedCount(n => { if (n >= replaySteps.length) { setPlaying(false); return n; } return n + 1; }), 650); return () => window.clearInterval(timer); }, [playing]);
  const selected = dagNodes.find(n => n.id === selectedNodeId) ?? dagNodes[0];
  return <div className="space-y-5"><header className="flex flex-wrap items-end justify-between gap-4"><div><div className="eyebrow">flight recorder · immutable event log</div><h1 className="mt-2 font-display text-4xl font-semibold tracking-[-.05em]">Blackbox history</h1><p className="mt-2 text-sm text-[var(--muted)]">Replay decisions, inspect agent traces, and understand every intervention.</p></div><div className="data text-[var(--muted)]">14 INCIDENTS · 30 DAYS</div></header>
    <div className="grid gap-4 lg:grid-cols-12"><div className="lg:col-span-3"><TicketList selectedId={selectedId} onSelect={setSelectedId}/><div className="panel mt-4 p-4"><div className="eyebrow">Investigation filters</div><div className="mt-3 flex flex-wrap gap-2"><span className="tag tag-good">All services</span><span className="tag">Needs review</span><span className="tag">Auto-healed</span></div></div></div>
      <section className="lg:col-span-6"><div className="panel overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-4"><div><h2 className="section-title">Decision graph</h2><p className="section-sub">{selectedId} · node replay</p></div><div className="flex gap-2"><button className="btn" onClick={()=>setRevealedCount(Math.max(0,revealedCount-1))}>←</button><button className="btn btn-primary" onClick={()=>setPlaying(!playing)}>{playing?"Pause":"Replay"}</button><button className="btn" onClick={()=>setRevealedCount(Math.min(replaySteps.length,revealedCount+1))}>→</button></div></div><DagCanvas selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} revealedCount={revealedCount}/><div className="flex justify-between border-t border-[var(--line)] px-4 py-3 data text-[var(--muted)]"><span>STEP {Math.min(revealedCount,replaySteps.length)} / {replaySteps.length}</span><span>{playing?"REPLAYING":"PAUSED"} · click any node to inspect</span></div></div></section>
      <aside className="panel panel-pad h-fit lg:col-span-3"><div className="flex justify-between"><div><div className="eyebrow">node inspector</div><h2 className="mt-2 section-title">{selected.label}</h2></div><span className="tag tag-good">{selected.state}</span></div><div className="mt-6 space-y-4 text-xs"><div><div className="eyebrow">Status</div><p className="mt-1">{selected.status}</p></div><div><div className="eyebrow">Duration</div><p className="mt-1 data">00:00:02.84</p></div><div><div className="eyebrow">Evidence</div><p className="mt-1 leading-relaxed text-[var(--muted)]">Agent traces and tool responses are signed and stored with this flight. No external mutation was made during replay.</p></div></div><button className="btn mt-6 w-full">Open raw event log</button></aside>
    </div></div>;
}
