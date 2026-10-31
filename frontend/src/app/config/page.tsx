"use client";

import { useEffect, useState } from "react";
import { useOAA } from "@/context/OAAContext";
import type { RuntimeConfigModel, ToolKey } from "@/types/oaa";

const READ_ONLY: { key: ToolKey; label: string }[] = [
  { key: "get_pod_metrics", label: "get_pod_metrics" },
  { key: "get_container_logs", label: "get_container_logs" },
  { key: "get_cluster_topology", label: "get_cluster_topology" },
];

const MUTATING: { key: ToolKey; label: string; note: string }[] = [
  { key: "restart_pod", label: "restart_pod", note: "Tier 1 auto allowed" },
  { key: "kill_db_pid", label: "kill_db_pid", note: "stateful DB · Tier 2 only" },
  { key: "flush_redis_cache", label: "flush_redis_cache", note: "cache invalidation" },
];

export default function Page() {
  const { config, refreshConfig, demoMode } = useOAA();
  const [draft, setDraft] = useState<RuntimeConfigModel | null>(config);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (config) setDraft(config);
  }, [config]);

  useEffect(() => {
    if (!config) void refreshConfig();
  }, [config, refreshConfig]);

  const persist = async (next: RuntimeConfigModel) => {
    const previous = draft;
    setDraft(next); // optimistic
    setSaving(true);
    setMessage(null);

    // Offline demo (e.g. Vercel): keep the optimistic value so the control
    // room stays interactive instead of rolling back to a value the user
    // just changed.
    if (demoMode) {
      setSaving(false);
      setMessage({ kind: "ok", text: "Configuration committed — applies to all future runs." });
      return;
    }

    try {
      const res = await fetch("/api/v1/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const saved = (await res.json()) as RuntimeConfigModel;
      setDraft(saved);
      await refreshConfig();
      setMessage({ kind: "ok", text: "Configuration committed — applies to all future runs." });
    } catch (err) {
      setDraft(previous); // rollback
      setMessage({ kind: "err", text: `Save failed, rolled back: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setSaving(false);
    }
  };

  if (!draft) {
    return (
      <div className="panel panel-pad">
        <p className="text-sm text-[var(--muted)]">Loading governance config…</p>
      </div>
    );
  }

  const threshold = draft.blast_threshold;
  const preset = threshold <= 0.2 ? "Strict HITL" : threshold >= 0.7 ? "High autonomy" : "Balanced";

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">role · platform_architect</div>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-.05em]">Control plane governance</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Changes committed here apply permanently across all future incident runs.
          </p>
        </div>
        <span className={saving ? "tag tag-warn" : "tag tag-good"}>{saving ? "SAVING…" : "IN SYNC"}</span>
      </header>

      {message && (
        <div className={`panel p-3 text-xs ${message.kind === "ok" ? "text-[var(--good)]" : "text-[var(--danger)]"}`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        {/* 1. Authority slider */}
        <section className="panel panel-pad lg:col-span-7">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="section-title">Autonomous authority &amp; blast radius gate</h2>
              <p className="section-sub">
                Lower = more human gates. Raise = broader Tier 1 autonomy.
              </p>
            </div>
            <span className="tag tag-warn">Threshold B ≤ {threshold.toFixed(2)}</span>
          </div>

          <input
            type="range"
            min={0.15}
            max={0.75}
            step={0.01}
            value={threshold}
            aria-label="Blast radius threshold"
            onChange={(e) => setDraft({ ...draft, blast_threshold: Number(e.target.value) })}
            onMouseUp={(e) => void persist({ ...draft, blast_threshold: Number((e.target as HTMLInputElement).value) })}
            onTouchEnd={(e) => void persist({ ...draft, blast_threshold: Number((e.target as HTMLInputElement).value) })}
            className="mt-6 w-full accent-[var(--accent)]"
          />
          <div className="mt-2 flex justify-between font-mono text-[10px] text-[var(--muted)]">
            <button onClick={() => void persist({ ...draft, blast_threshold: 0.15 })}>Strict HITL 0.15</button>
            <button onClick={() => void persist({ ...draft, blast_threshold: 0.4 })}>Balanced 0.40</button>
            <button onClick={() => void persist({ ...draft, blast_threshold: 0.75 })}>High autonomy 0.75</button>
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Active preset: <b className="text-[var(--text)]">{preset}</b>
          </p>

          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs">
              <span>Hard-lock stateful DB mutations to Tier 2</span>
              <span className="tag tag-good">ENFORCED</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs">
              <span>Max cluster pods in Tier 1 auto-scale ≤ 25%</span>
              <span className="tag tag-good">ENFORCED</span>
            </div>
          </div>
        </section>

        {/* 2. Circuit breaker */}
        <section className="panel panel-pad lg:col-span-5">
          <h2 className="section-title">Global circuit breaker policy</h2>
          <p className="section-sub">Nodes 6 &amp; 8 · consecutive failures before write permission is revoked</p>
          <div className="mt-6 grid grid-cols-4 gap-2">
            {[2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => void persist({ ...draft, global_max_strikes: n })}
                className={`rounded-md border px-2 py-3 font-mono text-xs transition-colors ${
                  draft.global_max_strikes === n
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--line)] text-[var(--muted)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {n}
                <div className="mt-1 text-[9px]">{n === 3 ? "STD" : n === draft.global_max_strikes ? "ACTIVE" : "—"}</div>
              </button>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-[var(--muted)]">
            Permanently configures how many consecutive sandbox/tool failures are tolerated. The one-ticket 4th try in
            <b className="text-[var(--text)]"> /history</b> is a separate, scoped exception.
          </p>
        </section>
      </div>

      {/* 3. MCP matrix */}
      <section className="panel panel-pad">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="section-title">FastMCP tool permission matrix</h2>
            <p className="section-sub">Zero privilege escalation · mutating tools are Node 7 only</p>
          </div>
          <span className="tag tag-warn">ZERO PRIVILEGE</span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <div className="eyebrow">read-only diagnostics · nodes 1,2,3</div>
            <div className="mt-2 space-y-2">
              {READ_ONLY.map((tool) => (
                <ToolRow
                  key={tool.key}
                  label={tool.label}
                  note="read-only"
                  enabled={draft.enabled_tools[tool.key]}
                  onToggle={(v) => void persist({ ...draft, enabled_tools: { ...draft.enabled_tools, [tool.key]: v } })}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="eyebrow">mutating execution · node 7 only</div>
            <div className="mt-2 space-y-2">
              {MUTATING.map((tool) => (
                <ToolRow
                  key={tool.key}
                  label={tool.label}
                  note={tool.note}
                  enabled={draft.enabled_tools[tool.key]}
                  onToggle={(v) => void persist({ ...draft, enabled_tools: { ...draft.enabled_tools, [tool.key]: v } })}
                />
              ))}
            </div>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-[var(--muted)]">
          Disabling a tool makes subsequent runs fail loudly — the firewall raises a <code className="data">PermissionError</code> that
          surfaces on the incident SSE stream.
        </p>
      </section>

      {/* 4. LLM routing + offline shield */}
      <section className="panel panel-pad">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="section-title">Tri-vendor LLM routing &amp; offline shield</h2>
            <p className="section-sub">Forensics · FinOps · Arbiter</p>
          </div>
          <button
            onClick={() => void persist({ ...draft, mock_env: !draft.mock_env })}
            className={`rounded-md border px-3 py-2 text-xs ${
              draft.mock_env
                ? "border-[var(--good)] bg-[var(--good)]/10 text-[var(--good)]"
                : "border-[var(--warn)] bg-[var(--warn)]/10 text-[var(--warn)]"
            }`}
          >
            MOCK_ENV {draft.mock_env ? "ON" : "OFF"}
          </button>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {[
            { role: "Forensics (N2)", model: "llama-3.3-70b-versatile" },
            { role: "FinOps (N3)", model: "openai/gpt-oss-120b" },
            { role: "Arbiter (N4)", model: "gemini-2.5-flash" },
          ].map((r) => (
            <div key={r.role} className="rounded-lg bg-[var(--surface-2)] p-3">
              <div className="eyebrow">{r.role}</div>
              <div className="data mt-1 text-[var(--accent)]">{r.model}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ToolRow({
  label,
  note,
  enabled,
  onToggle,
}: {
  label: string;
  note: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[var(--surface-2)] px-3 py-2">
      <div>
        <div className="data">{label}</div>
        <div className="text-[10px] text-[var(--muted)]">{note}</div>
      </div>
      <button
        role="switch"
        aria-checked={enabled}
        aria-label={`Toggle ${label}`}
        onClick={() => onToggle(!enabled)}
        className={`relative h-5 w-9 rounded-full transition-colors ${enabled ? "bg-[var(--good)]" : "bg-[var(--line)]"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${enabled ? "left-[18px]" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}
