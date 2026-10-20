/**
 * OAA TypeScript types — exact mirror of backend/app/schemas/models.py and
 * backend/app/schemas/state.py (CONTEXT.md §8, rule 1: any schema change must
 * be mirrored here in the same commit).
 */

// --- models.py mirrors ------------------------------------------------------

export type DebateSpeaker = "Forensics" | "FinOps";

export interface DebateMessage {
  round_num: number;
  speaker: DebateSpeaker;
  model_used: string;
  stance: string;
  argument: string;
  proposed_action: string;
}

export type McpToolName = "restart_pod" | "kill_db_pid" | "flush_redis_cache";

export interface ArbiterVerdict {
  winning_summary: string;
  command_to_run: string;
  mcp_tool_name: McpToolName;
  mcp_tool_args: Record<string, unknown>;
  target_service: string;
  affected_pods: number; // >= 1
  total_pods: number; // >= 1
  d_risk: number; // 0.0 stateless .. 1.0 stateful DB
  p_reversibility: number; // 0.0 instant rollback .. 1.0 permanent
  is_code_bug: boolean;
  offending_file: string | null;
  offending_line: number | null;
  live_engineer_briefing: string;
}

export interface SandboxResult {
  sandbox_passed: boolean;
  execution_time_ms: number;
  strike_number: number;
  stdout_log: string;
  verification_badge: string;
}

export interface CodePatchBundle {
  file_path: string;
  patch_diff: string; // unified git diff, <= 5 lines changed
  pytest_code: string;
  pytest_passed: boolean;
  strike_count: number;
  pr_url: string | null;
  pr_markdown_report: string;
}

export type ToolKey =
  | "get_pod_metrics"
  | "get_container_logs"
  | "get_cluster_topology"
  | "restart_pod"
  | "kill_db_pid"
  | "flush_redis_cache";

export interface RuntimeConfigModel {
  blast_threshold: number; // default 0.40
  global_max_strikes: number; // default 3
  mock_env: boolean; // default true
  enabled_tools: Record<ToolKey, boolean>;
}

// --- state.py mirror --------------------------------------------------------

export type SelectedTier = "TIER_1_AUTONOMOUS" | "TIER_2_HITL";
export type HitlDecision = "APPROVED" | "REJECTED" | "AUTO_APPROVED" | null;

export interface OAAState {
  incident_id: string;
  scenario_key: string;
  service: string;
  alert_name: string;
  telemetry: Record<string, unknown>;
  debate_transcript: DebateMessage[];
  arbiter_decision: Partial<ArbiterVerdict>;
  blast_radius_score: number;
  selected_tier: SelectedTier | "";
  sandbox_result: Partial<SandboxResult>;
  hitl_decision: HitlDecision;
  execution_status: string;
  patch_bundle: CodePatchBundle | null;
  strike_count: number;
  max_strikes: number;
  prompt_hint: string | null;
  final_post_mortem_report: string;
}

// --- API & SSE envelopes (CONTEXT.md §6) ------------------------------------

export type ScenarioKey =
  | "SCENARIO_1_STATELESS"
  | "SCENARIO_2_STATEFUL_DB"
  | "SCENARIO_3_CODE_BUG";

export type NodeStatus = "RUNNING" | "COMPLETED" | "PAUSED" | "HALTED";

export interface SSENodeEvent {
  event: "node_update";
  node_id: number; // 1..10
  status: NodeStatus;
  state: Partial<OAAState>;
}

export type IncidentStatus = "RUNNING" | "PAUSED_HITL" | "RESOLVED" | "HALTED_STRIKES";

export interface IncidentRow {
  incident_id: string;
  service: string;
  alert_name: string;
  status: IncidentStatus;
  selected_tier: SelectedTier | null;
  blast_radius_score: number | null;
  is_code_bug: 0 | 1;
  strike_count: number;
  max_strikes_override: number;
  created_at: string;
  final_report_md: string | null;
}

export interface NodeSnapshotRow {
  id: number;
  incident_id: string;
  node_id: number;
  node_name: string;
  status: NodeStatus;
  elapsed_ms: number;
  state_json: string;
  timestamp: string;
}

export interface IngestResponse {
  incident_id: string;
  status: "STARTED";
  stream_url: string;
}

export type QuickFixAction =
  | "RESTART_MCP"
  | "PURGE_SANDBOX"
  | "UNLOCK_SQLITE"
  | "ENABLE_MOCK_ENV";
