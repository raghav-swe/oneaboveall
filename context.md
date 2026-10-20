# CONTEXT.md — OneAboveAll (OAA) Master Engineering & Architecture Blueprint

> **AGENT INSTRUCTION:** Treat this document and `ARCHITECTURE.md` as immutable architectural law. Do not invent alternative routing topologies, omit nodes, or deviate from the Pydantic/TypeScript schemas defined below.

---

## 1. Project Overview & Core Objective

**OneAboveAll (OAA)** is a zero-trust, multi-agent Autonomous Site Reliability Engineering (SRE) Control Plane and SaaS Management Platform. Rather than acting as a passive observability dashboard or an unconstrained AI shell script, OAA operates as an automated incident trauma surgeon with **Graduated Operational Trust**.

### Core Operational Paradigms
1. **Event-Driven Execution (Zero Polling Overhead):** OAA remains dormant during healthy operations and triggers exclusively via incoming monitoring webhooks (Prometheus Alertmanager, Datadog) or synthetic chaos triggers.
2. **No Vector DBs / No RAG in the Critical Path:** Live production outages require deterministic, real-time telemetry (container stderr logs, CPU/RAM metrics, database lock tables, service dependency DAGs) fetched via read-only Model Context Protocol (MCP) tools—not fuzzy semantic document search.
3. **Toil Taxonomy Separation:**
   - **Diagnostic Toil (Checking):** 100% automated in parallel via Read-Only FastMCP tools.
   - **Remediation Toil (Doing):** Strictly gated by a deterministic mathematical Blast Radius Engine ($B$) into **Tier 1 (Autonomous Stateless Fix)** or **Tier 2 (Synchronous Human-in-the-Loop Gate)**.
   - **Source Code Remediation (Patching):** Live infrastructure is always stabilized first via Tier 1 or Tier 2. Only *after* the live service is stabilized does OAA check if the root cause was an application code bug (`is_code_bug == True`), triggering **Tier 3 (Asynchronous GitOps Pull Request)** verified with `pytest` inside an isolated Docker sandbox.
4. **Streamlined Dual-Reporting Mechanism (Zero Extra Latency Calls):**
   - **Tier 1 (Autonomous):** Silent execution at night -> generates 1 report: the **Morning Digest Report** (via Node 9).
   - **Tier 2 (HITL Gate):** Generates 2 reports: (1) The **3:00 AM Live Engineer Briefing** piggybacked inside Node 4's Pydantic output (0 extra LLM calls) + Node 6 Pre-Flight Sandbox PASS badge, and (2) The **HITL Post-Action Audit Report** (via Node 9) after human approval/rejection.
   - **Tier 3 (GitOps PR):** Generates 2 reports: (1) The **GitHub PR Description Report** piggybacked inside Node 8's code-patch Pydantic output, and (2) The **GitOps Incident Closure Dossier** (via Node 9).
5. ** Dropped Scope (Do Not Implement):** Do **not** build an "LLM-as-a-Judge" evaluation node or periodic cron sweepers.

---

## 2. Tech Stack & Environment

### Monorepo Architecture
- **Repository Pattern:** Single Monorepo (`/backend` and `/frontend`) to guarantee 1:1 schema synchronization between Python Pydantic v2 models and TypeScript interfaces.

