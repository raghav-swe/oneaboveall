# ARCHITECTURE.md — OneAboveAll (OAA) 10-Node Topological & State Contract

> **OPENCODE / AI AGENT DIRECTIVE:** This file defines the strict topological, state-routing, and safety invariants for the **OneAboveAll (OAA)** Autonomous SRE Control Plane. Never merge nodes, alter the conditional routing equations, or bypass the FastMCP privilege firewall defined below.

---

## 1. Visual ASCII Topology (The Locked 10-Node Pipeline)

```text
                       ┌─────────────────────────────────────────────────────────┐
                       │                  1. INGESTION NODE                      │
                       │    Prometheus/Datadog Webhook ➔ Read-Only MCP Tools     │
                       └────────────────────────────┬────────────────────────────┘
                                                    │
                         ┌──────────────────────────┴──────────────────────────┐
                         ▼                                                     ▼
┌─────────────────────────────────────────────────┐   ┌─────────────────────────────────────────────────┐
│            2. FORENSICS SUBAGENT                │   │              3. FINOPS SUBAGENT                 │
│             (Groq / Llama-3.3-70B)              │   │           (Groq / OpenAI GPT-OSS-120B)          │
│     • Focuses purely on speed & uptime          │   │     • Focuses on cloud quotas, cost & risk      │
│     • Inspects logs/metrics via Read-Only MCP   │   │     • Vetoes over-scaling & retry storms        │
└────────────────────────┬────────────────────────┘   └────────────────────────┬────────────────────────┘
                         └──────────────────────────┬──────────────────────────┘
                                                    ▼
                       ┌─────────────────────────────────────────────────────────┐
                       │             4. ARBITER CONSENSUS NODE                   │
                       │               (Google Gemini 2.5 Flash)                 │
                       │    • Resolves 3-turn adversarial debate                 │
                       │    • Outputs command, risk vars, `is_code_bug` & Brief  │
                       └────────────────────────────┬────────────────────────────┘
                                                    │
                                                    ▼
                       ┌─────────────────────────────────────────────────────────┐
                       │         5. BLAST RADIUS GATE (Pure Python Math)         │
                       │       Computes B = 0.4(Ratio) + 0.4(D) + 0.2(P)         │
                       │          Enforces Stateful DB & >25% Invariants         │
                       └────────────────────────────┬────────────────────────────┘
                                                    │
                         ┌──────────────────────────┴──────────────────────────┐
                         ▼ (B <= Threshold & Stateless)                        ▼ (B > Threshold or Stateful DB)
┌─────────────────────────────────────────────────┐   ┌─────────────────────────────────────────────────┐
│        TRACK A: TIER 1 (Autonomous)             │   │       TRACK B: TIER 2 (Human-In-The-Loop)       │
│     • Auto-authorizes stateless toil fix        │   │     • Routes to Pre-Flight Sandbox first        │
│     • Zero human intervention required          │   │     • Pauses after Node 6 via `interrupt()`     │
└────────────────────────┬────────────────────────┘   └────────────────────────┬────────────────────────┘
                         └──────────────────────────┬──────────────────────────┘
                                                    ▼
                       ┌─────────────────────────────────────────────────────────┐
                       │       6. SANDBOXING & SELF-CORRECTION NODE              │
                       │    • Pre-flight command dry-run & syntax verification   │
                       │    • If Tier 2: Attaches PASS badge & calls interrupt() │
                       └────────────────────────────┬────────────────────────────┘
                                                    │
                                                    ▼
                       ┌─────────────────────────────────────────────────────────┐
                       │       7. EXECUTION NODE (via MCP Mutating Tools)        │
                       │    • Executes verified stabilization command on cluster │
                       │    • Brings live production service back online first   │
                       └────────────────────────────┬────────────────────────────┘
                                                    │
                                                    ▼
                                       ╱─────────────────────────╲
                                      ╱   CHECK: PR NEEDED?       ╲
                                     ╱   (is_code_bug == True?)    ╲
                                     ╲   Underlying Code Bug vs    ╱
                                      ╲   Pure Infra Glitch       ╱
                                       ╲────────────┬────────────╱
                                                    │
                   ┌────────────────────────────────┴────────────────────────────────┐
                   │ YES (Code Bug Found)                                            │ NO (Infra Only)
                   ▼                                                                 │
┌─────────────────────────────────────────────────┐                                  │
│         8. GITOPS CODE PR NODE (Tier 3)         │                                  │
│     • Fetches crashing snippet via GitHub/mock  │                                  │
│     • Qwen3-32B writes <=5 line diff + pytest   │                                  │
│     • Verifies pytest in Sandbox (3-Strike loop)│                                  │
│     • Opens GitHub Pull Request with PR Report  │                                  │
└────────────────────────┬────────────────────────┘                                  │
                         └──────────────────────────┬────────────────────────────────┘
                                                    ▼
                       ┌─────────────────────────────────────────────────────────┐
                       │         9. SHARED REPORTING NODE (Post-Mortem)          │
                       │    • Tier 1: Morning Digest Report                      │
                       │    • Tier 2: HITL Post-Action Audit Report              │
                       │    • Tier 3: GitOps Incident Closure Dossier            │
                       └────────────────────────────┬────────────────────────────┘
                       │
                       ▼
                       ┌─────────────────────────────────────────────────────────┐
                       │         10. FLIGHT LEDGER (Blackbox / SQLite WAL)       │
                       │    • Commits immutable chronological state snapshots    │
                       │    • Powers Frontend UI Scrubber & n8n DAG Replay       │
                       └─────────────────────────────────────────────────────────┘
```

