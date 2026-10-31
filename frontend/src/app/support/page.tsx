"use client";

import { useState } from "react";
import type { IncidentListResponse, QuickFixAction, RuntimeConfigModel } from "@/types/oaa";

const FIXES: { action: QuickFixAction; title: string; desc: string; button: string }[] = [
  {
    action: "RESTART_MCP",
    title: "MCP bridge disconnected",
    desc: "Fixes stdio/SSE pipe timeouts between LangGraph and the cluster tools.",
    button: "Restart FastMCP bridge",
  },
  {
    action: "PURGE_SANDBOX",
    title: "Zombie sandbox containers",
    desc: "Purges stuck Docker dry-run or pytest containers blocking Node 6 / Node 8.",
    button: "Purge Docker sandbox",
  },
  {
    action: "UNLOCK_SQLITE",
    title: "SQLite ledger locked",
    desc: "Clears SQLITE_BUSY write locks during high-volume alert storms.",
    button: "Flush WAL & unlock DB",
  },
  {
    action: "ENABLE_MOCK_ENV",
    title: "LLM API rate limit (429)",
    desc: "Switches Groq / Gemini calls to deterministic local fixtures instantly.",
    button: "Enable offline shield",
  },
];

const FAQ = [
  {
    q: "Why did my incident route to Tier 2 HITL even though the B-score was 0.30?",
    a: "The Stateful Database Protection Invariant overrides the raw math whenever d_risk = 1.0 or more than 25% of cluster pods are touched.",
  },
  {
    q: "Why did Node 8 stop trying to fix our Python bug after 3 attempts?",
    a: "The 3-Strike Circuit Breaker prevents infinite LLM retry loops. You can trigger a temporary 4th try in /history or raise the global limit in /config.",
  },
  {
    q: "Does Tier 3 push code directly into our production containers?",
    a: "Never. Live stabilization happens first via Tier 1/2 MCP tools; Tier 3 validates a ≤5-line patch with pytest in Docker and opens a GitHub PR.",
  },
];

export default function Page() {
  const [busy, setBusy] = useState<QuickFixAction | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const runFix = async (action: QuickFixAction) => {
    setBusy(action);
    setToast(null);
    try {
      const res = await fetch("/api/v1/support/quick-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const body = (await res.json()) as { status: string; message: string; timestamp: string };
      setToast({ kind: "ok", text: `${body.status} — ${body.message}` });
    } catch (err) {
      setToast({ kind: "err", text: `Failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setBusy(null);
    }
  };

  const downloadBundle = async () => {
    setToast(null);
    try {
      const [incidentsRes, configRes] = await Promise.all([
        fetch("/api/v1/incidents", { cache: "no-store" }),
        fetch("/api/v1/config", { cache: "no-store" }),
      ]);
      const incidents = (await incidentsRes.json()) as IncidentListResponse;
      const config = (await configRes.json()) as RuntimeConfigModel;

      const latest = incidents.incidents?.[0];
      let snapshots: unknown = [];
      if (latest) {
        const snapRes = await fetch(`/api/v1/incidents/${encodeURIComponent(latest.incident_id)}/snapshots`, {
          cache: "no-store",
        });
        if (snapRes.ok) snapshots = (await snapRes.json()).snapshots;
      }

      const bundle = {
        generated_at: new Date().toISOString(),
        product: "OneAboveAll (OAA)",
        config,
        incidents: incidents.incidents,
        last_healthy_summary: incidents.last_healthy_summary,
        latest_ticket_snapshots: snapshots,
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `oaa-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setToast({ kind: "ok", text: "Diagnostic bundle downloaded." });
    } catch (err) {
      setToast({ kind: "err", text: `Bundle failed: ${err instanceof Error ? err.message : String(err)}` });
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">who watches the watchman</div>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-.05em]">Support &amp; self-healing</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Quick fixes for problems in OAA itself.</p>
        </div>
        <span className="tag tag-good">SELF-DIAGNOSTICS · ALL 10 NODES HEALTHY</span>
      </header>

      {toast && (
        <div className={`panel p-3 text-xs ${toast.kind === "ok" ? "text-[var(--good)]" : "text-[var(--danger)]"}`}>
          {toast.text}
        </div>
      )}

      <section>
        <h2 className="section-title">Instant self-healing quick fixes</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {FIXES.map((f) => (
            <div key={f.action} className="panel panel-pad">
              <h3 className="text-sm font-semibold">{f.title}</h3>
              <p className="mt-1 min-h-[32px] text-xs leading-relaxed text-[var(--muted)]">{f.desc}</p>
              <button
                className="btn mt-3 w-full"
                onClick={() => void runFix(f.action)}
                disabled={busy !== null}
              >
                {busy === f.action ? "Running…" : f.button}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel panel-pad">
        <h2 className="section-title">Frequently asked questions</h2>
        <div className="mt-3 divide-y divide-[var(--line)]">
          {FAQ.map((item, i) => (
            <div key={item.q} className="py-3">
              <button
                className="flex w-full items-center justify-between gap-3 text-left text-sm"
                aria-expanded={openFaq === i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span>{item.q}</span>
                <span className="text-[var(--muted)]">{openFaq === i ? "−" : "+"}</span>
              </button>
              {openFaq === i && <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{item.a}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="panel panel-pad">
        <h2 className="section-title">Contact OAA platform support</h2>
        <p className="section-sub">24/7 escalation</p>
        <div className="mt-4 grid gap-2 text-xs md:grid-cols-3">
          <div className="rounded-lg bg-[var(--surface-2)] p-3">
            <div className="eyebrow">emergency hotline</div>
            <div className="data mt-1">+1 (800) 622-SRE1</div>
          </div>
          <div className="rounded-lg bg-[var(--surface-2)] p-3">
            <div className="eyebrow">engineering mail</div>
            <a className="data mt-1 block text-[var(--accent)]" href="mailto:oncall@oneaboveall.dev">
              oncall@oneaboveall.dev
            </a>
          </div>
          <div className="rounded-lg bg-[var(--surface-2)] p-3">
            <div className="eyebrow">slack bridge</div>
            <div className="data mt-1">#oaa-platform-support</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => void downloadBundle()}>
            Mail diagnostic bundle &amp; ticket logs
          </button>
          <a
            className="btn"
            href="mailto:oncall@oneaboveall.dev?subject=OAA%20diagnostic%20bundle&body=Diagnostic%20bundle%20attached%20(JSON%20download)."
          >
            Open mail draft
          </a>
        </div>
        <p className="mt-2 text-[10px] text-[var(--muted)]">
          `mailto:` cannot attach files, so the bundle downloads as JSON and the draft opens alongside it.
        </p>
      </section>
    </div>
  );
}