### Backend Stack (`/backend`)
- **Language & Runtime:** Python 3.11+ (workspace: CPython 3.13 on Windows; invoke via `python` / `py`)
- **Dependency Management:** `uv` with `pyproject.toml` as the source of truth (`uv.lock` pins exact versions); `requirements.txt` is generated via `uv export` for parity
- **Web Framework:** FastAPI + Uvicorn (REST API + asynchronous Server-Sent Events `text/event-stream`).
- **Agent Orchestration:** LangGraph (`StateGraph`, parallel fan-out/fan-in, `add_conditional_edges`, native `interrupt()` for Tier 2 HITL pausing).
- **Schema Validation:** Pydantic v2 (strict structured outputs for all LLM calls).
- **Tool Protocol:** FastMCP (`mcp` SDK) separating Read-Only Diagnostic Tools from Mutating Execution Tools.
- **Sandbox Engine:** Pluggable `SandboxRunner` interface — `MockDriver` (deterministic fixtures, **default** under `MOCK_ENV=true`) and `DockerDriver` (Docker Engine / subprocess, coded to spec but engaged only when a Docker daemon is reachable) — executing pre-flight command dry-runs (Node 6) and isolated `pytest` verification loops (Node 8).
- **Persistence & Blackbox Ledger:** SQLite (`oaa_blackbox.db`) configured in **Write-Ahead Logging (`PRAGMA journal_mode=WAL;`)** mode for concurrent read/write safety.
- **Graph Checkpointer:** LangGraph `AsyncSqliteSaver` on a dedicated `checkpoints.db` (also WAL) so Tier 2 `interrupt()` pauses survive server restarts; `oaa_blackbox.db` remains a pure audit ledger and never stores checkpoint state.

### Quad-Model Specialized LLM Routing Strategy
| Node / Role | Primary Model | Provider / Engine | Rationale & Configuration |
| :--- | :--- | :--- | :--- |
| **Node 2: Forensics Subagent** | `llama-3.3-70b-versatile` *(Backup: `meta-llama/llama-4-scout-17b-16e-instruct`)* | Groq LPU | Sub-second log/stack-trace analysis and Read-Only MCP tool calling. Focuses purely on uptime & MTTR speed. |
| **Node 3: FinOps Subagent** | `openai/gpt-oss-120b` | Groq LPU (~500 tok/s) | 120B open-weight reasoning model. Audits cloud quotas, compute burn, and DB retry-storm risks; vetoes reckless scaling. |
| **Node 4: Arbiter Consensus** | `gemini-2.5-flash` | Google AI Studio | `temperature=0.0` with `.with_structured_output(ArbiterVerdict)`. Synthesizes 3-turn debate, risk variables, `is_code_bug`, and 3 AM briefing. |
| **Node 8: GitOps Code PR** | `qwen/qwen3-32b` *(Fallback: `gemini-2.5-flash`)* | Groq LPU / Google | Coding-specialized model that synthesizes a `<= 5` line unified Git diff, a `pytest` unit test, and the PR markdown description. |
| **Node 9: Shared Reporting** | `gemini-2.5-flash` | Google AI Studio | Formats deterministic state variables into the final Markdown Post-Mortem Dossier. |

### Frontend Stack (`/frontend`)
- **Framework:** Next.js 15 (App Router, TypeScript), npm-managed.
- **Styling & UI:** Tailwind CSS **v3.4** (config-file style; do **not** use v4 CSS-first), Dark-mode SRE theme `#070b14` / `#090d16`, `lucide-react` icons.
- **Interactive DAG Canvas:** `@xyflow/react` (React Flow, React-19-compatible release) for the `n8n`-style 10-node workflow replay and live node inspection on `/history`.
- **Real-Time Transport:** Native browser `EventSource` / custom `useIncidentSSE` hook subscribing to FastAPI SSE streams.

---

## 3. System Architecture & Data Flow (The Locked 10-Node Topology)

### Visual ASCII Topology
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
│     • Proposes rapid technical recovery         │   │     • Vetoes over-scaling & retry storms        │
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
                                                    ▼
                       ┌─────────────────────────────────────────────────────────┐
                       │         10. FLIGHT LEDGER (Blackbox / SQLite WAL)       │
                       │    • Commits chronological node snapshots to SQLite     │
                       │    • Powers UI Scrubber & n8n-style DAG Replay          │
                       └─────────────────────────────────────────────────────────┘
