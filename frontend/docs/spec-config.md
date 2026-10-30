# Page 3: /config - Global Control Plane, Authority & MCP Config

Permanent governance (unlike /history which overrides one ticket). RBAC role badge: PLATFORM_ARCHITECT.
Header: "Global Control Plane Governance & MCP Registry" - "Changes committed here apply permanently across all future LangGraph incident runs." Button "Save & Hot-Reload Config". Data now: `defaultConfig` in mockData.

## Sections
1. AUTONOMOUS AUTHORITY & BLAST RADIUS GATE - slider, label "Threshold: B <= 0.40". Help text: lower the slider = more human HITL prompts; raise it = broader Tier 1 autonomy. Preset markers: Strict HITL (0.15), Balanced Default (0.40), High Autonomy (0.75). Locked rows: "Hard-Lock Stateful DB Mutations to Tier 2 - ENFORCED", "Max Cluster Pods Allowed in Tier 1 Auto-Scale <= 25% Capacity".
2. GLOBAL CIRCUIT BREAKER STRIKE POLICY (Nodes 6 & 8) - segmented: 2 Strikes | 3 Strikes (Std) | 4 Strikes (Active) | 5 Strikes. Text: "Permanently configure how many consecutive sandbox/tool failures are allowed before revoking write permissions."
3. FASTMCP TOOL PERMISSION MATRIX (badge: Zero Privilege Escalation)
   - READ-ONLY DIAGNOSTIC TOOLS (Nodes 1, 2, 3): `mcp:/get_pod_metrics & get_logs` [ENABLED - READ]
   - MUTATING EXECUTION TOOLS (Node 7 only): `mcp:/restart_stateless_pod` [TIER 1 AUTO ALLOWED]; `mcp:/pg_terminate_backend` [LOCKED TO TIER 2 HITL]; `mcp:/drop_or_truncate_table` [PERMANENTLY REVOKED]
4. TRI-VENDOR LLM ROUTING & OFFLINE SHIELD (MOCK_ENV=false): Forensics (N2) llama-3.3-70b, FinOps (N3) gpt-oss-120b, Arbiter (N4) gemini-2.5-flash.

## Behaviors
1. Dynamic authority tuning via the B-score cutoff and capacity ceiling.
2. Permanent strike override (global), unlike the one-ticket retry in /history.
3. MCP permission firewall: read-only tools separated from mutating tools; revoked tools cannot be re-enabled.