---

## 2. Complete 10-Node Breakdown & Edge Specifications

| Node # | Function Name & File | Brain / Execution Engine | State Keys Read | State Keys Written | Outgoing Edges |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Node 1** | `ingest_node`<br>(`node_01_ingest.py`) | FastAPI + FastMCP Read-Only (`caller_node=1`) | `incident_id`, `scenario_key`, `service`, `alert_name` | `telemetry` (`metrics`, `logs`, `topology`) | Parallel fan-out to **Node 2** and **Node 3**. |
| **Node 2** | `forensics_node`<br>(`node_02_forensics.py`) | Groq LPU: `llama-3.3-70b-versatile`<br>*(Backup: `meta-llama/llama-4-scout-17b-16e-instruct`)* | `service`, `telemetry`, `debate_transcript` | Appends Forensics `DebateMessage` (Rounds 1 & 3) to `debate_transcript` | Fan-in convergence to **Node 4**. |
| **Node 3** | `finops_node`<br>(`node_03_finops.py`) | Groq LPU: `openai/gpt-oss-120b` | `service`, `telemetry`, `debate_transcript` | Appends FinOps `DebateMessage` (Round 2 counter) to `debate_transcript` | Fan-in convergence to **Node 4**. |
| **Node 4** | `arbiter_node`<br>(`node_04_arbiter.py`) | Google AI Studio: `gemini-2.5-flash` (`temperature=0.0`, `.with_structured_output(ArbiterVerdict)`) | `telemetry`, `debate_transcript` | `arbiter_decision` (includes `is_code_bug` and `live_engineer_briefing`) | Single edge to **Node 5**. |
| **Node 5** | `blast_radius_gate`<br>(`node_05_blast_radius.py`) | **100% Pure Python Math** ($0\%$ LLM) | `arbiter_decision`, `runtime_config.blast_threshold` | `blast_radius_score`, `selected_tier` (`TIER_1_AUTONOMOUS` or `TIER_2_HITL`) | Conditional split (Track A / Track B) converging into **Node 6**. |
| **Node 6** | `sandbox_node`<br>(`node_06_sandbox.py`) | Docker / Subprocess Dry-Run + LangGraph `interrupt()` | `arbiter_decision`, `selected_tier`, `strike_count`, `max_strikes` | `sandbox_result`, `hitl_decision` (`APPROVED` / `REJECTED`) | If `APPROVED` (or Tier 1) $\rightarrow$ **Node 7**. If `REJECTED` or Strikes $\ge$ Max $\rightarrow$ **Node 9**. |
| **Node 7** | `execution_node`<br>(`node_07_execution.py`) | FastMCP Mutating Tools (`caller_node=7` **ONLY**) | `arbiter_decision`, `selected_tier`, `hitl_decision` | `execution_status` (`STABILIZED` / `FAILED`) | Conditional edge `check_if_pr_needed` (`is_code_bug == True?`). |
| **Node 8** | `gitops_pr_node`<br>(`node_08_gitops_pr.py`) | Groq LPU: `qwen/qwen3-32b` + Docker `pytest` loop | `arbiter_decision`, `telemetry`, `strike_count`, `max_strikes`, `prompt_hint` | `patch_bundle` (`CodePatchBundle`), `strike_count` | Direct edge to **Node 9**. |
| **Node 9** | `shared_reporting_node`<br>(`node_09_reporting.py`) | Google AI Studio: `gemini-2.5-flash` | Full `OAAState` | `final_post_mortem_report` (Markdown string) | Direct edge to **Node 10**. |
| **Node 10** | `flight_ledger_node`<br>(`node_10_ledger.py`) | SQLite WAL Engine (`oaa_blackbox.db`) | Full `OAAState` | Finalizes `incidents` row & commits `node_snapshots` | `END` |