```

### Node-by-Node Execution Rules
1. **Node 1 (`ingest_node`):** Receives webhook alert, calls FastMCP Read-Only tools (`get_pod_metrics`, `get_container_logs`, `get_cluster_topology`), and populates `OAAState.telemetry`.
2. **Nodes 2 & 3 (`forensics_node` & `finops_node`):** Execute a 3-turn adversarial exchange (Round 1: Forensics proposes fix -> Round 2: FinOps counters with quota/cost/cascade math -> Round 3: Forensics refines technical proposal). **Execution is strictly sequential** (`N2 R1 -> N3 R2 -> N2 R3`) so each round sees the previous one; the parallel fan-out/fan-in shown in the topology diagram is visual-only.
3. **Node 4 (`arbiter_node`):** Gemini 2.5 Flash outputs structured `ArbiterVerdict`, locking in `command_to_run`, `affected_pods`, `total_pods`, `d_risk`, `p_reversibility`, `is_code_bug`, and `live_engineer_briefing`.
4. **Node 5 (`blast_radius_gate`):** Pure Python math ($0\%$ LLM):
   $$B = 0.40 \cdot \left(\frac{N_{\text{affected}}}{N_{\text{total}}}\right) + 0.40 \cdot D_{\text{risk}} + 0.20 \cdot P_{\text{reversibility}}$$
   - **Hard Safety Invariants:** If `d_risk == 1.0` (touches stateful DB) OR `(affected_pods / total_pods) > 0.25` OR `B > runtime_config.blast_threshold` (default `0.40`), strictly route to `TIER_2_HITL`. Otherwise route to `TIER_1_AUTONOMOUS`.
5. **Node 6 (`sandbox_node`):** Both Tier 1 and Tier 2 converge here first. Performs pre-flight dry-run simulation of `command_to_run`.
   - If `selected_tier == "TIER_2_HITL"`, calls LangGraph `interrupt()` *after* attaching the green Sandbox Dry-Run PASS badge to the 3:00 AM Live Briefing, pausing execution until the human clicks Approve or Reject.
   - If the dry-run itself **fails**, increment `strike_count`; at `max_strikes`, revoke write permissions and route to Node 9 as `HALTED_STRIKES`. Node 6 never re-invokes the Arbiter for an alternative command.
6. **Node 7 (`execution_node`):** Invokes FastMCP Mutating Tools (`restart_pod`, `kill_db_pid`, `flush_redis_cache`) to stabilize the live service.
7. **Check Block (`check_if_pr_needed`):** Conditional edge after Node 7 inspecting `state["arbiter_decision"]["is_code_bug"]`.
   - If `True` -> routes to **Node 8 (`gitops_pr_node`)** then **Node 9**.
   - If `False` -> routes directly to **Node 9 (`shared_reporting_node`)**.
8. **Node 8 (`gitops_pr_node`):** Fetches offending file snippet, synthesizes `CodePatchBundle` ($\le 5$-line diff + `pytest` script + PR description), runs `pytest` inside the sandbox container (enforcing the 3-Strike Circuit Breaker), and opens a GitHub PR.
9. **Node 9 (`shared_reporting_node`):** Generates the final Markdown Post-Mortem report based on the executed path.
10. **Node 10 (`flight_ledger_node`):** Commits final incident summary and ensures every intermediate node transition is persisted in SQLite (`oaa_blackbox.db`).

### The 4 Non-Functional Runtime Guardrails
1. **Zero Privilege Escalation Invariant:** Nodes 1–3 can only access `READ_ONLY_TOOLS`. Only Node 7 is authorized to invoke `MUTATING_TOOLS`.
2. **Configurable 3-Strike Circuit Breaker:** Node 6 and Node 8 track consecutive sandbox/pytest failures (`strike_count`). At `max_strikes` (default `3`, configurable globally in `/config` or temporarily overridden to `4` per ticket in `/history`), write permissions are revoked and the ticket halts safely.
3. **End-to-End SLA Target (`< 20.0s`):** Tracked live via the UI stopwatch from webhook ingestion to stabilization/interrupt.
4. **Offline Shield (`MOCK_ENV=true`):** Bypasses external cloud APIs and Docker daemon delays using deterministic fixtures from `backend/app/mocks/scenarios.json` with `asyncio.sleep(0.35)` for realistic SSE streaming.

---

## 4. Frontend 4-Page SaaS Specification

1. **Page 1: `/dashboard` — The Bento Grid War Room (Quick Summary)**
   - **Top Bar:** Global Status Pill (`HEALTHY`, `INCIDENT ACTIVE`, `TIER 2 PAUSED`), Live `20.0s` SLA Stopwatch, and **"Simulate Outage ▼"** chaos launcher (triggers Scenarios 1, 2, or 3).
   - **Bento 1 (Live Telemetry & Baseline):** Shows CPU, RAM, DB Pool (`99/100`), HTTP 504 rate, `stderr` tail, or a summary of the **Last Healthy Resolved Request** when idle.
   - **Bento 2 (Active Working Node & Debate):** Displays the currently executing node (1–10) and live cards for Forensics (Llama-3.3), FinOps (GPT-OSS-120B), and Arbiter (Gemini 2.5 Flash).
   - **Bento 3 (Tier 2 HITL Action Alert):** Flashes Amber during `interrupt()`, displaying the **3:00 AM Live Briefing**, the **Node 6 Sandbox Dry-Run PASS Badge**, and **[Approve & Execute]** / **[Reject & Escalate]** buttons.
   - **Bento 4 (Blast Radius Gauge & PR Queue):** Semi-circular gauge for $B$-score, formula breakdown, and queued Tier 3 GitOps PR status.
   - **Bento 5 (Bottom Timeline Scrubber):** Full-width 10-node progress bar lighting up in real time with a 1-click link to replay in `/history`.
2. **Page 2: `/history` — Blackbox Ledger & `n8n`-Style Interactive DAG Replay**
   - **Left Ticket Drawer:** Filterable list of all historical and halted tickets (`INC-4819`, `INC-4815`) with Tier badges and a button to open the Markdown Post-Mortem modal.
   - **Center `n8n`-Style React Flow Canvas:** Interactive 10-node `@xyflow/react` diagram matching `ARCHITECTURE.md` with **[▶ Play]**, **[⏸ Pause]**, and **[⏮ Step]** controls to replay node transitions chronologically.
   - **Right Node Inspector & Temporary Ticket Override Console:** Clicking any node reveals its raw JSON snapshot. For tickets halted by the 3-Strike Circuit Breaker, provides a prompt hint input and **[↻ Run 4th Try on Node 8 Now]** button (temporary single-ticket override).
3. **Page 3: `/config` — Global Control Plane Governance & MCP Matrix**
   - **Autonomous Authority Slider:** Adjusts global `blast_threshold` (`0.15` strict HITL to `0.75` high autonomy; default `0.40`).
   - **Hard Invariant Locks:** Displays enforced Stateful DB lock and `<= 25%` cluster capacity ceiling.
   - **Global Circuit Breaker Policy:** Selector to permanently shift global strike limit between `2`, `3`, `4`, or `5` strikes.
   - **FastMCP Tool Permission Matrix:** Live switches to inspect/toggle Read-Only vs. Mutating MCP tools and `MOCK_ENV` mode.
4. **Page 4: `/support` — Self-Healing Quick Fixes, FAQs & Escalation**
   - **4 One-Click Self-Healing Cards:** (1) Restart FastMCP Bridge, (2) Purge Zombie Docker Sandbox Containers, (3) Flush WAL & Unlock SQLite DB, (4) Enable Offline Shield (`MOCK_ENV=true`).
   - **Interactive Operational FAQs:** Accordion answering why incidents route to Tier 2, how the 3-strike breaker works, and why Tier 3 never hot-patches live containers.
   - **Direct Platform Support Card:** Emergency hotline, engineering email, Slack bridge, and 1-click **"Mail Diagnostic Bundle & Ticket Logs"** button.

---

## 5. Database Schema & Shared Data Models

### SQLite WAL Schema (`backend/app/core/database.py`)
```sql
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS incidents (
    incident_id TEXT PRIMARY KEY,
    service TEXT NOT NULL,
    alert_name TEXT NOT NULL,
    status TEXT NOT NULL, -- 'RUNNING', 'PAUSED_HITL', 'RESOLVED', 'HALTED_STRIKES'
    selected_tier TEXT,
    blast_radius_score REAL,
    is_code_bug INTEGER DEFAULT 0,
    strike_count INTEGER DEFAULT 0,
    max_strikes_override INTEGER DEFAULT 3,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    final_report_md TEXT
);

