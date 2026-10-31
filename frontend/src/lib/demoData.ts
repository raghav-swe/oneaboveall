/**
 * Offline demo snapshot — generated from backend/app/mocks/scenarios.json.
 *
 * Used only when the FastAPI gateway is unreachable (e.g. the Vercel build, where
 * `/api/*` has no backend behind it). On localhost every page talks to the live API
 * and this module is never read.
 *
 * Keep this file in sync with the fixtures; it is generated, not hand-edited.
 */

import type {
  IncidentRow,
  LastHealthySummary,
  NodeSnapshotRow,
  RuntimeConfigModel,
  ScenarioKey,
} from "@/types/oaa";

export interface DemoNodeEvent {
  delay_ms: number;
  node_id: number;
  status: "RUNNING" | "COMPLETED" | "PAUSED" | "HALTED";
  state: Record<string, unknown>;
}

export interface DemoRun {
  before_pause: DemoNodeEvent[];
  after_pause: DemoNodeEvent[];
  final_status: string;
  blast: number;
  tier: string;
}

export const DEMO_INCIDENTS: IncidentRow[] = [
  {
    "incident_id": "INC-4815",
    "service": "pricing-api",
    "alert_name": "CrashLoopBackOff",
    "status": "HALTED_STRIKES",
    "selected_tier": "TIER_1_AUTONOMOUS",
    "blast_radius_score": 0.04,
    "is_code_bug": 1,
    "strike_count": 3,
    "max_strikes_override": 3,
    "created_at": "2026-10-18 14:03:11",
    "final_report_md": "## \u26d4 Circuit-Breaker Halt \u2014 INC-4815 (pricing-api)\n\n**Status:** HALTED_STRIKES \u2014 Node 8 exhausted 3/3 pytest strikes. Write/PR permissions revoked.\n\n### What succeeded\nLive service **was stabilized** (Tier 1 restart of pod `pricing-api-6c8f9b7d5-j4t8w`; fleet 10/10 Ready). Customers are NOT impacted.\n\n### What failed\nThe autonomous code fix for `KeyError: 'tax'` at `app/services/pricing.py:87` failed sandbox pytest 3 times:\n1. Strike 1: `assert 10.0 == 11.5` (tax-present case regressed)\n2. Strike 2: `KeyError: 'tax'` (fix not applied to the right branch)\n3. Strike 3: both cases failing\n\n### How to resume\nOpen `/history` \u2192 INC-4815 \u2192 Node 8 inspector \u2192 provide a prompt hint (e.g. `Use dict.get('tax', 0.0)`) \u2192 **[\u21bb Run 4th Try on Node 8 Now]**. This grants a one-time 4th strike for this ticket only."
  },
  {
    "incident_id": "INC-4818",
    "service": "inventory-sync",
    "alert_name": "ContainerOOMKilled",
    "status": "RESOLVED",
    "selected_tier": "TIER_1_AUTONOMOUS",
    "blast_radius_score": 0.07,
    "is_code_bug": 0,
    "strike_count": 0,
    "max_strikes_override": 3,
    "created_at": "2026-10-17 03:12:44",
    "final_report_md": "## \u2600\ufe0f Morning Digest \u2014 INC-4818 (inventory-sync)\n\n**Tier:** TIER_1_AUTONOMOUS (silent overnight fix)\n**Blast Radius:** B = 0.4\u00d7(2/12) + 0.4\u00d70.0 + 0.2\u00d70.0 = **0.07** (threshold 0.40)\n\n### What happened\nTwo `inventory-sync` worker pods OOMKilled at 03:12 UTC (memory leak, +6%/min). Queue lag peaked at 1,212 messages.\n\n### Autonomous action\nRolling restart of the 2 dead pods after a PASS (138ms) dry-run. Stabilized in 7.6s.\n\n### MTTR\n**10.8s** webhook-to-stable. Zero human intervention. Root-cause leak referred to service owners."
  }
];