---

## 3. Mathematical & Routing Specifications

### 3.1 Node 5: Deterministic Blast Radius Formula ($B$)
Node 5 (`node_05_blast_radius.py`) must never invoke an LLM. It calculates the operational risk score $B \in [0.0, 1.0]$ purely in Python:

$$B = 0.40 \cdot \left(\frac{N_{\text{affected}}}{N_{\text{total}}}\right) + 0.40 \cdot D_{\text{risk}} + 0.20 \cdot P_{\text{reversibility}}$$

Where:
* $N_{\text{affected}}$ = `arbiter_decision["affected_pods"]`
* $N_{\text{total}}$ = `arbiter_decision["total_pods"]`
* $D_{\text{risk}} \in [0.0, 1.0]$ = Data statefulness risk (`0.0` = stateless worker/cache, `1.0` = stateful database mutation).
* $P_{\text{reversibility}} \in [0.0, 1.0]$ = Rollback difficulty (`0.0` = instant restart/reload, `1.0` = permanent state change).

#### Hard Safety Invariant Overrides (Evaluated in Node 5)
Regardless of the user-configured `blast_threshold` slider in `/config` (default `0.40`), Node 5 **MUST** force `selected_tier = "TIER_2_HITL"` if any of the following conditions hold:
1. **Stateful Database Lock Invariant:** $D_{\text{risk}} == 1.0$ (or `mcp_tool_name == "kill_db_pid"`).
2. **Cluster Capacity Ceiling Invariant:** $\left(\frac{N_{\text{affected}}}{N_{\text{total}}}\right) > 0.25$ ($>25\%$ of total pods affected).
3. **Threshold Breach:** $B > \text{runtime\_config.blast\_threshold}$.

Otherwise, `selected_tier = "TIER_1_AUTONOMOUS"`.

---

### 3.2 Node 6: Pre-Flight Sandbox & Tier 2 HITL `interrupt()` Protocol
Both **Track A (Tier 1)** and **Track B (Tier 2)** converge into **Node 6 (`sandbox_node`)** *before* touching the production cluster:
1. Node 6 executes a dry-run syntax and safety simulation of `arbiter_decision["command_to_run"]`.
2. It attaches `sandbox_result.verification_badge = "PASS (140ms) — 0 Syntax Errors, 0 Destructive Mutations"` to the state.
3. **If `selected_tier == "TIER_1_AUTONOMOUS"`:** Node 6 automatically sets `hitl_decision = "AUTO_APPROVED"` and proceeds immediately to **Node 7 (`execution_node`)**.
4. **If `selected_tier == "TIER_2_HITL"`:** Node 6 emits an SSE `PAUSED_HITL` event containing the **3:00 AM Live Engineer Briefing** + the **Sandbox PASS Badge**, and invokes LangGraph's `interrupt()` primitive, halting execution until `POST /api/v1/incidents/{id}/approve` resumes the graph.

---

### 3.3 Post-Stabilization Check Block (`check_if_pr_needed`)
Live production stabilization (Node 7) **always happens first**. Once Node 7 completes, the conditional router evaluates:

```python
def check_if_pr_needed(state: OAAState) -> str:
    if state.get("execution_status") != "STABILIZED":
        return "node_09_reporting"
    if state["arbiter_decision"].get("is_code_bug") is True:
        return "node_08_gitops_pr"
    return "node_09_reporting"
```

---

### 3.4 Node 8: The 3-Strike Circuit Breaker & Temporary 4th-Try Override
Inside **Node 8 (`gitops_pr_node`)**:
* `qwen/qwen3-32b` synthesizes a unified git diff ($\le 5$ changed lines), a `pytest` unit test, and the GitHub PR description.
* The sandbox container executes `pytest` in a loop up to `state["max_strikes"]` (default `3`, configurable globally in `/config`).
* If `strike_count == max_strikes` and `pytest_passed == False`:
  * The **Circuit Breaker trips**: write/PR permissions for the ticket are revoked, incident status is marked `HALTED_STRIKES`, and the graph routes to **Node 9** and **Node 10**.
* **Single-Ticket Override (from `/history` UI):** When an operator supplies a `prompt_hint` and clicks **"Run 4th Try on Node 8 Now"** (`POST /api/v1/incidents/{id}/retry-strike`), the backend increments `max_strikes` to `4` for that specific `incident_id` only, re-runs Node 8 with the hint, and completes Nodes 9 and 10.

---

## 4. FastMCP Zero-Privilege-Escalation Firewall (`backend/app/mcp/`)