CREATE TABLE IF NOT EXISTS node_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT NOT NULL,
    node_id INTEGER NOT NULL,
    node_name TEXT NOT NULL,
    status TEXT NOT NULL,
    elapsed_ms INTEGER DEFAULT 0,
    state_json TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(incident_id) REFERENCES incidents(incident_id)
);

CREATE TABLE IF NOT EXISTS runtime_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    blast_threshold REAL DEFAULT 0.40,
    global_max_strikes INTEGER DEFAULT 3,
    mock_env INTEGER DEFAULT 1,
    tool_permissions_json TEXT NOT NULL
);
```

### Python Pydantic v2 Models (`backend/app/schemas/models.py`)
```python
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal

class DebateMessage(BaseModel):
    round_num: int
    speaker: Literal["Forensics", "FinOps"]
    model_used: str
    stance: str
    argument: str
    proposed_action: str

class ArbiterVerdict(BaseModel):
    winning_summary: str = Field(description="Concise synthesis of the 3-turn debate")
    command_to_run: str = Field(description="Exact MCP tool or shell stabilization command")
    mcp_tool_name: Literal["restart_pod", "kill_db_pid", "flush_redis_cache"]
    mcp_tool_args: Dict[str, Any]
    target_service: str
    affected_pods: int = Field(ge=1)
    total_pods: int = Field(ge=1)
    d_risk: float = Field(ge=0.0, le=1.0, description="0.0 stateless, 1.0 stateful DB")
    p_reversibility: float = Field(ge=0.0, le=1.0, description="0.0 instant rollback, 1.0 permanent")
    is_code_bug: bool = Field(description="True if underlying cause is source code exception")
    offending_file: Optional[str] = None
    offending_line: Optional[int] = None
    live_engineer_briefing: str = Field(
        description="3-bullet wake-up briefing for Tier 2 HITL: (1) Root cause, (2) Why scaling was vetoed, (3) Exact impact of approving."
    )

