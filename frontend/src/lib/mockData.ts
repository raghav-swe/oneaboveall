import type { LiveIncident, LastResolved, TicketSummary, GlobalConfig } from "./types";

// All numbers match the spec PDF so screens look identical to the design.

export const lastResolved: LastResolved = {
  incidentId: "INC-4818",
  summary: "Tier 1 Auto-Heal in 4.1s - Morning Digest Ready",
  tier: 1,
  resolvedInSeconds: 4.1,
};

export const liveIncident: LiveIncident = {
  incidentId: "INC-4819",
  service: "checkout-worker",
  cause: "Postgres Lock",
  slaElapsedSec: 3.42,
  slaLimitSec: 20.0,
  telemetry: {
    dbPool: { used: 99, max: 100 },
    http504Pct: 34.2,
    ramLoadPct: 61.8,
    liveError: "PID 4821 ExclusiveLock wait > 14,200ms",
  },
  verdicts: [
    { vendor: "Llama-3.3-70B", role: "Forensics", text: "Kill stuck PID 4821 & scale pods 3->15 immediately!" },
    { vendor: "GPT-OSS-120B", role: "FinOps", text: "Veto 15x scale ($1.8k burn + retry storm). Kill PID 4821 only." },
    { vendor: "Gemini 2.5 Flash", role: "Arbiter", text: "Verdict: Terminate PID 4821 + reload PgBouncer. is_code_bug=True" },
  ],
  hitl: {
    incidentId: "INC-4819",
    service: "checkout-worker",
    rootCause: "Unindexed batch query locked Postgres PID 4821 (99/100 pool saturated).",
    whyHitl: "Touches stateful primary DB (B = 0.84 > 0.40 invariant).",
    command: "SELECT pg_terminate_backend(4821); RELOAD pgbouncer;",
    sandboxDryRun: { passed: true, ms: 140 },
    blastScore: 0.84,
  },
  blast: { score: 0.84, tier1Max: 0.4, ratio: 1.0, dRisk: 1.0, pRev: 0.2 },
  nodes: [
    { id: 1, label: "Ingest", state: "done" },
    { id: 2, label: "Debate", state: "done" },
    { id: 4, label: "Arbiter", state: "done" },
    { id: 5, label: "Blast", state: "done" },
    { id: 6, label: "Sandbox", state: "done", durationMs: 140 },
    { id: 7, label: "Exec", state: "pending" },
    { id: 8, label: "PR", state: "pending" },
  ],
  queuedNext: "Node 8 GitOps PR (is_code_bug=True)",
};

export const tickets: TicketSummary[] = [
  { id: "INC-4815", service: "payment-api", title: "KeyError Patch", badge: "3/3 STRIKES", note: "Tier 3 PR Halted at Sandbox" },
  { id: "INC-4819", service: "checkout-worker", title: "DB Lock 4821", badge: "TIER 2 HITL", note: "Approved by @sre-lead" },
  { id: "INC-4818", service: "auth-cache", title: "Redis OOM Flush", badge: "TIER 1 AUTO", note: "Auto-Healed (Morning Report)" },
];

export const defaultConfig: GlobalConfig = {
  blastThreshold: 0.4,
  maxStrikes: 3,
  mockEnv: false,
  routing: { forensics: "llama-3.3-70b", finops: "gpt-oss-120b", arbiter: "gemini-2.5-flash" },
};
export const totalTickets = 14;

import type { DagNodeInfo, DagEdgeInfo } from "./types";

export const dagNodes: DagNodeInfo[] = [
  { id: "n1", label: "[1] Ingestion Node (0.2s)", x: 170, y: 0, state: "done", status: "Completed" },
  { id: "n2", label: "[2] Forensics (Llama-3.3)", x: 0, y: 90, state: "done", status: "Completed" },
  { id: "n3", label: "[3] FinOps (GPT-120B)", x: 340, y: 90, state: "done", status: "Completed" },
  { id: "n4", label: "[4] Arbiter Consensus (Gemini 2.5)", x: 170, y: 180, state: "done", status: "Completed" },
  { id: "n5", label: "[5] Blast Radius Gate (B = 0.22)", x: 170, y: 270, state: "done", status: "Completed" },
  { id: "trackA", label: "Track A: Tier 1", x: 0, y: 360, state: "done", status: "Track taken" },
  { id: "trackB", label: "Track B: Tier 2", x: 340, y: 360, state: "skipped", status: "Not taken" },
  { id: "n6", label: "[6] Sandbox Dry-Run", x: 0, y: 450, state: "done", status: "Completed" },
  { id: "n7", label: "[7] MCP Execution", x: 340, y: 450, state: "done", status: "Completed" },
  { id: "pr", label: "PR Needed? (YES)", x: 340, y: 540, state: "done", status: "Yes", shape: "diamond" },
  { id: "n8", label: "[8] GitOps PR (3/3 Strikes Halted)", x: 0, y: 540, state: "failed", status: "Circuit Breaker Tripped (Strike 3/3)" },
  { id: "n9", label: "[9] Shared Reporting", x: 0, y: 630, state: "done", status: "Completed" },
  { id: "n10", label: "[10] Flight Ledger Saved", x: 340, y: 630, state: "done", status: "Completed" },
];

export const dagEdges: DagEdgeInfo[] = [
  { id: "e1", source: "n1", target: "n2" },
  { id: "e2", source: "n1", target: "n3" },
  { id: "e3", source: "n2", target: "n4" },
  { id: "e4", source: "n3", target: "n4" },
  { id: "e5", source: "n4", target: "n5" },
  { id: "e6", source: "n5", target: "trackA" },
  { id: "e7", source: "n5", target: "trackB" },
  { id: "e8", source: "trackA", target: "n6" },
  { id: "e9", source: "n6", target: "n7", sourceHandle: "r", targetHandle: "l" },
  { id: "e10", source: "n7", target: "pr" },
  { id: "e11", source: "pr", target: "n8", sourceHandle: "ls", targetHandle: "rt" },
  { id: "e12", source: "n8", target: "n9" },
  { id: "e13", source: "n9", target: "n10", sourceHandle: "r", targetHandle: "l" },
];
export const replaySteps: string[][] = [
  ["n1"], ["n2", "n3"], ["n4"], ["n5"], ["trackA", "trackB"],
  ["n6"], ["n7"], ["pr"], ["n8"], ["n9"], ["n10"],
];