"use client";

import type { IncidentRow } from "@/types/oaa";

interface TicketListProps {
  tickets: IncidentRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenReport: () => void;
  loading?: boolean;
}

export function tierBadges(t: IncidentRow): { text: string; cls: string }[] {
  const out: { text: string; cls: string }[] = [];
  if (t.selected_tier === "TIER_1_AUTONOMOUS") out.push({ text: "T1", cls: "tag tag-good" });
  if (t.selected_tier === "TIER_2_HITL") out.push({ text: "T2", cls: "tag tag-warn" });
  if (t.is_code_bug) out.push({ text: "T3", cls: "tag" });
  if (!out.length) out.push({ text: t.status === "PAUSED_HITL" ? "T2" : "—", cls: "tag" });
  return out;
}

export function statusBadge(t: IncidentRow): { text: string; cls: string } {
  switch (t.status) {
    case "HALTED_STRIKES":
      return { text: `${t.strike_count}/${t.max_strikes_override} STRIKES`, cls: "tag tag-danger" };
    case "HALTED_EXECUTION":
      return { text: "EXEC FAILED", cls: "tag tag-danger" };
    case "PAUSED_HITL":
      return { text: "HITL PAUSED", cls: "tag tag-warn" };
    case "RESOLVED":
      return { text: "RESOLVED", cls: "tag tag-good" };
    default:
      return { text: "RUNNING", cls: "tag" };
  }
}

export default function TicketList({ tickets, selectedId, onSelect, onOpenReport, loading }: TicketListProps) {
  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
        <h2 className="eyebrow">Flight blackbox tickets</h2>
        <span className="data text-[var(--accent)]">{tickets.length} total</span>
      </div>

      <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
        {loading && <p className="p-2 text-xs text-[var(--muted)]">Loading ledger…</p>}
        {!loading && tickets.length === 0 && <p className="p-2 text-xs text-[var(--muted)]">No tickets yet.</p>}

        {tickets.map((t) => {
          const selected = t.incident_id === selectedId;
          const badge = statusBadge(t);
          const danger = t.status.startsWith("HALTED");
          return (
            <button
              key={t.incident_id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(t.incident_id)}
              className={`w-full space-y-1 rounded-md border p-3 text-left transition-colors ${
                selected
                  ? danger
                    ? "border-[var(--danger)] bg-[var(--surface-2)]"
                    : "border-[var(--accent)] bg-[var(--surface-2)]"
                  : "border-[var(--line)] hover:bg-[var(--surface-2)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="data font-semibold">{t.incident_id}</span>
                <span className={badge.cls}>{badge.text}</span>
              </div>
              <div className="text-xs text-[var(--muted)]">
                {t.service} · {t.alert_name}
              </div>
              <div className="flex items-center gap-1.5">
                {tierBadges(t).map((b) => (
                  <span key={b.text} className={b.cls}>
                    {b.text}
                  </span>
                ))}
                {t.blast_radius_score !== null && (
                  <span className="data ml-auto text-[var(--muted)]">B {t.blast_radius_score.toFixed(2)}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onOpenReport}
        disabled={!selectedId}
        className="mt-3 w-full rounded-md border border-[var(--line)] p-2.5 text-xs text-[var(--accent)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-40"
      >
        Open post-mortem markdown
      </button>
    </section>
  );
}
