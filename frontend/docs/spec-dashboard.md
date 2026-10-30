# Page 1: /dashboard - Bento Grid War Room ("5-second executive triage")

Purpose: when healthy, show a clean summary of the last resolved incident. When a Prometheus/Datadog webhook hits, the bento cards morph into live telemetry, active node tracking and a Tier 2 HITL approval alert.
Data source later: FastAPI SSE. Now: `liveIncident`, `lastResolved` in src/lib/mockData.ts.

## Layout (dark, 2-column bento)
- Top status bar: amber pill "TIER 2 HITL PAUSED: INC-4819" | "Service: checkout-worker (Postgres Lock)" | cyan SLA timer "03.42s / 20.0s" | red "Simulate Outage" dropdown button. SSE status "CONNECTED (18ms)" shown in the browser-bar area (small mono text).
- BENTO 1 - Live Telemetry & Baseline (badge: "MCP Read-Only"): 3 boxes: DB POOL 99/100 (red), HTTP 504s 34.2% (amber), RAM LOAD 61.8%. Below: mono box "Last Healthy Request (2h ago)": green check "INC-4818 (Tier 1 Auto-Heal in 4.1s) - Morning Digest Ready"; red cross "LIVE ERR: PID 4821 ExclusiveLock wait > 14,200ms".
- BENTO 2 - Active Working Node & Tri-Vendor Consensus (cyan border; tag "Node 6 -> Waiting at Tier 2 Gate"): three cards - Llama-3.3-70B (Forensics, red border), GPT-OSS-120B (FinOps, blue border), Gemini 2.5 Flash (Arbiter, amber border), each with a quoted verdict (see mockData).
- BENTO 3 - Tier 2 HITL Action Required (3:00 AM live brief; amber border; badge "Node 6 Sandbox Dry-Run: PASS (140ms)" in green): 3 bullets - Root Cause, Why HITL; mono command box `SELECT pg_terminate_backend(4821); RELOAD pgbouncer;`; buttons "APPROVE & EXECUTE (NODE 7)" (green) and "REJECT & ESCALATE" (dark).
- BENTO 4 - Blast Radius & PR Queue: "B = 0.84 (HIGH)" amber; bar with "Tier 1 Safe (<=0.40)" marker and "Current: 0.84"; line "Ratio: 1.0 | D_risk: 1.0 (DB) | P_rev: 0.2"; violet box "Queued Next: Node 8 GitOps PR" with `is_code_bug=True`.
- Bottom NODE 10 SCRUBBER: "1.Ingest ok -> 2/3.Debate ok -> 4.Arbiter ok -> 5.Blast(0.84) ok -> [Tier 2 HITL paused, amber, taller] -> 6.Sandbox ok -> 7.Exec -> 8.PR" (7 and 8 greyed). Links to /history.
- Sidebar bottom: "MOCK_ENV: OFF, Strikes: 0/3 Armed" (already built).

## Behaviors
1. Dual-state: live telemetry during an alert; clean last-resolved summary when healthy.
2. In-place HITL card: when B > 0.40 the graph pauses; Bento 3 shows the briefing and sandbox PASS badge.
3. Scrubber tracks progress of all 10 nodes and links to /history for full replay.