export const DEMO_SNAPSHOTS: Record<string, NodeSnapshotRow[]> = {
  "INC-4818": [
    {
      "id": 1,
      "incident_id": "INC-4818",
      "node_id": 1,
      "node_name": "ingest_node",
      "status": "COMPLETED",
      "elapsed_ms": 380,
      "state_json": "{\"incident_id\": \"INC-4818\", \"scenario_key\": \"SCENARIO_1_STATELESS\", \"service\": \"inventory-sync\", \"alert_name\": \"ContainerOOMKilled\", \"telemetry\": {\"metrics\": {\"cpu_pct\": 39.1, \"ram_pct\": 93.2, \"db_pool\": {\"used\": 28, \"max\": 100}, \"http_5xx_rate\": 0.11}, \"logs\": [\"FATAL worker.sync: java.lang.OutOfMemoryError: GC overhead limit exceeded\", \"kubelet: container inventory-sync-5d7c8f9b6-p3r7x OOMKilled (exit 137)\", \"kubelet: container inventory-sync-5d7c8f9b6-t9w2n OOMKilled (exit 137)\"], \"topology\": {\"service\": \"inventory-sync\", \"upstream\": [\"rabbitmq-inventory\"], \"downstream\": [\"orders-postgres (read-only)\"]}}}",
      "timestamp": "2026-10-17 03:12:45"
    },
    {
      "id": 2,
      "incident_id": "INC-4818",
      "node_id": 2,
      "node_name": "forensics_node",
      "status": "COMPLETED",
      "elapsed_ms": 2140,
      "state_json": "{\"incident_id\": \"INC-4818\", \"debate_transcript\": [{\"round_num\": 1, \"speaker\": \"Forensics\", \"model_used\": \"llama-3.3-70b-versatile\", \"stance\": \"propose\", \"argument\": \"Exit 137 OOMKilled on 2/12 stateless pods; DB pool healthy at 28/100. Rolling restart restores consumers fastest.\", \"proposed_action\": \"restart_pod [p3r7x, t9w2n]\"}]}",
      "timestamp": "2026-10-17 03:12:47"
    },
    {
      "id": 3,
      "incident_id": "INC-4818",
      "node_id": 3,
      "node_name": "finops_node",
      "status": "COMPLETED",
      "elapsed_ms": 2680,
      "state_json": "{\"incident_id\": \"INC-4818\", \"debate_transcript\": [{\"round_num\": 2, \"speaker\": \"FinOps\", \"model_used\": \"openai/gpt-oss-120b\", \"stance\": \"counter\", \"argument\": \"Restart over scaling: 2/12 pods, no stateful surface, $0.42/hr per avoided OOM replica. Veto mid-incident memory-limit changes.\", \"proposed_action\": \"Approve restart_pod (2 pods); veto scale-out\"}]}",
      "timestamp": "2026-10-17 03:12:50"
    },
    {
      "id": 4,
      "incident_id": "INC-4818",
      "node_id": 2,
      "node_name": "forensics_node",
      "status": "COMPLETED",
      "elapsed_ms": 1890,
      "state_json": "{\"incident_id\": \"INC-4818\", \"debate_transcript\": [{\"round_num\": 3, \"speaker\": \"Forensics\", \"model_used\": \"llama-3.3-70b-versatile\", \"stance\": \"refine\", \"argument\": \"Sequential restart with 10s readiness gates; no HPA or config edits.\", \"proposed_action\": \"restart_pod [p3r7x, t9w2n] sequentially\"}]}",
      "timestamp": "2026-10-17 03:12:52"
    },
    {
      "id": 5,
      "incident_id": "INC-4818",
      "node_id": 4,
      "node_name": "arbiter_node",
      "status": "COMPLETED",
      "elapsed_ms": 3120,
      "state_json": "{\"incident_id\": \"INC-4818\", \"arbiter_decision\": {\"winning_summary\": \"2/12 stateless inventory-sync pods OOMKilled; rolling restart, no scaling.\", \"command_to_run\": \"kubectl rollout restart pod/inventory-sync-5d7c8f9b6-p3r7x pod/inventory-sync-5d7c8f9b6-t9w2n\", \"mcp_tool_name\": \"restart_pod\", \"mcp_tool_args\": {\"pods\": [\"inventory-sync-5d7c8f9b6-p3r7x\", \"inventory-sync-5d7c8f9b6-t9w2n\"], \"strategy\": \"rolling\", \"readiness_gate_seconds\": 10}, \"target_service\": \"inventory-sync\", \"affected_pods\": 2, \"total_pods\": 12, \"d_risk\": 0.0, \"p_reversibility\": 0.0, \"is_code_bug\": false, \"offending_file\": null, \"offending_line\": null, \"live_engineer_briefing\": \"Tier 1 autonomous path \\u2014 no briefing required.\"}}",
      "timestamp": "2026-10-17 03:12:55"
    },
    {
      "id": 6,
      "incident_id": "INC-4818",
      "node_id": 5,
      "node_name": "blast_radius_gate",
      "status": "COMPLETED",
      "elapsed_ms": 12,
      "state_json": "{\"incident_id\": \"INC-4818\", \"blast_radius_score\": 0.07, \"selected_tier\": \"TIER_1_AUTONOMOUS\"}",
      "timestamp": "2026-10-17 03:12:55"
    },
    {
      "id": 7,
      "incident_id": "INC-4818",
      "node_id": 6,
      "node_name": "sandbox_node",
      "status": "COMPLETED",
      "elapsed_ms": 138,
      "state_json": "{\"incident_id\": \"INC-4818\", \"sandbox_result\": {\"sandbox_passed\": true, \"execution_time_ms\": 138, \"strike_number\": 1, \"stdout_log\": \"[dry-run] 2 targets matched; 0 syntax errors, 0 destructive mutations\", \"verification_badge\": \"PASS (138ms) \\u2014 0 Syntax Errors, 0 Destructive Mutations\"}, \"hitl_decision\": \"AUTO_APPROVED\"}",
      "timestamp": "2026-10-17 03:12:56"
    },
    {
      "id": 8,
      "incident_id": "INC-4818",
      "node_id": 7,
      "node_name": "execution_node",
      "status": "COMPLETED",
      "elapsed_ms": 7640,
      "state_json": "{\"incident_id\": \"INC-4818\", \"execution_status\": \"STABILIZED\"}",
      "timestamp": "2026-10-17 03:13:03"
    },
    {
      "id": 9,
      "incident_id": "INC-4818",
      "node_id": 9,
      "node_name": "shared_reporting_node",
      "status": "COMPLETED",
      "elapsed_ms": 2210,
      "state_json": "{\"incident_id\": \"INC-4818\", \"final_post_mortem_report\": \"## \\u2600\\ufe0f Morning Digest \\u2014 INC-4818 (inventory-sync) ... (see final_report_md)\"}",
      "timestamp": "2026-10-17 03:13:05"
    },
    {
      "id": 10,
      "incident_id": "INC-4818",
      "node_id": 10,
      "node_name": "flight_ledger_node",
      "status": "COMPLETED",
      "elapsed_ms": 45,
      "state_json": "{\"incident_id\": \"INC-4818\", \"scenario_key\": \"SCENARIO_1_STATELESS\", \"service\": \"inventory-sync\", \"alert_name\": \"ContainerOOMKilled\", \"telemetry\": {\"metrics\": {\"cpu_pct\": 39.1, \"ram_pct\": 93.2, \"db_pool\": {\"used\": 28, \"max\": 100}, \"http_5xx_rate\": 0.11}, \"logs\": [\"FATAL worker.sync: java.lang.OutOfMemoryError: GC overhead limit exceeded\"], \"topology\": {\"service\": \"inventory-sync\", \"upstream\": [\"rabbitmq-inventory\"], \"downstream\": [\"orders-postgres (read-only)\"]}}, \"debate_transcript\": [{\"round_num\": 1, \"speaker\": \"Forensics\", \"model_used\": \"llama-3.3-70b-versatile\", \"stance\": \"propose\", \"argument\": \"Exit 137 OOMKilled on 2/12 stateless pods; DB pool healthy at 28/100. Rolling restart restores consumers fastest.\", \"proposed_action\": \"restart_pod [p3r7x, t9w2n]\"}, {\"round_num\": 2, \"speaker\": \"FinOps\", \"model_used\": \"openai/gpt-oss-120b\", \"stance\": \"counter\", \"argument\": \"Restart over scaling: 2/12 pods, no stateful surface. Veto mid-incident memory-limit changes.\", \"proposed_action\": \"Approve restart_pod (2 pods); veto scale-out\"}, {\"round_num\": 3, \"speaker\": \"Forensics\", \"model_used\": \"llama-3.3-70b-versatile\", \"stance\": \"refine\", \"argument\": \"Sequential restart with 10s readiness gates; no HPA or config edits.\", \"proposed_action\": \"restart_pod [p3r7x, t9w2n] sequentially\"}], \"arbiter_decision\": {\"winning_summary\": \"2/12 stateless inventory-sync pods OOMKilled; rolling restart, no scaling.\", \"command_to_run\": \"kubectl rollout restart pod/inventory-sync-5d7c8f9b6-p3r7x pod/inventory-sync-5d7c8f9b6-t9w2n\", \"mcp_tool_name\": \"restart_pod\", \"mcp_tool_args\": {\"pods\": [\"inventory-sync-5d7c8f9b6-p3r7x\", \"inventory-sync-5d7c8f9b6-t9w2n\"], \"strategy\": \"rolling\", \"readiness_gate_seconds\": 10}, \"target_service\": \"inventory-sync\", \"affected_pods\": 2, \"total_pods\": 12, \"d_risk\": 0.0, \"p_reversibility\": 0.0, \"is_code_bug\": false, \"offending_file\": null, \"offending_line\": null, \"live_engineer_briefing\": \"Tier 1 autonomous path \\u2014 no briefing required.\"}, \"blast_radius_score\": 0.07, \"selected_tier\": \"TIER_1_AUTONOMOUS\", \"sandbox_result\": {\"sandbox_passed\": true, \"execution_time_ms\": 138, \"strike_number\": 1, \"stdout_log\": \"[dry-run] 2 targets matched; 0 syntax errors, 0 destructive mutations\", \"verification_badge\": \"PASS (138ms) \\u2014 0 Syntax Errors, 0 Destructive Mutations\"}, \"hitl_decision\": \"AUTO_APPROVED\", \"execution_status\": \"STABILIZED\", \"patch_bundle\": null, \"strike_count\": 0, \"max_strikes\": 3, \"prompt_hint\": null, \"final_post_mortem_report\": \"## \\u2600\\ufe0f Morning Digest \\u2014 INC-4818 (inventory-sync) ... (see final_report_md)\"}",
      "timestamp": "2026-10-17 03:13:05"
    }
  ],
  "INC-4815": [
    {
      "id": 1,
      "incident_id": "INC-4815",
      "node_id": 1,
      "node_name": "ingest_node",
      "status": "COMPLETED",
      "elapsed_ms": 392,
      "state_json": "{\"incident_id\": \"INC-4815\", \"scenario_key\": \"SCENARIO_3_CODE_BUG\", \"service\": \"pricing-api\", \"alert_name\": \"CrashLoopBackOff\", \"telemetry\": {\"metrics\": {\"cpu_pct\": 12.4, \"ram_pct\": 38.9, \"db_pool\": {\"used\": 21, \"max\": 100}, \"http_5xx_rate\": 0.41, \"restart_count\": 14}, \"logs\": [\"  File \\\"app/services/pricing.py\\\", line 87, in compute_total\", \"    tax = cart[\\\"tax\\\"]\", \"KeyError: 'tax'\", \"kubelet: container pricing-api-6c8f9b7d5-j4t8w restarted (count 14)\"], \"topology\": {\"service\": \"pricing-api\", \"upstream\": [\"checkout-api\", \"admin-panel\"], \"downstream\": [\"orders-postgres (read-only)\", \"redis-price-cache\"]}}}",
      "timestamp": "2026-10-18 14:03:11"
    },
    {
      "id": 2,
      "incident_id": "INC-4815",
      "node_id": 2,
      "node_name": "forensics_node",
      "status": "COMPLETED",
      "elapsed_ms": 2350,
      "state_json": "{\"incident_id\": \"INC-4815\", \"debate_transcript\": [{\"round_num\": 1, \"speaker\": \"Forensics\", \"model_used\": \"llama-3.3-70b-versatile\", \"stance\": \"propose\", \"argument\": \"Deterministic KeyError: 'tax' at pricing.py:87 \\u2014 code bug, not infra. Restart the wedged pod now; this needs a Tier 3 PR.\", \"proposed_action\": \"restart_pod(j4t8w); flag is_code_bug=true pricing.py:87\"}]}",
      "timestamp": "2026-10-18 14:03:14"
    },
    {
      "id": 3,
      "incident_id": "INC-4815",
      "node_id": 3,
      "node_name": "finops_node",
      "status": "COMPLETED",
      "elapsed_ms": 2540,
      "state_json": "{\"incident_id\": \"INC-4815\", \"debate_transcript\": [{\"round_num\": 2, \"speaker\": \"FinOps\", \"model_used\": \"openai/gpt-oss-120b\", \"stance\": \"counter\", \"argument\": \"Restart-only: scaling a CrashLoopBackOff deployment burns replicas on a deterministic exception. 1/10 pods, stateless \\u2014 autonomous OK. Fix belongs in a PR with pytest proof.\", \"proposed_action\": \"Approve single-pod restart; veto scale-out; defer fix to Tier 3\"}]}",
      "timestamp": "2026-10-18 14:03:16"
    },
    {
      "id": 4,
      "incident_id": "INC-4815",
      "node_id": 2,
      "node_name": "forensics_node",
      "status": "COMPLETED",
      "elapsed_ms": 1980,
      "state_json": "{\"incident_id\": \"INC-4815\", \"debate_transcript\": [{\"round_num\": 3, \"speaker\": \"Forensics\", \"model_used\": \"llama-3.3-70b-versatile\", \"stance\": \"refine\", \"argument\": \"Restart the single pod; post-stabilization patch compute_total with cart.get(\\\"tax\\\", 0.0) plus regression pytest in the sandbox.\", \"proposed_action\": \"restart_pod [j4t8w] -> Node 8: <=5-line diff + pytest + PR\"}]}",
      "timestamp": "2026-10-18 14:03:18"
    },
    {
      "id": 5,
      "incident_id": "INC-4815",
      "node_id": 4,
      "node_name": "arbiter_node",
      "status": "COMPLETED",
      "elapsed_ms": 3310,
      "state_json": "{\"incident_id\": \"INC-4815\", \"arbiter_decision\": {\"winning_summary\": \"Deterministic KeyError: 'tax' at pricing.py:87; restart one pod (Tier 1), then Tier 3 PR for the root cause.\", \"command_to_run\": \"kubectl rollout restart pod/pricing-api-6c8f9b7d5-j4t8w\", \"mcp_tool_name\": \"restart_pod\", \"mcp_tool_args\": {\"pods\": [\"pricing-api-6c8f9b7d5-j4t8w\"], \"strategy\": \"single\", \"readiness_gate_seconds\": 10}, \"target_service\": \"pricing-api\", \"affected_pods\": 1, \"total_pods\": 10, \"d_risk\": 0.0, \"p_reversibility\": 0.0, \"is_code_bug\": true, \"offending_file\": \"app/services/pricing.py\", \"offending_line\": 87, \"live_engineer_briefing\": \"Tier 1 autonomous path \\u2014 no briefing required.\"}}",
      "timestamp": "2026-10-18 14:03:22"
    },
    {
      "id": 6,
      "incident_id": "INC-4815",
      "node_id": 5,
      "node_name": "blast_radius_gate",
      "status": "COMPLETED",
      "elapsed_ms": 11,
      "state_json": "{\"incident_id\": \"INC-4815\", \"blast_radius_score\": 0.04, \"selected_tier\": \"TIER_1_AUTONOMOUS\"}",
      "timestamp": "2026-10-18 14:03:22"
    },
    {
      "id": 7,
      "incident_id": "INC-4815",
      "node_id": 6,
      "node_name": "sandbox_node",
      "status": "COMPLETED",
      "elapsed_ms": 141,
      "state_json": "{\"incident_id\": \"INC-4815\", \"sandbox_result\": {\"sandbox_passed\": true, \"execution_time_ms\": 141, \"strike_number\": 1, \"stdout_log\": \"[dry-run] 1 target matched; 0 syntax errors, 0 destructive mutations\", \"verification_badge\": \"PASS (141ms) \\u2014 0 Syntax Errors, 0 Destructive Mutations\"}, \"hitl_decision\": \"AUTO_APPROVED\"}",
      "timestamp": "2026-10-18 14:03:22"
    },
    {
      "id": 8,
      "incident_id": "INC-4815",
      "node_id": 7,
      "node_name": "execution_node",
      "status": "COMPLETED",
      "elapsed_ms": 6380,
      "state_json": "{\"incident_id\": \"INC-4815\", \"execution_status\": \"STABILIZED\"}",
      "timestamp": "2026-10-18 14:03:29"
    },
    {
      "id": 9,
      "incident_id": "INC-4815",
      "node_id": 8,
      "node_name": "gitops_pr_node",
      "status": "COMPLETED",
      "elapsed_ms": 9120,
      "state_json": "{\"incident_id\": \"INC-4815\", \"strike_count\": 1, \"patch_bundle\": {\"file_path\": \"app/services/pricing.py\", \"patch_diff\": \"--- a/app/services/pricing.py\\n+++ b/app/services/pricing.py\\n@@ -85,7 +85,7 @@\\n-    tax = cart[\\\"tax\\\"]\\n+    tax = cart.get(\\\"tax\\\")\", \"pytest_code\": \"...\", \"pytest_passed\": false, \"strike_count\": 1, \"pr_url\": null, \"pr_markdown_report\": \"(strike 1 draft)\"}}",
      "timestamp": "2026-10-18 14:03:38"
    },
    {
      "id": 10,
      "incident_id": "INC-4815",
      "node_id": 8,
      "node_name": "gitops_pr_node",
      "status": "COMPLETED",
      "elapsed_ms": 8840,
      "state_json": "{\"incident_id\": \"INC-4815\", \"strike_count\": 2, \"patch_bundle\": {\"file_path\": \"app/services/pricing.py\", \"patch_diff\": \"--- a/app/services/pricing.py\\n+++ b/app/services/pricing.py\\n@@ -85,7 +85,7 @@\\n-    tax = cart[\\\"tax\\\"]\\n+    tax = cart.get(\\\"tax_rate\\\", 0.0)\", \"pytest_code\": \"...\", \"pytest_passed\": false, \"strike_count\": 2, \"pr_url\": null, \"pr_markdown_report\": \"(strike 2 draft \\u2014 wrong key guess)\"}}",
      "timestamp": "2026-10-18 14:03:47"
    },
    {
      "id": 11,
      "incident_id": "INC-4815",
      "node_id": 8,
      "node_name": "gitops_pr_node",
      "status": "HALTED",
      "elapsed_ms": 8960,
      "state_json": "{\"incident_id\": \"INC-4815\", \"strike_count\": 3, \"patch_bundle\": {\"file_path\": \"app/services/pricing.py\", \"patch_diff\": \"--- a/app/services/pricing.py\\n+++ b/app/services/pricing.py\\n@@ -85,7 +85,7 @@\\n-    tax = cart[\\\"tax\\\"]\\n+    tax = cart.get(\\\"tax\\\") or 0.0\", \"pytest_code\": \"...\", \"pytest_passed\": false, \"strike_count\": 3, \"pr_url\": null, \"pr_markdown_report\": \"(strike 3 draft \\u2014 still failing)\"}}",
      "timestamp": "2026-10-18 14:03:56"
    },
    {
      "id": 12,
      "incident_id": "INC-4815",
      "node_id": 9,
      "node_name": "shared_reporting_node",
      "status": "COMPLETED",
      "elapsed_ms": 2430,
      "state_json": "{\"incident_id\": \"INC-4815\", \"final_post_mortem_report\": \"## \\u26d4 Circuit-Breaker Halt \\u2014 INC-4815 (pricing-api) ... (see final_report_md)\"}",
      "timestamp": "2026-10-18 14:03:58"
    },
    {
      "id": 13,
      "incident_id": "INC-4815",
      "node_id": 10,
      "node_name": "flight_ledger_node",
      "status": "COMPLETED",
      "elapsed_ms": 52,
      "state_json": "{\"incident_id\": \"INC-4815\", \"scenario_key\": \"SCENARIO_3_CODE_BUG\", \"service\": \"pricing-api\", \"alert_name\": \"CrashLoopBackOff\", \"telemetry\": {\"metrics\": {\"cpu_pct\": 12.4, \"ram_pct\": 38.9, \"db_pool\": {\"used\": 21, \"max\": 100}, \"http_5xx_rate\": 0.41, \"restart_count\": 14}, \"logs\": [\"  File \\\"app/services/pricing.py\\\", line 87, in compute_total\", \"    tax = cart[\\\"tax\\\"]\", \"KeyError: 'tax'\", \"kubelet: container pricing-api-6c8f9b7d5-j4t8w restarted (count 14)\"], \"topology\": {\"service\": \"pricing-api\", \"upstream\": [\"checkout-api\", \"admin-panel\"], \"downstream\": [\"orders-postgres (read-only)\", \"redis-price-cache\"]}}, \"debate_transcript\": [{\"round_num\": 1, \"speaker\": \"Forensics\", \"model_used\": \"llama-3.3-70b-versatile\", \"stance\": \"propose\", \"argument\": \"Deterministic KeyError: 'tax' at pricing.py:87 \\u2014 code bug, not infra. Restart the wedged pod now; this needs a Tier 3 PR.\", \"proposed_action\": \"restart_pod(j4t8w); flag is_code_bug=true pricing.py:87\"}, {\"round_num\": 2, \"speaker\": \"FinOps\", \"model_used\": \"openai/gpt-oss-120b\", \"stance\": \"counter\", \"argument\": \"Restart-only: scaling a CrashLoopBackOff deployment burns replicas on a deterministic exception. 1/10 pods, stateless \\u2014 autonomous OK. Fix belongs in a PR with pytest proof.\", \"proposed_action\": \"Approve single-pod restart; veto scale-out; defer fix to Tier 3\"}, {\"round_num\": 3, \"speaker\": \"Forensics\", \"model_used\": \"llama-3.3-70b-versatile\", \"stance\": \"refine\", \"argument\": \"Restart the single pod; post-stabilization patch compute_total with cart.get(\\\"tax\\\", 0.0) plus regression pytest in the sandbox.\", \"proposed_action\": \"restart_pod [j4t8w] -> Node 8: <=5-line diff + pytest + PR\"}], \"arbiter_decision\": {\"winning_summary\": \"Deterministic KeyError: 'tax' at pricing.py:87; restart one pod (Tier 1), then Tier 3 PR for the root cause.\", \"command_to_run\": \"kubectl rollout restart pod/pricing-api-6c8f9b7d5-j4t8w\", \"mcp_tool_name\": \"restart_pod\", \"mcp_tool_args\": {\"pods\": [\"pricing-api-6c8f9b7d5-j4t8w\"], \"strategy\": \"single\", \"readiness_gate_seconds\": 10}, \"target_service\": \"pricing-api\", \"affected_pods\": 1, \"total_pods\": 10, \"d_risk\": 0.0, \"p_reversibility\": 0.0, \"is_code_bug\": true, \"offending_file\": \"app/services/pricing.py\", \"offending_line\": 87, \"live_engineer_briefing\": \"Tier 1 autonomous path \\u2014 no briefing required.\"}, \"blast_radius_score\": 0.04, \"selected_tier\": \"TIER_1_AUTONOMOUS\", \"sandbox_result\": {\"sandbox_passed\": true, \"execution_time_ms\": 141, \"strike_number\": 1, \"stdout_log\": \"[dry-run] 1 target matched; 0 syntax errors, 0 destructive mutations\", \"verification_badge\": \"PASS (141ms) \\u2014 0 Syntax Errors, 0 Destructive Mutations\"}, \"hitl_decision\": \"AUTO_APPROVED\", \"execution_status\": \"STABILIZED\", \"patch_bundle\": {\"file_path\": \"app/services/pricing.py\", \"patch_diff\": \"--- a/app/services/pricing.py\\n+++ b/app/services/pricing.py\\n@@ -85,7 +85,7 @@\\n-    tax = cart[\\\"tax\\\"]\\n+    tax = cart.get(\\\"tax\\\") or 0.0\", \"pytest_code\": \"...\", \"pytest_passed\": false, \"strike_count\": 3, \"pr_url\": null, \"pr_markdown_report\": \"(strike 3 draft \\u2014 still failing)\"}, \"strike_count\": 3, \"max_strikes\": 3, \"prompt_hint\": null, \"final_post_mortem_report\": \"## \\u26d4 Circuit-Breaker Halt \\u2014 INC-4815 (pricing-api) ... (see final_report_md)\"}",
      "timestamp": "2026-10-18 14:03:58"
    }
  ]
};

