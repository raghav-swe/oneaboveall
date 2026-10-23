"use client";

/**
 * Bento 4 — Blast Radius Gauge & PR Queue (CONTEXT.md §4.1, ARCHITECTURE §3.1).
 *
 * Renders the semi-circular gauge for the deterministic blast-radius score
 *
 *     B = 0.40 · (N_affected / N_total) + 0.40 · D_risk + 0.20 · P_reversibility
 *
 * with the full term breakdown, the selected tier, and the status of the
 * queued Tier 3 GitOps pull request.
 */

import { Gauge, GitPullRequest } from "lucide-react";

import { useOAA } from "@/context/OAAContext";

const ARC_PATH = "M 20 100 A 80 80 0 0 1 180 100";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

export default function BlastRadiusBento() {
  const { state, config } = useOAA();

  const score = state.blast_radius_score ?? 0;
  const decision = state.arbiter_decision ?? {};
  const affected = decision.affected_pods ?? 0;
  const total = decision.total_pods ?? 0;
  const dRisk = decision.d_risk ?? 0;
  const pReversibility = decision.p_reversibility ?? 0;
  const ratio = total > 0 ? affected / total : 0;

  const ratioTerm = 0.4 * ratio;
  const riskTerm = 0.4 * dRisk;
  const reversibilityTerm = 0.2 * pReversibility;

  const threshold = config?.blast_threshold ?? 0.4;
  const hasVerdict = Object.keys(decision).length > 0;
  const breached = hasVerdict && score > threshold;

  const arcColor = !hasVerdict
    ? "#334155"
    : breached
      ? "#ef4444"
      : score > threshold * 0.75
        ? "#f59e0b"
        : "#22c55e";

  const patch = state.patch_bundle;
  const tier = state.selected_tier;

  return (
    <section className="flex h-full flex-col rounded-lg border border-oaa-border bg-oaa-panel">
      <header className="flex items-center gap-2 border-b border-oaa-border px-4 py-2.5">
        <Gauge className="h-3.5 w-3.5 text-oaa-accent" />
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">
          Blast Radius &amp; PR Queue
        </h2>
        <span className="ml-auto font-mono text-[10px] text-slate-600">
          {hasVerdict ? (tier || "GATED") : "AWAITING VERDICT"}
        </span>
      </header>

      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-3">
        {/* Semi-circular gauge */}
        <div className="flex flex-col items-center justify-center">
          <svg viewBox="0 0 200 115" className="w-full max-w-[260px]">
            <path
              d={ARC_PATH}
              fill="none"
              stroke="#1b2437"
              strokeWidth="16"
              strokeLinecap="round"
              pathLength={100}
            />
            {hasVerdict && (
              <path
                d={ARC_PATH}
                fill="none"
                stroke={arcColor}
                strokeWidth="16"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={`${clamp01(score) * 100} 100`}
                className="transition-[stroke-dasharray] duration-500"
              />
            )}
            <text x="100" y="88" textAnchor="middle" className="fill-slate-100 font-mono text-3xl">
              {hasVerdict ? score.toFixed(2) : "—"}
            </text>
            <text x="100" y="106" textAnchor="middle" className="fill-slate-500 font-mono text-[10px]">
              B-SCORE
            </text>
            <text x="16" y="112" className="fill-slate-600 font-mono text-[9px]">
              0.00
            </text>
            <text x="168" y="112" className="fill-slate-600 font-mono text-[9px]">
              1.00
            </text>
          </svg>
          <p className="mt-1 font-mono text-[11px] text-slate-500">
            threshold <span className="text-slate-300">B &gt; {threshold.toFixed(2)}</span> → Tier 2
          </p>
        </div>

        {/* Formula breakdown */}
        <div className="space-y-2">
          <p className="font-mono text-[11px] text-slate-400">
            B = 0.4·ratio + 0.4·D + 0.2·P
          </p>
          <ul className="space-y-1.5 font-mono text-[11px]">
            <li className="flex items-baseline justify-between gap-2">
              <span className="text-slate-500">0.4 · ratio</span>
              <span className="text-slate-400">
                0.4 × {affected}/{total || "?"} = {ratioTerm.toFixed(3)}
              </span>
            </li>
            <li className="flex items-baseline justify-between gap-2">
              <span className="text-slate-500">0.4 · D (data risk)</span>
              <span className="text-slate-400">
                0.4 × {dRisk.toFixed(1)} = {riskTerm.toFixed(3)}
              </span>
            </li>
            <li className="flex items-baseline justify-between gap-2">
              <span className="text-slate-500">0.2 · P (reversibility)</span>
              <span className="text-slate-400">
                0.2 × {pReversibility.toFixed(1)} = {reversibilityTerm.toFixed(3)}
              </span>
            </li>
            <li className="mt-2 flex items-baseline justify-between gap-2 border-t border-oaa-border pt-2">
              <span className="text-slate-400">Σ B</span>
              <span className={`font-semibold ${breached ? "text-red-400" : "text-slate-200"}`}>
                {hasVerdict ? score.toFixed(3) : "—"}
              </span>
            </li>
          </ul>

          {hasVerdict && (
            <div className="rounded-md border border-oaa-border bg-oaa-bg/60 p-2.5 font-mono text-[10px] leading-relaxed text-slate-500">
              <p>
                tool:{" "}
                <span className="text-slate-300">
                  {decision.mcp_tool_name ?? "—"}
                </span>
              </p>
              <p>
                command:{" "}
                <span className="break-all text-slate-300">
                  {decision.command_to_run ?? "—"}
                </span>
              </p>
              <p>
                tier:{" "}
                <span className={tier === "TIER_2_HITL" ? "text-oaa-amber" : "text-emerald-400"}>
                  {tier || "—"}
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Tier 3 PR queue */}
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-slate-500">
            <GitPullRequest className="h-3.5 w-3.5" />
            Tier 3 PR queue
          </p>

          {!decision.is_code_bug ? (
            <p className="text-[11px] leading-relaxed text-slate-600">
              {hasVerdict
                ? "is_code_bug = false — infra-only incident, no pull request required."
                : "Waiting for the Arbiter verdict…"}
            </p>
          ) : patch ? (
            <div className="space-y-1.5 rounded-md border border-oaa-border bg-oaa-bg/60 p-2.5 font-mono text-[10px]">
              <p className="text-slate-500">file</p>
              <p className="break-all text-slate-300">{patch.file_path || "—"}</p>
              <p className="text-slate-500">strikes</p>
              <p className="text-slate-300">
                {patch.strike_count}/{state.max_strikes ?? 3} ·{" "}
                {patch.pytest_passed ? "pytest PASS" : "pytest pending/failing"}
              </p>
              <p className="text-slate-500">status</p>
              {patch.pr_url ? (
                <a
                  href={patch.pr_url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-oaa-accent underline underline-offset-2"
                >
                  {patch.pr_url}
                </a>
              ) : (
                <p className="text-oaa-amber">PR withheld — strike limit reached</p>
              )}
            </div>
          ) : (
            <p className="text-[11px] leading-relaxed text-oaa-amber">
              is_code_bug = true — a Tier 3 pull request is queued after live
              stabilization (Node 8).
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