class SandboxResult(BaseModel):
    sandbox_passed: bool
    execution_time_ms: int
    strike_number: int
    stdout_log: str
    verification_badge: str

class CodePatchBundle(BaseModel):
    file_path: str
    patch_diff: str = Field(description="Unified git diff <= 5 lines changed")
    pytest_code: str = Field(description="Unit test verifying the fix")
    pytest_passed: bool
    strike_count: int
    pr_url: Optional[str] = None
    pr_markdown_report: str = Field(description="GitHub PR body explaining root cause and diff")

class RuntimeConfigModel(BaseModel):
    blast_threshold: float = 0.40
    global_max_strikes: int = 3
    mock_env: bool = True
    enabled_tools: Dict[str, bool] = {
        "get_pod_metrics": True,
        "get_container_logs": True,
        "get_cluster_topology": True,
        "restart_pod": True,
        "kill_db_pid": True,
        "flush_redis_cache": True
    }
```

### LangGraph State Definition (`backend/app/schemas/state.py`)
```python
from typing import TypedDict, List, Dict, Any, Optional, Annotated
import operator

class OAAState(TypedDict):
    incident_id: str
    scenario_key: str
    service: str
    alert_name: str
    telemetry: Dict[str, Any]
    debate_transcript: Annotated[List[Dict[str, Any]], operator.add]
    arbiter_decision: Dict[str, Any]
    blast_radius_score: float
    selected_tier: str  # "TIER_1_AUTONOMOUS" | "TIER_2_HITL"
    sandbox_result: Dict[str, Any]
    hitl_decision: Optional[str]  # "APPROVED" | "REJECTED" | "AUTO_APPROVED" (Tier 1 only) | None
    execution_status: str
    patch_bundle: Optional[Dict[str, Any]]
    strike_count: int
    max_strikes: int
    prompt_hint: Optional[str]
    final_post_mortem_report: str