export const DEMO_LAST_HEALTHY: LastHealthySummary = {
  "incident_id": "INC-4818",
  "service": "inventory-sync",
  "alert_name": "ContainerOOMKilled",
  "selected_tier": "TIER_1_AUTONOMOUS",
  "blast_radius_score": 0.07,
  "resolved_at": "2026-10-17 03:12:44",
  "snapshot_count": 10,
  "final_report_md": "## \u2600\ufe0f Morning Digest \u2014 INC-4818 (inventory-sync)\n\n**Tier:** TIER_1_AUTONOMOUS (silent overnight fix)\n**Blast Radius:** B = 0.4\u00d7(2/12) + 0.4\u00d70.0 + 0.2\u00d70.0 = **0.07** (threshold 0.40)\n\n### What happened\nTwo `inventory-sync` worker pods OOMKilled at 03:12 UTC (memory leak, +6%/min). Queue lag peaked at 1,212 messages.\n\n### Autonomous action\nRolling restart of the 2 dead pods after a PASS (138ms) dry-run. Stabilized in 7.6s.\n\n### MTTR\n**10.8s** webhook-to-stable. Zero human intervention. Root-cause leak referred to service owners."
};

export const DEMO_CONFIG: RuntimeConfigModel = {
  "blast_threshold": 0.4,
  "global_max_strikes": 3,
  "mock_env": true,
  "enabled_tools": {
    "get_pod_metrics": true,
    "get_container_logs": true,
    "get_cluster_topology": true,
    "restart_pod": true,
    "kill_db_pid": true,
    "flush_redis_cache": true
  }
};