| Tool Name | Category | Authorized Caller Nodes | Action Simulated / Performed |
| :--- | :--- | :--- | :--- |
| `get_pod_metrics` | `READ_ONLY` | Nodes 1, 2, 3 | Returns CPU %, RAM %, DB pool (`99/100`), and HTTP 504 rate. |
| `get_container_logs` | `READ_ONLY` | Nodes 1, 2, 3 | Returns last 50 lines of container `stderr` stack traces. |
| `get_cluster_topology` | `READ_ONLY` | Nodes 1, 2, 3 | Returns upstream/downstream service dependency DAG JSON. |
| `restart_pod` | `MUTATING` | **Node 7 ONLY** | Performs rolling restart of stateless worker pods. |
| `kill_db_pid` | `MUTATING` | **Node 7 ONLY** | Executes `pg_terminate_backend(pid)` & reloads PgBouncer. |
| `flush_redis_cache` | `MUTATING` | **Node 7 ONLY** | Flushes corrupted or OOM cache keys in Redis. |

**Enforcement Rule in `mcp/client.py`:**
```python
READ_ONLY_TOOLS = {"get_pod_metrics", "get_container_logs", "get_cluster_topology"}
MUTATING_TOOLS = {"restart_pod", "kill_db_pid", "flush_redis_cache"}

async def call_mcp_tool(caller_node: int, tool_name: str, args: dict) -> dict:
    if tool_name in MUTATING_TOOLS and caller_node != 7:
        raise PermissionError(
            f"Zero Privilege Escalation Violation: Node {caller_node} attempted to call mutating tool '{tool_name}'."
        )
    # Also check runtime_config.enabled_tools[tool_name] from /config matrix
```

---

## 5. Locked React Flow (`@xyflow/react`) Coordinates for `/history` Canvas

To ensure the interactive `n8n`-style DAG replay on Page 2 (`/history`) matches the visual architecture diagram without overlapping nodes, `frontend/src/components/dag/N8nFlowCanvas.tsx` **MUST** initialize with these exact `(x, y)` coordinates:

```typescript
export const LOCKED_DAG_NODES = [
  { id: "node-1",  label: "1. Ingestion Node",          position: { x: 400, y: 20 } },
  { id: "node-2",  label: "2. Forensics (Llama-3.3)",   position: { x: 160, y: 120 } },
  { id: "node-3",  label: "3. FinOps (GPT-OSS-120B)",   position: { x: 640, y: 120 } },
  { id: "node-4",  label: "4. Arbiter (Gemini 2.5)",    position: { x: 400, y: 220 } },
  { id: "node-5",  label: "5. Blast Radius Gate (B)",   position: { x: 400, y: 320 } },
  { id: "tier-1",  label: "Track A: Tier 1 (Auto)",     position: { x: 160, y: 420 } },
  { id: "tier-2",  label: "Track B: Tier 2 (HITL)",     position: { x: 640, y: 420 } },
  { id: "node-6",  label: "6. Pre-Flight Sandbox",      position: { x: 400, y: 520 } },
  { id: "node-7",  label: "7. MCP Execution",           position: { x: 400, y: 620 } },
  { id: "check-pr",label: "Check: is_code_bug?",        position: { x: 400, y: 720 } },
  { id: "node-8",  label: "8. GitOps Code PR (Tier 3)", position: { x: 140, y: 820 } },
  { id: "node-9",  label: "9. Shared Reporting",        position: { x: 400, y: 920 } },
  { id: "node-10", label: "10. Flight Ledger (SQLite)", position: { x: 400, y: 1020 } },
];
```

---

## 6. Streamlined Dual-Reporting Matrix (Zero Extra Latency Calls)

| Execution Path | Piggybacked Report #1 (0 Extra LLM Calls) | Final Report #2 (Generated by Node 9) |
| :--- | :--- | :--- |
| **Tier 1 (Autonomous Only)** | *None (Executes silently without waking engineer)* | **Morning Digest Report:** Summarizes overnight autonomous fix, $B$-score, and MTTR. |
| **Tier 2 (HITL Gate)** | **3:00 AM Live Engineer Briefing:** Generated inside Node 4's `ArbiterVerdict.live_engineer_briefing` + Node 6's Sandbox PASS badge. | **HITL Post-Action Audit Report:** Logs human approver decision, execution timestamp, and recovery telemetry. |
| **Tier 3 (GitOps PR)** | **GitHub PR Description Report:** Generated inside Node 8's `CodePatchBundle.pr_markdown_report`. | **GitOps Incident Closure Dossier:** Links live stabilization (Node 7) with the verified PR diff and `pytest` output (Node 8). |