```

---

## 6. API Contracts & Endpoints (`backend/app/main.py`)

| Method | Endpoint | Purpose | Request Payload | Response / Stream Format |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/incidents/ingest` | Starts async 10-node run from webhook or chaos button | `{"scenario_key": "SCENARIO_1_STATELESS" \| "SCENARIO_2_STATEFUL_DB" \| "SCENARIO_3_CODE_BUG"}` | `{"incident_id": "INC-4819", "status": "STARTED", "stream_url": "/api/v1/incidents/INC-4819/stream"}` |
| `GET` | `/api/v1/incidents/{id}/stream` | Real-time SSE stream for `/dashboard` and `/history` | None (Query param `?id=INC-4819`) | SSE `data: {"event": "node_update", "node_id": 1..10, "status": "RUNNING"\|"COMPLETED"\|"PAUSED"\|"HALTED", "state": {...}}` |
| `POST` | `/api/v1/incidents/{id}/approve` | Resumes Tier 2 `interrupt()` pause after Node 6 | `{"decision": "APPROVED" \| "REJECTED"}` | `{"incident_id": "INC-4819", "status": "RESUMED"}` |
| `POST` | `/api/v1/incidents/{id}/retry-strike` | Grants temporary 4th strike on Node 8 in `/history` | `{"prompt_hint": "Use dict.get('tax', 0.0)"}` | `{"incident_id": "INC-4815", "max_strikes": 4, "status": "RETRIED_RESOLVED"}` |
| `GET` | `/api/v1/incidents` | Lists all Blackbox tickets & snapshots for `/history` | Optional `?tier=TIER_2` | `{"incidents": [...], "last_healthy_summary": {...}}` |
| `GET` / `PUT` | `/api/v1/config` | Fetches or updates global `/config` sliders & flags | `RuntimeConfigModel` JSON | Updated `RuntimeConfigModel` JSON |
| `POST` | `/api/v1/support/quick-fix` | Executes 1-click self-heal action on `/support` | `{"action": "RESTART_MCP" \| "PURGE_SANDBOX" \| "UNLOCK_SQLITE" \| "ENABLE_MOCK_ENV"}` | `{"status": "SUCCESS", "message": "...", "timestamp": "..."}` |

**Transport & Port Bindings:** Backend binds `:8000`, frontend `:3000`. Next.js `rewrites()` proxies `/api/*` to `:8000`, so the browser never faces CORS or SSE proxy-buffering issues. Every SSE response must send `Cache-Control: no-cache` and `X-Accel-Buffering: no`, and emit a heartbeat comment at least every 15 s so multi-hour Tier 2 pauses never drop the connection.

---

## 7. Locked Monorepo Directory Structure

