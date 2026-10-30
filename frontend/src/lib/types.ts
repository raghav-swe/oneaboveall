// Shared types. Keep in sync with docs/ specs. Backend (FastAPI) will return these shapes later.

export type Tier = 1 | 2 | 3;

export type NodeState = "done" | "active" | "paused" | "pending" | "failed" | "skipped";

export interface PipelineNode {
  id: number; // 1..10
  label: string;
  state: NodeState;
  durationMs?: number;
}

export interface Telemetry {
  dbPool: { used: number; max: number };
  http504Pct: number;
  ramLoadPct: number;
  liveError?: string;
}

export interface LastResolved {
  incidentId: string;
  summary: string;
  tier: Tier;
  resolvedInSeconds: number;
}

export interface VendorVerdict {
  vendor: "Llama-3.3-70B" | "GPT-OSS-120B" | "Gemini 2.5 Flash";
  role: "Forensics" | "FinOps" | "Arbiter";
  text: string;
}

export interface HitlBrief {
  incidentId: string;
  service: string;
  rootCause: string;
  whyHitl: string;
  command: string;
  sandboxDryRun: { passed: boolean; ms: number };
  blastScore: number;
}

export interface BlastRadius {
  score: number;
  tier1Max: number; // 0.40 by default
  ratio: number;
  dRisk: number;
  pRev: number;
}

export interface LiveIncident {
  incidentId: string;
  service: string;
  cause: string;
  slaElapsedSec: number;
  slaLimitSec: number;
  telemetry: Telemetry;
  verdicts: VendorVerdict[];
  hitl: HitlBrief;
  blast: BlastRadius;
  nodes: PipelineNode[];
  queuedNext?: string;
}

export interface TicketSummary {
  id: string;
  service: string;
  title: string;
  badge: "3/3 STRIKES" | "TIER 2 HITL" | "TIER 1 AUTO";
  note: string;
}

export interface GlobalConfig {
  blastThreshold: number; // 0.15 .. 0.75, default 0.40
  maxStrikes: 2 | 3 | 4 | 5;
  mockEnv: boolean;
  routing: { forensics: string; finops: string; arbiter: string };
}
export type DagState = "done" | "failed" | "skipped" | "active" | "pending";

export interface DagNodeInfo {
  id: string;
  label: string;
  x: number;
  y: number;
  state: DagState;
  status: string; // shown later in the node inspector
  shape?: "box" | "diamond";
}

export interface DagEdgeInfo {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string; // "b" bottom (default), "r" right, "ls" left
  targetHandle?: string; // "t" top (default), "l" left, "rt" right
}