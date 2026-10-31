"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DagCanvas, { type PipelineNode, type PipelineState } from "@/components/history/DagCanvas";
import TicketList from "@/components/history/TicketList";
import TicketOverridePanel from "@/components/history/TicketOverridePanel";
import PostMortemModal from "@/components/shared/PostMortemModal";
import type { IncidentRow, IncidentListResponse, NodeSnapshotRow } from "@/types/oaa";

const NODE_NAMES: Record<number, string> = {
  1: "1. Ingestion",
  2: "2. Forensics",
  3: "3. FinOps",
  4: "4. Arbiter",
  5: "5. Blast Gate",
  6: "6. Sandbox",
  7: "7. Execution",
  8: "8. GitOps PR",
  9: "9. Reporting",
  10: "10. Ledger",
};

const TERMINAL = new Set(["RESOLVED", "HALTED_STRIKES", "HALTED", "HALTED_EXECUTION"]);

type TierFilter = "ALL" | "T1" | "T2" | "T3";

export default function Page() {
  const [tickets, setTickets] = useState<IncidentRow[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [tierFilter, setTierFilter] = useState<TierFilter>("ALL");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<NodeSnapshotRow[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);

  const [revealedCount, setRevealedCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(8);
  const [modalOpen, setModalOpen] = useState(false);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const loadTickets = useCallback(async (keepSelection = true) => {
    const res = await fetch("/api/v1/incidents", { cache: "no-store" });
    if (!res.ok) return;
    const body = (await res.json()) as IncidentListResponse;
    const rows = body.incidents ?? [];
    setTickets(rows);
    setLoadingTickets(false);
    if (!keepSelection || !selectedIdRef.current) {
      setSelectedId(rows[0]?.incident_id ?? null);
    }
  }, []);

  const loadSnapshots = useCallback(async (incidentId: string) => {
    setLoadingSnapshots(true);
    try {
      const res = await fetch(`/api/v1/incidents/${encodeURIComponent(incidentId)}/snapshots`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setSnapshots([]);
        return;
      }
      const body = (await res.json()) as { snapshots: NodeSnapshotRow[] };
      setSnapshots(body.snapshots ?? []);
      setRevealedCount(body.snapshots?.length ?? 0); // page starts fully lit
      // Focus the most recent node in the chain (Node 8 for halted tickets).
      const rows = body.snapshots ?? [];
      setSelectedNodeId(rows.length ? rows[rows.length - 1].node_id : 1);
    } finally {
      setLoadingSnapshots(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets(false);
  }, [loadTickets]);

  useEffect(() => {
    if (!selectedId) return;
    setPlaying(false);
    void loadSnapshots(selectedId);
  }, [selectedId, loadSnapshots]);

  // Play loop: advance one snapshot row at a time.
  useEffect(() => {
    if (!playing) return;
    if (revealedCount >= snapshots.length) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setRevealedCount((n) => Math.min(n + 1, snapshots.length)), 700);
    return () => window.clearTimeout(timer);
  }, [playing, revealedCount, snapshots.length]);

  const selected = tickets.find((t) => t.incident_id === selectedId) ?? null;
  const isTerminal = selected ? TERMINAL.has(selected.status) : false;

  /** Node ids that actually appear in this ticket's chronology. */
  const presentNodes = useMemo(() => new Set(snapshots.map((s) => s.node_id)), [snapshots]);

  const nodeStates = useMemo(() => {
    const revealed = snapshots.slice(0, revealedCount);
    const lastIndexByNode = new Map<number, number>();
    revealed.forEach((row, idx) => lastIndexByNode.set(row.node_id, idx));
    const activeNodeId = playing && revealed.length ? revealed[revealed.length - 1].node_id : null;

    return Array.from({ length: 10 }, (_, i) => {
      const id = i + 1;
      let state: PipelineState = "pending";
      const idx = lastIndexByNode.get(id);
      if (idx !== undefined) {
        const row = revealed[idx];
        state = row.status === "HALTED" ? "failed" : "done";
        if (activeNodeId === id) state = row.status === "HALTED" ? "failed" : "active";
      } else if (isTerminal && !presentNodes.has(id)) {
        state = "skipped";
      }
      return { id, label: NODE_NAMES[id], state } as PipelineNode;
    });
  }, [snapshots, revealedCount, playing, isTerminal, presentNodes]);

  /** Inspector: latest revealed snapshot row for the selected node. */
  const inspected = useMemo(() => {
    if (selectedNodeId === null) return null;
    const revealed = snapshots.slice(0, revealedCount);
    const rows = revealed.filter((s) => s.node_id === selectedNodeId);
    return rows.length ? rows[rows.length - 1] : null;
  }, [snapshots, revealedCount, selectedNodeId]);

  const prettyState = useMemo(() => {
    if (!inspected) return null;
    try {
      return JSON.stringify(JSON.parse(inspected.state_json), null, 2);
    } catch {
      return inspected.state_json;
    }
  }, [inspected]);

  const filtered = useMemo(() => {
    if (tierFilter === "ALL") return tickets;
    if (tierFilter === "T1") return tickets.filter((t) => t.selected_tier === "TIER_1_AUTONOMOUS");
    if (tierFilter === "T2") return tickets.filter((t) => t.selected_tier === "TIER_2_HITL");
    return tickets.filter((t) => t.is_code_bug === 1);
  }, [tickets, tierFilter]);

  const step = () => {
    setPlaying(false);
    setRevealedCount((n) => Math.min(n + 1, snapshots.length));
  };
  const rewind = () => {
    setPlaying(false);
    setRevealedCount((n) => Math.max(n - 1, 0));
  };
  const play = () => {
    if (!snapshots.length) return;
    if (revealedCount >= snapshots.length) setRevealedCount(0);
    setPlaying(true);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">flight recorder · immutable event log</div>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-.05em]">Blackbox history</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Replay decisions, inspect agent traces, and understand every intervention.
          </p>
        </div>
        <div className="data text-[var(--muted)]">{tickets.length} tickets · blackbox ledger</div>
      </header>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <div className="panel mb-3 flex flex-wrap gap-1.5 p-2">
            {(["ALL", "T1", "T2", "T3"] as TierFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setTierFilter(f)}
                className={`rounded px-2 py-1 font-mono text-[10px] ${
                  tierFilter === f ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <TicketList
            tickets={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            loading={loadingTickets}
            onOpenReport={() => setModalOpen(true)}
          />
        </div>

        <section className="lg:col-span-6">
          <div className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-4">
              <div>
                <h2 className="section-title">Decision graph</h2>
                <p className="section-sub">{selectedId ?? "no ticket"} · node replay</p>
              </div>
              <div className="flex gap-2">
                <button className="btn" onClick={rewind} disabled={!snapshots.length} aria-label="Step back">
                  ←
                </button>
                <button className="btn btn-primary" onClick={() => (playing ? setPlaying(false) : play())} disabled={!snapshots.length}>
                  {playing ? "⏸ Pause" : "▶ Play"}
                </button>
                <button className="btn" onClick={step} disabled={!snapshots.length} aria-label="Step forward">
                  ⏭ Step
                </button>
              </div>
            </div>

            <DagCanvas nodes={nodeStates} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />

            <div className="flex justify-between border-t border-[var(--line)] px-4 py-3 data text-[var(--muted)]">
              <span>
                STEP {Math.min(revealedCount, snapshots.length)} / {snapshots.length}
              </span>
              <span>{playing ? "REPLAYING" : "PAUSED"} · click any node to inspect</span>
            </div>
          </div>
        </section>

        <aside className="space-y-3 lg:col-span-3">
          <div className="panel panel-pad">
            <div className="flex justify-between">
              <div>
                <div className="eyebrow">node inspector</div>
                <h2 className="section-title mt-2">
                  {selectedNodeId !== null ? NODE_NAMES[selectedNodeId] : "—"}
                </h2>
              </div>
              {inspected && <span className={inspected.status === "HALTED" ? "tag tag-danger" : "tag tag-good"}>{inspected.status}</span>}
            </div>

            {loadingSnapshots ? (
              <p className="mt-4 text-xs text-[var(--muted)]">Loading snapshots…</p>
            ) : inspected ? (
              <div className="mt-4 space-y-3">
                <div>
                  <div className="eyebrow">recorded node</div>
                  <p className="mt-1 text-xs">{inspected.node_name}</p>
                </div>
                <div>
                  <div className="eyebrow">elapsed</div>
                  <p className="data mt-1">{inspected.elapsed_ms} ms</p>
                </div>
                <div>
                  <div className="eyebrow">timestamp</div>
                  <p className="data mt-1 text-[10px]">{inspected.timestamp}</p>
                </div>
                <div>
                  <div className="eyebrow">state_json</div>
                  <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--surface-2)] p-2.5 font-mono text-[9px] leading-relaxed text-[var(--muted)]">
                    {prettyState}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
                {snapshots.length ? "This node has not been reached at the current replay step." : "Select a ticket to load its snapshot chain."}
              </p>
            )}
          </div>

          {selected && (
            <TicketOverridePanel
              incident={selected}
              snapshots={snapshots}
              onRetried={async () => {
                await loadSnapshots(selected.incident_id);
                await loadTickets(true);
              }}
            />
          )}
        </aside>
      </div>

      <PostMortemModal
        open={modalOpen}
        incidentId={selectedId}
        markdown={selected?.final_report_md ?? null}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