export const DEMO_RUNS: Record<ScenarioKey, DemoRun> = {
  "SCENARIO_1_STATELESS": {
    "before_pause": [
      {
        "delay_ms": 60,
        "node_id": 1,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 400,
        "node_id": 1,
        "status": "COMPLETED",
        "state": {
          "service": "checkout-worker",
          "alert_name": "ContainerOOMKilled",
          "telemetry": {
            "metrics": {
              "cpu_pct": 41.2,
              "ram_pct": 94.7,
              "ram_trend": "climbing +6%/min over last 20min",
              "db_pool": {
                "used": 34,
                "max": 100
              },
              "http_5xx_rate": 0.18,
              "http_504_count_5m": 42
            },
            "logs": [
              "2026-10-20T03:11:02Z WARN  worker.batch: queue lag 1,842 msgs (consumer lag rising)",
              "2026-10-20T03:11:44Z ERROR worker.batch: memory usage 1.87Gi / 2.0Gi limit",
              "2026-10-20T03:12:03Z ERROR worker.cache: LRU eviction thrashing \u2014 hit ratio 11%",
              "2026-10-20T03:12:31Z FATAL worker.batch: java.lang.OutOfMemoryError: GC overhead limit exceeded",
              "2026-10-20T03:12:31Z INFO  kubelet: container checkout-worker-7f9c6d5b4-x2v1l OOMKilled (exit 137)",
              "2026-10-20T03:12:40Z INFO  kubelet: container checkout-worker-7f9c6d5b4-m8kqz OOMKilled (exit 137)",
              "2026-10-20T03:13:05Z WARN  hpa: cannot scale \u2014 metric queue_lag stale (pods restarting)"
            ],
            "topology": {
              "service": "checkout-worker",
              "upstream": [
                "checkout-api",
                "rabbitmq-orders"
              ],
              "downstream": [
                "orders-postgres (read-only)",
                "redis-cart-cache"
              ]
            }
          }
        }
      },
      {
        "delay_ms": 60,
        "node_id": 2,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 400,
        "node_id": 2,
        "status": "COMPLETED",
        "state": {
          "debate_transcript": [
            {
              "round_num": 1,
              "speaker": "Forensics",
              "model_used": "llama-3.3-70b-versatile",
              "stance": "propose",
              "argument": "stderr shows exit 137 OOMKilled on 2 of 12 stateless worker pods with RAM climbing +6%/min and LRU thrash. DB pool is healthy (34/100), so this is pure stateless compute exhaustion. Fastest MTTR: rolling restart of the 2 dead pods to restore consumers immediately.",
              "proposed_action": "restart_pod on checkout-worker-7f9c6d5b4-x2v1l and checkout-worker-7f9c6d5b4-m8kqz"
            }
          ]
        }
      },
      {
        "delay_ms": 60,
        "node_id": 3,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 400,
        "node_id": 3,
        "status": "COMPLETED",
        "state": {
          "debate_transcript": [
            {
              "round_num": 2,
              "speaker": "FinOps",
              "model_used": "openai/gpt-oss-120b",
              "stance": "counter",
              "argument": "Agree on restart over scaling: HPA is flapping on a stale metric and adding pods at 94% RAM per-pod would schedule OOM-bound replicas (~$0.42/hr each, negative value). Restart of 2/12 pods touches 16.7% of the fleet, no stateful surface, instant rollback \u2014 well inside autonomous limits. Do NOT raise memory limits mid-incident; that is a capacity review, not a 3 AM action.",
              "proposed_action": "Approve restart_pod (2 pods); veto any scale-out or memory-limit mutation tonight"
            }
          ]
        }
      },
      {
        "delay_ms": 60,
        "node_id": 2,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 400,
        "node_id": 2,
        "status": "COMPLETED",
        "state": {
          "debate_transcript": [
            {
              "round_num": 3,
              "speaker": "Forensics",
              "model_used": "llama-3.3-70b-versatile",
              "stance": "refine",
              "argument": "Refined: rolling restart strictly limited to the 2 OOMKilled pods, one at a time, 10s readiness gate between them. No HPA changes, no config edits. Root-cause memory-leak investigation deferred to business hours via a follow-up ticket.",
              "proposed_action": "restart_pod [x2v1l, m8kqz] sequentially with readiness gates"
            }
          ]
        }
      },
      {
        "delay_ms": 60,
        "node_id": 4,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 400,
        "node_id": 4,
        "status": "COMPLETED",
        "state": {
          "arbiter_decision": {
            "winning_summary": "Consensus: 2 of 12 stateless checkout-worker pods were OOMKilled by a memory leak; DB and cache layers are healthy. Rolling restart of exactly the 2 dead pods restores queue consumption with zero stateful risk. Scaling and memory-limit changes are vetoed as out-of-scope for the incident window.",
            "command_to_run": "kubectl rollout restart pod/checkout-worker-7f9c6d5b4-x2v1l pod/checkout-worker-7f9c6d5b4-m8kqz",
            "mcp_tool_name": "restart_pod",
            "mcp_tool_args": {
              "pods": [
                "checkout-worker-7f9c6d5b4-x2v1l",
                "checkout-worker-7f9c6d5b4-m8kqz"
              ],
              "strategy": "rolling",
              "readiness_gate_seconds": 10
            },
            "target_service": "checkout-worker",
            "affected_pods": 2,
            "total_pods": 12,
            "d_risk": 0.0,
            "p_reversibility": 0.0,
            "is_code_bug": false,
            "offending_file": null,
            "offending_line": null,
            "live_engineer_briefing": "Tier 1 autonomous path \u2014 no briefing required (silent overnight fix, see Morning Digest)."
          }
        }
      },
      {
        "delay_ms": 60,
        "node_id": 5,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 120,
        "node_id": 5,
        "status": "COMPLETED",
        "state": {
          "blast_radius_score": 0.0667,
          "selected_tier": "TIER_1_AUTONOMOUS"
        }
      },
      {
        "delay_ms": 60,
        "node_id": 6,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 700,
        "node_id": 6,
        "status": "COMPLETED",
        "state": {
          "sandbox_result": {
            "sandbox_passed": true,
            "execution_time_ms": 140,
            "strike_number": 1,
            "stdout_log": "[dry-run] parsed kubectl rollout restart: 2 targets matched label app=checkout-worker\n[dry-run] both pods in CrashLoopBackOff \u2014 restart is a no-op on running traffic\n[dry-run] 0 syntax errors, 0 destructive mutations detected",
            "verification_badge": "PASS (140ms) \u2014 0 Syntax Errors, 0 Destructive Mutations"
          },
          "hitl_decision": "AUTO_APPROVED"
        }
      }
    ],
    "after_pause": [
      {
        "delay_ms": 60,
        "node_id": 7,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 450,
        "node_id": 7,
        "status": "COMPLETED",
        "state": {
          "execution_status": "STABILIZED"
        }
      },
      {
        "delay_ms": 60,
        "node_id": 9,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 300,
        "node_id": 9,
        "status": "COMPLETED",
        "state": {}
      },
      {
        "delay_ms": 60,
        "node_id": 10,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 150,
        "node_id": 10,
        "status": "COMPLETED",
        "state": {}
      }
    ],
    "final_status": "RESOLVED",
    "blast": 0.0667,
    "tier": "TIER_1_AUTONOMOUS"
  },
  "SCENARIO_2_STATEFUL_DB": {
    "before_pause": [
      {
        "delay_ms": 60,
        "node_id": 1,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 400,
        "node_id": 1,
        "status": "COMPLETED",
        "state": {
          "service": "orders-postgres",
          "alert_name": "DatabaseConnectionPoolExhausted",
          "telemetry": {
            "metrics": {
              "cpu_pct": 22.8,
              "ram_pct": 61.0,
              "db_pool": {
                "used": 99,
                "max": 100
              },
              "http_5xx_rate": 0.64,
              "http_504_count_5m": 317,
              "lock_waits": 96,
              "blocking_pid": 4821
            },
            "logs": [
              "2026-10-20T03:02:11Z ERROR pgbouncer: pooler checkout: client login timeout after 8000ms",
              "2026-10-20T03:02:19Z WARN  postgres: process 4821 (etl_user@10.0.4.17) still holding AccessExclusiveLock on relation orders (age 47m12s)",
              "2026-10-20T03:02:19Z DETAIL postgres: 96 backends waiting: LockRelation 16402",
              "2026-10-20T03:02:44Z ERROR orders-api: sqlalchemy.exc.TimeoutError: QueuePool limit 100 overflow 0 \u2014 pool timeout 30s",
              "2026-10-20T03:03:02Z ERROR nginx: upstream timed out (110: Connection timed out) \u2014 504 returned",
              "2026-10-20T03:03:31Z INFO  postgres: autovacuum blocked on orders by xid 88124411 (PID 4821)"
            ],
            "topology": {
              "service": "orders-postgres",
              "upstream": [
                "orders-api",
                "checkout-api",
                "pgbouncer"
              ],
              "downstream": [
                "wal-archive",
                "read-replica-1"
              ]
            }
          }
        }
      },
      {
        "delay_ms": 60,
        "node_id": 2,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 400,
        "node_id": 2,
        "status": "COMPLETED",
        "state": {
          "debate_transcript": [
            {
              "round_num": 1,
              "speaker": "Forensics",
              "model_used": "llama-3.3-70b-versatile",
              "stance": "propose",
              "argument": "Pool is 99/100 with 96 backends queued behind ONE blocker: PID 4821, an ETL session holding AccessExclusiveLock on `orders` for 47 minutes, even blocking autovacuum. Fastest recovery: terminate PID 4821 and reload PgBouncer. Scaling the app fleet does nothing \u2014 every new pod just joins the lock queue.",
              "proposed_action": "kill_db_pid(4821), then reload pgbouncer"
            }
          ]
        }
      },
      {
        "delay_ms": 60,
        "node_id": 3,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 400,
        "node_id": 3,
        "status": "COMPLETED",
        "state": {
          "debate_transcript": [
            {
              "round_num": 2,
              "speaker": "FinOps",
              "model_used": "openai/gpt-oss-120b",
              "stance": "counter",
              "argument": "Hard veto on scale-out: 2x pods against the same lock doubles blocked connections and risks a retry storm (~$38/hr burn, zero MTTR gain, plus write-amplification risk on the primary). However, terminating a DB backend is a STATEFUL mutation: if 4821 is mid-DDL, rollback could take minutes. This must not run autonomously \u2014 a human must confirm the ETL job is killable.",
              "proposed_action": "Route to Tier 2 HITL: kill_db_pid(4821) only after human approval; veto all scaling"
            }
          ]
        }
      },
      {
        "delay_ms": 60,
        "node_id": 2,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 400,
        "node_id": 2,
        "status": "COMPLETED",
        "state": {
          "debate_transcript": [
            {
              "round_num": 3,
              "speaker": "Forensics",
              "model_used": "llama-3.3-70b-versatile",
              "stance": "refine",
              "argument": "Refined: target ONLY PID 4821 via pg_terminate_backend \u2014 no other backend is touched, in-flight web transactions are unaffected. The ETL session is idle-in-transaction (last statement 46m ago), so rollback surface is minimal. Agreed: stateful d_risk=1.0 forces the human gate.",
              "proposed_action": "kill_db_pid {pid: 4821, reload_pgbouncer: true} \u2014 pending HITL approval"
            }
          ]
        }
      },
      {
        "delay_ms": 60,
        "node_id": 4,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 400,
        "node_id": 4,
        "status": "COMPLETED",
        "state": {
          "arbiter_decision": {
            "winning_summary": "Consensus: connection-pool exhaustion is caused by a single blocking backend \u2014 ETL session PID 4821 holding AccessExclusiveLock on `orders` for 47m. Scaling is vetoed (retry-storm risk, zero benefit). Terminating PID 4821 is the correct fix but is a stateful mutation (d_risk=1.0), so it routes to Tier 2 for human approval.",
            "command_to_run": "SELECT pg_terminate_backend(4821); -- then pgbouncer reload",
            "mcp_tool_name": "kill_db_pid",
            "mcp_tool_args": {
              "pid": 4821,
              "reload_pgbouncer": true
            },
            "target_service": "orders-postgres",
            "affected_pods": 1,
            "total_pods": 8,
            "d_risk": 1.0,
            "p_reversibility": 0.3,
            "is_code_bug": false,
            "offending_file": null,
            "offending_line": null,
            "live_engineer_briefing": "\ud83d\udea8 **3:00 AM Briefing \u2014 INC-NEW (orders-postgres)**\n\n1. **Root cause:** ETL session **PID 4821** (`etl_user@10.0.4.17`) has held an AccessExclusiveLock on `orders` for 47 minutes. 96/99 pooled connections are queued behind it; the API is returning 504s.\n2. **Why scaling was vetoed:** more pods = more connections queued behind the same lock (retry-storm risk, ~$38/hr burn, zero MTTR gain).\n3. **Impact of approving:** `pg_terminate_backend(4821)` kills ONLY the idle ETL session + reloads PgBouncer. In-flight web transactions are untouched; pool recovery expected in <10s. The ETL job re-queues automatically at 04:00.\n\n\u2705 Pre-flight sandbox: **PASS (140ms) \u2014 0 Syntax Errors, 0 Destructive Mutations**"
          }
        }
      },
      {
        "delay_ms": 60,
        "node_id": 5,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 120,
        "node_id": 5,
        "status": "COMPLETED",
        "state": {
          "blast_radius_score": 0.51,
          "selected_tier": "TIER_2_HITL"
        }
      },
      {
        "delay_ms": 60,
        "node_id": 6,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 700,
        "node_id": 6,
        "status": "PAUSED",
        "state": {
          "live_engineer_briefing": "\ud83d\udea8 **3:00 AM Briefing \u2014 INC-NEW (orders-postgres)**\n\n1. **Root cause:** ETL session **PID 4821** (`etl_user@10.0.4.17`) has held an AccessExclusiveLock on `orders` for 47 minutes. 96/99 pooled connections are queued behind it; the API is returning 504s.\n2. **Why scaling was vetoed:** more pods = more connections queued behind the same lock (retry-storm risk, ~$38/hr burn, zero MTTR gain).\n3. **Impact of approving:** `pg_terminate_backend(4821)` kills ONLY the idle ETL session + reloads PgBouncer. In-flight web transactions are untouched; pool recovery expected in <10s. The ETL job re-queues automatically at 04:00.\n\n\u2705 Pre-flight sandbox: **PASS (140ms) \u2014 0 Syntax Errors, 0 Destructive Mutations**",
          "verification_badge": "PASS (140ms) \u2014 0 Syntax Errors, 0 Destructive Mutations",
          "selected_tier": "TIER_2_HITL"
        }
      }
    ],
    "after_pause": [
      {
        "delay_ms": 500,
        "node_id": 6,
        "status": "COMPLETED",
        "state": {
          "sandbox_result": {
            "sandbox_passed": true,
            "execution_time_ms": 140,
            "strike_number": 1,
            "stdout_log": "[dry-run] parsed pg_terminate_backend(4821): single-PID target confirmed\n[dry-run] session 4821 = etl_user, idle in transaction 46m59s \u2014 rollback surface minimal\n[dry-run] 0 syntax errors, 0 destructive mutations detected",
            "verification_badge": "PASS (140ms) \u2014 0 Syntax Errors, 0 Destructive Mutations"
          },
          "hitl_decision": "APPROVED"
        }
      },
      {
        "delay_ms": 60,
        "node_id": 7,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 450,
        "node_id": 7,
        "status": "COMPLETED",
        "state": {
          "execution_status": "STABILIZED"
        }
      },
      {
        "delay_ms": 60,
        "node_id": 9,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 300,
        "node_id": 9,
        "status": "COMPLETED",
        "state": {}
      },
      {
        "delay_ms": 60,
        "node_id": 10,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 150,
        "node_id": 10,
        "status": "COMPLETED",
        "state": {}
      }
    ],
    "final_status": "RESOLVED",
    "blast": 0.51,
    "tier": "TIER_2_HITL"
  },
  "SCENARIO_3_CODE_BUG": {
    "before_pause": [
      {
        "delay_ms": 60,
        "node_id": 1,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 400,
        "node_id": 1,
        "status": "COMPLETED",
        "state": {
          "service": "pricing-api",
          "alert_name": "CrashLoopBackOff",
          "telemetry": {
            "metrics": {
              "cpu_pct": 12.4,
              "ram_pct": 38.9,
              "db_pool": {
                "used": 21,
                "max": 100
              },
              "http_5xx_rate": 0.41,
              "http_504_count_5m": 12,
              "restart_count": 14
            },
            "logs": [
              "2026-10-20T04:41:07Z INFO  uvicorn: Started server process [1]",
              "2026-10-20T04:41:09Z ERROR uvicorn: Application startup failed. Exiting.",
              "Traceback (most recent call last):",
              "  File \"app/services/pricing.py\", line 87, in compute_total",
              "    tax = cart[\"tax\"]",
              "KeyError: 'tax'",
              "2026-10-20T04:41:11Z INFO  kubelet: container pricing-api-6c8f9b7d5-j4t8w restarted (count 14)",
              "2026-10-20T04:41:11Z WARN  kubelet: backoff 5m0s \u2014 pod in CrashLoopBackOff"
            ],
            "topology": {
              "service": "pricing-api",
              "upstream": [
                "checkout-api",
                "admin-panel"
              ],
              "downstream": [
                "orders-postgres (read-only)",
                "redis-price-cache"
              ]
            }
          }
        }
      },
      {
        "delay_ms": 60,
        "node_id": 2,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 400,
        "node_id": 2,
        "status": "COMPLETED",
        "state": {
          "debate_transcript": [
            {
              "round_num": 1,
              "speaker": "Forensics",
              "model_used": "llama-3.3-70b-versatile",
              "stance": "propose",
              "argument": "The crash is deterministic: `KeyError: 'tax'` at app/services/pricing.py:87 on startup \u2014 a code bug, not infra. Live first-aid: restart the crashlooping pod to clear the wedged replica and serve from the healthy 9. Then this MUST get a Tier 3 code PR \u2014 restarting alone will not fix the exception path.",
              "proposed_action": "restart_pod(pricing-api-6c8f9b7d5-j4t8w); flag is_code_bug=true with offending_file app/services/pricing.py:87"
            }
          ]
        }
      },
      {
        "delay_ms": 60,
        "node_id": 3,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 400,
        "node_id": 3,
        "status": "COMPLETED",
        "state": {
          "debate_transcript": [
            {
              "round_num": 2,
              "speaker": "FinOps",
              "model_used": "openai/gpt-oss-120b",
              "stance": "counter",
              "argument": "Concur on restart-only: scaling a CrashLoopBackOff deployment just burns replicas on a deterministic exception (~$0.38/hr each, pure waste). 1 of 10 pods affected, stateless, instant rollback \u2014 safely autonomous. Agree the follow-up belongs to a GitOps PR with pytest proof, NOT a live hot-patch.",
              "proposed_action": "Approve single-pod restart (Tier 1); veto scale-out; defer fix to Tier 3 PR"
            }
          ]
        }
      },
      {
        "delay_ms": 60,
        "node_id": 2,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 400,
        "node_id": 2,
        "status": "COMPLETED",
        "state": {
          "debate_transcript": [
            {
              "round_num": 3,
              "speaker": "Forensics",
              "model_used": "llama-3.3-70b-versatile",
              "stance": "refine",
              "argument": "Refined: restart exactly the one crashlooping pod. Post-stabilization, the GitOps node patches `compute_total` to use `cart.get(\"tax\", 0.0)` with a regression pytest, verified in the sandbox before any PR opens.",
              "proposed_action": "restart_pod [j4t8w] -> then Node 8: <=5-line diff + pytest + PR"
            }
          ]
        }
      },
      {
        "delay_ms": 60,
        "node_id": 4,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 400,
        "node_id": 4,
        "status": "COMPLETED",
        "state": {
          "arbiter_decision": {
            "winning_summary": "Consensus: deterministic `KeyError: 'tax'` at pricing.py:87 crash-loops one of ten stateless pods. Restart the single wedged pod now (Tier 1, B=0.04); the underlying code bug then gets a Tier 3 GitOps PR with sandbox-verified pytest. No live hot-patching.",
            "command_to_run": "kubectl rollout restart pod/pricing-api-6c8f9b7d5-j4t8w",
            "mcp_tool_name": "restart_pod",
            "mcp_tool_args": {
              "pods": [
                "pricing-api-6c8f9b7d5-j4t8w"
              ],
              "strategy": "single",
              "readiness_gate_seconds": 10
            },
            "target_service": "pricing-api",
            "affected_pods": 1,
            "total_pods": 10,
            "d_risk": 0.0,
            "p_reversibility": 0.0,
            "is_code_bug": true,
            "offending_file": "app/services/pricing.py",
            "offending_line": 87,
            "live_engineer_briefing": "Tier 1 autonomous path \u2014 no briefing required (Tier 3 PR follows stabilization; see Closure Dossier)."
          }
        }
      },
      {
        "delay_ms": 60,
        "node_id": 5,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 120,
        "node_id": 5,
        "status": "COMPLETED",
        "state": {
          "blast_radius_score": 0.04,
          "selected_tier": "TIER_1_AUTONOMOUS"
        }
      },
      {
        "delay_ms": 60,
        "node_id": 6,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 700,
        "node_id": 6,
        "status": "COMPLETED",
        "state": {
          "sandbox_result": {
            "sandbox_passed": true,
            "execution_time_ms": 140,
            "strike_number": 1,
            "stdout_log": "[dry-run] parsed kubectl rollout restart: 1 target matched label app=pricing-api\n[dry-run] pod in CrashLoopBackOff \u2014 restart affects no healthy traffic\n[dry-run] 0 syntax errors, 0 destructive mutations detected",
            "verification_badge": "PASS (140ms) \u2014 0 Syntax Errors, 0 Destructive Mutations"
          },
          "hitl_decision": "AUTO_APPROVED"
        }
      }
    ],
    "after_pause": [
      {
        "delay_ms": 60,
        "node_id": 7,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 450,
        "node_id": 7,
        "status": "COMPLETED",
        "state": {
          "execution_status": "STABILIZED"
        }
      },
      {
        "delay_ms": 60,
        "node_id": 8,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 900,
        "node_id": 8,
        "status": "COMPLETED",
        "state": {
          "strike_count": 1,
          "patch_bundle": {
            "file_path": "app/services/pricing.py",
            "patch_diff": "--- a/app/services/pricing.py\n+++ b/app/services/pricing.py\n@@ -85,7 +85,7 @@\n def compute_total(cart: dict) -> float:\n     subtotal = sum(item[\"price\"] * item[\"qty\"] for item in cart[\"items\"])\n-    tax = cart[\"tax\"]\n+    tax = cart.get(\"tax\", 0.0)\n     return round(subtotal + tax, 2)",
            "pytest_code": "from app.services.pricing import compute_total\n\n\ndef test_compute_total_without_tax_key():\n    cart = {\"items\": [{\"price\": 10.0, \"qty\": 2}]}\n    assert compute_total(cart) == 20.0\n\n\ndef test_compute_total_with_tax_key():\n    cart = {\"items\": [{\"price\": 10.0, \"qty\": 1}], \"tax\": 1.5}\n    assert compute_total(cart) == 11.5\n",
            "pytest_passed": true,
            "strike_count": 1,
            "pr_url": "https://github.com/oneaboveall/pricing-api/pull/42",
            "pr_markdown_report": "## \ud83d\udc1b Fix: `KeyError: 'tax'` crash-loop in `compute_total`\n\n**Incident:** INC-NEW (pricing-api CrashLoopBackOff, 14 restarts)\n**Root cause:** `compute_total` assumed every cart carries a `tax` key; B2B guest carts omit it, raising `KeyError: 'tax'` at startup request warmup (pricing.py:87).\n\n### The fix (1 line)\n`cart[\"tax\"]` \u2192 `cart.get(\"tax\", 0.0)` \u2014 missing tax now defaults to 0.0 instead of raising.\n\n### Verification\n- [x] `pytest` \u2014 2 passed in 0.42s (sandbox-verified, strike 1/3)\n- [x] Regression test covers both tax-present and tax-absent carts\n\n*Opened autonomously by OAA Node 8 (Tier 3 GitOps). Live service was stabilized first via Tier 1 restart \u2014 this PR removes the latent root cause.*"
          }
        }
      },
      {
        "delay_ms": 60,
        "node_id": 9,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 300,
        "node_id": 9,
        "status": "COMPLETED",
        "state": {}
      },
      {
        "delay_ms": 60,
        "node_id": 10,
        "status": "RUNNING",
        "state": {}
      },
      {
        "delay_ms": 150,
        "node_id": 10,
        "status": "COMPLETED",
        "state": {}
      }
    ],
    "final_status": "RESOLVED",
    "blast": 0.04,
    "tier": "TIER_1_AUTONOMOUS"
  }
};
