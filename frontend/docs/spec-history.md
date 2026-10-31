# Page 2: /history - Blackbox Ledger & n8n-Style DAG Replay

Backed by Node 10 (SQLite Flight Ledger). Browse every incident ticket, inspect autonomous actions, HITL decisions and GitHub PRs, open an interactive 10-node canvas (@xyflow/react), and apply a TEMPORARY ticket-specific override (4th retry after the 3-strike halt).
URL example: /history?ticket=INC-4815&mode=dag-replay. Data now: `tickets` in mockData.

## Layout (3 columns)
- LEFT "Flight Blackbox Tickets" (14 total): cards
  - INC-4815 [3/3 STRIKES, red] payment-api - KeyError Patch - "Tier 3 PR Halted at Sandbox" (selected)
  - INC-4819 [TIER 2 HITL, amber] checkout-worker - DB Lock 4821 - "Approved by @sre-lead"
  - INC-4818 [TIER 1 AUTO, green] auth-cache - Redis OOM Flush - "Auto-Healed (Morning Report)"
  - Button "Open Post-Mortem Markdown"
- CENTER: a replay toolbar [▶ PLAY DAG] [⏸ PAUSE] [⏮ STEP] + "n8n-Style Live Node Inspector", then a transparent React Flow      canvas (@xyflow/react, fixed-width nodes, handles on top/bottom/left/right).
  Nodes come from `dagNodes` / `dagEdges` in mockData.ts. Do not invent nodes or move them. Layout (two columns, zigzag):
  [1] Ingestion -> splits to [2] Forensics and [3] FinOps -> [4] Arbiter -> [5] Blast Radius Gate -> Track A: Tier 1 (left) and Track B: Tier 2 (right, dashed/skipped)
  -> [6] Sandbox Dry-Run (left) -> [7] MCP Execution (right) -> "PR Needed? (YES)" (right, amber) -> [8] GitOps PR (left, red, halted) -> [9] Shared Reporting (left) -> [10] Flight Ledger Saved (right).
  Replay: DagCanvas takes `revealedCount`; `replaySteps` in mockData.ts defines 11 steps. Unrevealed nodes show dim/pending. Page starts fully lit; Play steps every 900ms and auto-stops; Step advances one; Pause freezes.
  Bottom bar (Step 2.4): "Selected Node: [8] GitOps Code PR - Status: Circuit Breaker Tripped (Strike 3/3)" from dagNodes[].status.
- RIGHT "Ticket Override Console (INC-4815)":
  - Node 8 Pytest Failure Log (mono, red): Strike 1: AssertionError line 44 / Strike 2: ImportError: decimal / Strike 3: Timeout > 5.0s [CIRCUIT BREAKER ENGAGED]
  - Amber box "Temporary Ticket Exception": "Grant a one-time 4th Sandbox Strike for INC-4815 without changing global 3-strike policy." Hint input: `Use float(cart.get('tax', 0.0))`. Button "RUN 4TH TRY ON NODE 8 NOW".
  - "Other Ticket Actions": Download .diff Patch, Force Close Incident.

## Behaviors
1. Full audit of all 3 tiers: agent debate turns, Tier 1 auto-heal or Tier 2 approve/reject, links to Tier 3 PRs.
2. Replay: Play / Pause / Step lights nodes chronologically; clicking a node shows its state snapshot.
3. 4th-strike retry is scoped to this single ticket only.