```text
one-above-all/
├── .env.example
├── docker-compose.yml
├── CONTEXT.md
├── ARCHITECTURE.md
├── backend/
│   ├── pyproject.toml
│   ├── requirements.txt
│   ├── oaa_blackbox.db
│   ├── checkpoints.db
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI app, CORS, REST & SSE routes
│   │   ├── core/
│   │   │   ├── config.py            # RuntimeConfig manager & env settings
│   │   │   ├── database.py          # SQLite WAL initialization & CRUD helpers
│   │   │   └── sse_manager.py       # AsyncIO Queue pub/sub for SSE clients
│   │   ├── schemas/
│   │   │   ├── models.py            # Pydantic v2 models
│   │   │   └── state.py             # OAAState TypedDict
│   │   ├── mcp/
│   │   │   ├── server.py            # FastMCP 3 Read-Only & 3 Mutating tools
│   │   │   └── client.py            # Zero-Privilege-Escalation caller guard
│   │   ├── graph/
│   │   │   ├── llm_factory.py       # Groq (Llama, GPT-OSS, Qwen) & Gemini clients
│   │   │   ├── workflow.py          # 10-Node LangGraph builder & checkpointer
│   │   │   └── nodes/
│   │   │       ├── node_01_ingest.py
│   │   │       ├── node_02_forensics.py
│   │   │       ├── node_03_finops.py
│   │   │       ├── node_04_arbiter.py
│   │   │       ├── node_05_blast_radius.py
│   │   │       ├── node_06_sandbox.py
│   │   │       ├── node_07_execution.py
│   │   │       ├── node_08_gitops_pr.py
│   │   │       ├── node_09_reporting.py
│   │   │       └── node_10_ledger.py
│   │   └── mocks/
│   │       └── scenarios.json       # Deterministic fixtures for Scenarios 1, 2, 3 & Halted Ticket
│   ├── sandbox/
│       ├── Dockerfile
│       └── runner.py
│   └── tests/                   # Phase-gate pytest suites + smoke_api.py
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    └── src/
        ├── types/
        │   └── oaa.ts               # Exact TypeScript mirror of models.py & state.py
        ├── context/
        │   └── OAAContext.tsx       # Global state, active SSE connection, SLA timer
        ├── components/
        │   ├── layout/
        │   │   ├── Sidebar.tsx      # 4-route navigation + MOCK_ENV/Strike status
        │   │   └── TopBar.tsx       # Status pill, 20s SLA stopwatch, Simulate Outage menu
        │   ├── war-room/
        │   │   ├── TelemetryBento.tsx
        │   │   ├── ActiveNodeDebateBento.tsx
        │   │   ├── HITLApprovalBento.tsx
        │   │   ├── BlastRadiusBento.tsx
        │   │   └── BottomScrubberBento.tsx
        │   ├── dag/
        │   │   ├── N8nFlowCanvas.tsx # @xyflow/react 10-node interactive replay
        │   │   └── TicketOverridePanel.tsx
        │   └── shared/
        │       └── PostMortemModal.tsx
        └── app/
            ├── layout.tsx
            ├── page.tsx             # Redirects to /dashboard
            ├── dashboard/page.tsx   # Page 1: Bento Grid War Room
            ├── history/page.tsx     # Page 2: Blackbox Ledger & n8n DAG Replay
            ├── config/page.tsx      # Page 3: Control Plane Governance
            └── support/page.tsx     # Page 4: Self-Healing Quick Fixes & FAQs
```

---

## 8. Coding Conventions & Guardrails for AI Agents

1. **Strict Type & Schema Parity:** Every modification to `backend/app/schemas/models.py` MUST be mirrored in `frontend/src/types/oaa.ts` in the same commit.
2. **Offline-First Determinism (`MOCK_ENV=true`):** Every node (Nodes 1–10) must work 100% offline when `MOCK_ENV=true` by reading `backend/app/mocks/scenarios.json` and awaiting `asyncio.sleep(0.35)` so SSE animations stream realistically on the frontend even without cloud API keys. Nodes always invoke tools through the **real FastMCP client/server path** (so the Zero-Privilege-Escalation firewall is exercised on every run); the tool implementations read fixtures internally. LLM clients in `llm_factory.py` are fully wired but **dormant** — never instantiated while `MOCK_ENV=true`; `.env.example` documents `GROQ_API_KEY` / `GOOGLE_API_KEY` for future live mode.
3. **Zero LLM Math:** Never ask an LLM to calculate $B$ or select `TIER_1` vs `TIER_2`. Node 5 (`node_05_blast_radius.py`) must be 100% pure Python arithmetic reading `runtime_config.blast_threshold`.
4. **Role-Gated MCP Calls:** `mcp/client.py` must require `caller_node: int`. If `caller_node != 7` attempts to invoke `restart_pod`, `kill_db_pid`, or `flush_redis_cache`, raise a `PermissionError("Zero Privilege Escalation Invariant Violation")`.
5. **Pre-Seeded Historical Tickets:** On SQLite initialization (`database.py`), automatically seed 2 completed historical tickets (`INC-4818` Tier 1 Auto-Healed, and `INC-4815` Halted at 3/3 Strikes on Node 8) so `/dashboard` ("Last Healthy Request") and `/history` ("Run 4th Try on Node 8") are immediately testable on first boot.

---

## 9. Current Status & 8-Phase Implementation Roadmap

### Status
- **Architecture & Specifications:** 100% Locked (`CONTEXT.md`, `ARCHITECTURE.md`, UI/UX Specification, 8-Phase Playbook). Prompt 0 engineering decisions (uv tooling, sequential debate execution, dedicated checkpoint DB, pluggable sandbox, transport bindings, mock-only LLM posture) are integrated into both spec documents and enumerated in `PROMPTS.md` §0.
- **Version Control:** Git repository initialized; the baseline commit holds the spec documents and `PROMPTS.md` only. One commit per phase, created strictly after that phase's verification gate passes and the user approves the commit.
- **Codebase Status:** Ready for Phase 1 initialization.

### Sequential Execution Phases (1 Phase = 1 Git Commit)
- [ ] **Phase 1 — Scaffolding, Schemas & Chaos Fixtures:** Create monorepo directories, `config.py`, `models.py`, `state.py`, `oaa.ts`, and `scenarios.json` (Scenario 1 Stateless RAM Leak, Scenario 2 Postgres PID 4821 Lock, Scenario 3 Python `KeyError` + pre-seeded halted ticket `INC-4815`).
- [ ] **Phase 2 — FastMCP Server & SQLite WAL Blackbox:** Implement `mcp/server.py`, role-gated `mcp/client.py`, and `core/database.py` with WAL mode and seeded history.
- [ ] **Phase 3 — LangGraph Nodes 1 to 5:** Implement Ingest (N1), parallel Forensics (N2) & FinOps (N3), Arbiter (N4), and deterministic Blast Radius Gate (N5).
- [ ] **Phase 4 — LangGraph Nodes 6 to 10:** Implement Pre-Flight Sandbox (N6), Tier 2 `interrupt()`, MCP Execution (N7), `is_code_bug` Check Block, GitOps PR with 3-strike loop (N8), Shared Reporting (N9), and Flight Ledger (N10).
- [ ] **Phase 5 — FastAPI & SSE Streaming Gateway:** Implement `main.py` and `sse_manager.py` exposing `/ingest`, `/stream`, `/approve`, `/retry-strike`, `/incidents`, `/config`, and `/support/quick-fix`.
- [ ] **Phase 6 — Frontend Shell & Page 1 (`/dashboard`):** Build Next.js dark-mode shell, Sidebar, TopBar (20s SLA timer + Chaos Launcher), `OAAContext`, and the 5-Card Bento Grid War Room.
- [ ] **Phase 7 — Page 2 (`/history` & `n8n` Interactive DAG):** Build Blackbox ticket drawer, `@xyflow/react` 10-node replay canvas with Play/Pause/Step controls, node inspector, and the 4th-Strike Temporary Override console.
- [ ] **Phase 8 — Pages 3 & 4 (`/config` & `/support`):** Build the Blast Radius authority slider, permanent strike selector, FastMCP permission matrix, 4 self-healing quick-fix cards, FAQs, and diagnostic mailer.