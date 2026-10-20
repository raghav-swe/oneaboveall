# PROMPTS.md — OneAboveAll (OAA) 8-Phase Implementation Playbook

> **HOW TO USE THIS FILE:** Hand the agent exactly ONE phase prompt at a time, in order.
> A phase may only start after the previous phase's **Verification Gate** has passed and the
> user has explicitly approved the phase commit. Never merge phases, never jump ahead.
> `CONTEXT.md` and `ARCHITECTURE.md` remain immutable architectural law — these prompts
> reference them; they do not replace them.

---

## §0. Locked Decisions (from Prompt 0 — binding on ALL phases)

1. **Env tooling:** `uv` manages the backend (`pyproject.toml` = source of truth, `uv.lock` pins; `requirements.txt` is *generated* via `uv export` for spec parity). Python 3.13.7 on Windows; use `python`/`py`, never `python3`.
2. **Debate execution:** The 3-turn debate runs **sequentially** — `N2(R1) → N3(R2) → N2(R3)` — so each round genuinely sees the previous one. The parallel fan-out in the ASCII diagram and React-Flow canvas is **visual only** and stays untouched.
3. **Checkpointer:** `AsyncSqliteSaver` on a dedicated `backend/checkpoints.db` (WAL). `oaa_blackbox.db` stays a pure audit ledger. Tier 2 `interrupt()` state must survive uvicorn restarts.
4. **Sandbox engine:** Pluggable `SandboxRunner` ABC with `MockDriver` (fixtures, **default**) and `DockerDriver` (coded to spec, dormant until a Docker daemon exists). No Docker is installed on this machine.
5. **Node 6 dry-run failure:** Deterministic `strike_count` increment; at `max_strikes` → revoke writes → route N9 → N10 as `HALTED_STRIKES`. Never re-invoke the Arbiter for a new command.
6. **LLM mode:** `MOCK_ENV=true` for the entire build. `llm_factory.py` ships real Groq/Gemini clients fully wired but **dormant** (instantiated only when `MOCK_ENV=false`). `.env.example` documents `GROQ_API_KEY` / `GOOGLE_API_KEY`.
7. **Git:** `git init` happens in Phase 1. One commit per phase, only after the gate passes, and **only after explicit user confirmation for that commit**.
8. **Ports & transport:** Backend `:8000`, frontend `:3000`. Next.js `rewrites()` proxies `/api/*` → `:8000`, eliminating CORS and SSE-buffering issues. SSE uses `text/event-stream`, `X-Accel-Buffering: no`, and 15 s heartbeats.
9. **`hitl_decision`** state union is extended to include `"AUTO_APPROVED"` (Tier-1-only value), resolving the CONTEXT §5 vs ARCHITECTURE §3.2 mismatch.
10. **`/retry-strike`:** Rehydrates state from the halted ticket's **latest `node_snapshots.state_json`**, applies `max_strikes=4` + operator `prompt_hint` for that `incident_id` only, re-enters the graph at **Node 8**, then completes N9 → N10.
11. **Mock-aware MCP tools:** Nodes 1–10 always exercise the **real FastMCP call path** (preserving the privilege-firewall test surface). The tools themselves read `scenarios.json` fixtures when `MOCK_ENV=true`.
12. **Frontend package manager:** npm (only installed option). Next.js 15 + React 19-compatible `@xyflow/react`. Tailwind **v3.4** (config-file style matches the locked `tailwind.config.ts`; do not use v4 CSS-first).

### Global rules for every phase
- Read `CONTEXT.md`, `ARCHITECTURE.md`, and this file before acting.
- Make **minimal** changes scoped to the current phase. Do **not** create files belonging to future phases beyond inert stubs explicitly listed below.
- Mirror rule: any change to `backend/app/schemas/models.py` or `state.py` requires the matching change to `frontend/src/types/oaa.ts` **in the same phase**.
- Every Python/TS identifier, endpoint path, table name, and env var must match the spec docs exactly.
- End the phase by: running the Verification Gate → reporting results → awaiting user confirmation → committing → **stopping** until the next phase prompt is handed over.

---
---

## PHASE 1 — Scaffolding, Schemas & Chaos Fixtures

**Objective:** Establish the complete monorepo skeleton, toolchain, every Pydantic/TypeScript schema, and the deterministic mock fixture universe. **Zero runtime logic.**

### Deliverables

1. **Git + hygiene**
   - `git init` in the repo root.
   - Root `.gitignore`: `.venv/`, `__pycache__/`, `*.pyc`, `node_modules/`, `.next/`, `dist/`, `.env`, `backend/oaa_blackbox.db*`, `backend/checkpoints.db*`, `*.db-wal`, `*.db-shm`, `.DS_Store`, `Thumbs.db`.

2. **Toolchain**
   - Install `uv` (PowerShell: `irm https://astral.sh/uv/install.ps1 | iex`); verify `uv --version`.
   - `uv venv .venv` at repo root (single venv serving the backend).

3. **Backend scaffold** (exact tree per CONTEXT §7 — folders + `__init__.py` only, no logic):
   - `backend/app/{__init__.py, main.py(stub raising NotImplementedError on import is NOT needed — leave a docstring placeholder)}`
   - `backend/app/core/`, `backend/app/schemas/`, `backend/app/mcp/`, `backend/app/graph/nodes/`, `backend/app/mocks/`, `backend/sandbox/`, `backend/tests/`.
   - **Note:** `backend/tests/` is an intentional, minimal addition to the locked tree (needed for phase gates). Everything else matches §7 exactly.

4. **`backend/pyproject.toml`** — uv-managed. Dependencies (pin via `uv add`, let `uv.lock` lock exact versions):
   - Runtime: `fastapi`, `uvicorn[standard]`, `pydantic>=2`, `pydantic-settings`, `langgraph` (recent stable exposing `langgraph.types.interrupt`), `langgraph-checkpoint-sqlite`, `langchain-core`, `langchain-groq`, `langchain-google-genai`, `fastmcp>=2`, `aiosqlite`, `httpx`, `python-dotenv`.
   - Dev: `pytest`, `pytest-asyncio`.
   - Generate `backend/requirements.txt` via `uv export --no-hashes -o requirements.txt` (re-generated in every later phase that adds deps).

5. **Root `.env.example`**: `MOCK_ENV=true`, `GROQ_API_KEY=`, `GOOGLE_API_KEY=`, `BLAST_THRESHOLD=0.40`, `GLOBAL_MAX_STRIKES=3`, `DATABASE_PATH=backend/oaa_blackbox.db`, `CHECKPOINT_DB_PATH=backend/checkpoints.db`, `BACKEND_PORT=8000`, `FRONTEND_PORT=3000`.

6. **`backend/app/core/config.py`** — env loading via `pydantic-settings`; exposes a `RuntimeConfig` manager API (get/update) that Phase 2 backs with the `runtime_config` table. Config values: `blast_threshold`, `global_max_strikes`, `mock_env`, `enabled_tools` (exact 6-key dict from CONTEXT §5).

7. **`backend/app/schemas/models.py`** — the exact Pydantic v2 models from CONTEXT §5: `DebateMessage`, `ArbiterVerdict`, `SandboxResult`, `CodePatchBundle`, `RuntimeConfigModel`.
   - **Permitted micro-fix (schema-identical):** replace the mutable-class-attribute default `enabled_tools: Dict[str, bool] = {...}` with `Field(default_factory=lambda: {...})` for Pydantic v2 correctness. Document the deviation in a one-line comment.

8. **`backend/app/schemas/state.py`** — exact `OAAState` TypedDict from CONTEXT §5, with the `hitl_decision` comment widened to `# "APPROVED" | "REJECTED" | "AUTO_APPROVED" | None`.

9. **`frontend/` scaffold** — `package.json` (pinned: `next@15`, `react`, `react-dom`, `@xyflow/react` (React-19-compatible release), `lucide-react`, `tailwindcss@^3.4`, `postcss`, `autoprefixer`, `typescript`, `@types/*`), `tsconfig.json`, `tailwind.config.ts` with the SRE dark tokens (`#070b14`, `#090d16`) and `postcss.config.js`. Run `npm install`.
   - Create **only** `frontend/src/types/` at this stage — no `app/`, `components/`, or `context/` code (those land in Phase 6).

10. **`frontend/src/types/oaa.ts`** — exact TypeScript mirror of every model in `models.py`, `OAAState`, plus the SSE event envelope: `type NodeStatus = "RUNNING"|"COMPLETED"|"PAUSED"|"HALTED"; interface SSENodeEvent { event: "node_update"; node_id: number; status: NodeStatus; state: Partial<OAAState>; }`.

11. **`backend/app/mocks/scenarios.json`** — the offline-determinism core. Must validate against the Pydantic models. Required top-level blocks:
    - `SCENARIO_1_STATELESS` — RAM leak / OOM across a small subset of stateless worker pods; tool = `restart_pod`; `affected_pods/total_pods ≤ 0.25`, `d_risk = 0.0`, `p_reversibility = 0.0`, `is_code_bug = false` → **TIER_1** path. Include: telemetry (metrics/logs/topology: CPU, RAM climbing, DB pool normal, stderr tail), scripted 3-turn debate transcript (R1/R2/R3 `DebateMessage`s), arbiter verdict JSON, sandbox PASS result, execution STABILIZED result, final Morning Digest markdown.
    - `SCENARIO_2_STATEFUL_DB` — Postgres blocking lock held by **PID 4821**, DB connection pool `99/100`, HTTP 504 spike; tool = `kill_db_pid`; `d_risk = 1.0` → **forced TIER_2_HITL** regardless of threshold; `is_code_bug = false`. Include the full `live_engineer_briefing` (3 bullets: root cause / why scaling vetoed / exact approval impact) and HITL Post-Action Audit markdown.
    - `SCENARIO_3_CODE_BUG` — Python `KeyError: 'tax'` crashing pods (offending file e.g. `app/services/pricing.py`, explicit `offending_line`); stabilization = `restart_pod` with small blast radius → **TIER_1**, then `is_code_bug = true` → **Tier 3**. Include: `CodePatchBundle` fixture with a **≤ 5-line unified diff** (fix via `dict.get('tax', 0.0)`), a `pytest_code` fixture, scripted per-strike pytest outcomes for the **live** run (passes within 3 strikes), a mock `pr_url`, the PR markdown report, and the GitOps Incident Closure Dossier markdown.
    - `SEEDED_TICKETS` — two complete historical records used by Phase 2 DB seeding:
      - `INC-4818`: Tier 1 auto-healed, `RESOLVED`, full snapshot chain 1→7, 9, 10 (Node 8 skipped — infra-only).
      - `INC-4815`: code-bug ticket, `HALTED_STRIKES`, snapshots 1→7 then **Node 8 recorded 3/3 failed strikes**, then 9, 10; carries the same `KeyError: 'tax'` bug DNA as Scenario 3 so the 4th-strike override (with `prompt_hint: "Use dict.get('tax', 0.0)"`) can deterministically succeed.
    - Every snapshot in `SEEDED_TICKETS` includes realistic `node_id`, `node_name`, `status`, `elapsed_ms`, and `state_json`.

12. **`backend/sandbox/` stubs** — `Dockerfile` (static spec artifact: `python:3.11-slim` + `pytest` installed + `WORKDIR /sandbox`) and `runner.py` containing **only** the `SandboxRunner` ABC signatures (`dry_run(...)`, `run_pytest(...)`) — no implementations until Phase 4.

### Verification Gate (all must pass)
1. `uv --version` succeeds; `uv sync` clean; `uv run python -c "import fastapi, pydantic, langgraph, langgraph.types, fastmcp, aiosqlite, langchain_groq, langchain_google_genai"` exits 0.
2. `uv run python -c` one-liner loading `scenarios.json`, asserting keys `SCENARIO_1_STATELESS / SCENARIO_2_STATEFUL_DB / SCENARIO_3_CODE_BUG / SEEDED_TICKETS`, and round-tripping every fixture sub-object through its Pydantic model (`ArbiterVerdict(**...)`, `DebateMessage(**...)`, `CodePatchBundle(**...)`, etc.).
3. `cd frontend && npx tsc --noEmit` exits 0.
4. Printed directory tree matches CONTEXT §7 (+ `backend/tests/`, + this `PROMPTS.md`).
5. Blast-radius sanity (pure math check via a throwaway `python -c`): S1 fixture numbers → TIER_1; S2 `d_risk=1.0` → TIER_2; ratio `>0.25` → TIER_2. (No Node 5 file yet — verify fixture arithmetic by hand here.)

### Forbidden in this phase
Any node logic, MCP server/client code, API routes, React components/pages, or database code.

### Commit (after gate + user confirmation)
`Phase 1: Monorepo scaffolding, Pydantic/TS schemas, and deterministic chaos fixtures`

---
---

## PHASE 2 — FastMCP Server & SQLite WAL Blackbox

**Objective:** Implement the tool layer (`mcp/server.py`, `mcp/client.py`) and the persistence layer (`core/database.py`) with WAL mode and seeded history.

### Deliverables

1. **`backend/app/core/database.py`**
   - `init_db()`: executes `PRAGMA journal_mode=WAL;` (+ `PRAGMA synchronous=NORMAL;`), creates the three tables **verbatim** from CONTEXT §5 (`incidents`, `node_snapshots`, `runtime_config`), and inserts the singleton `runtime_config` row (`id=1`, defaults from env) if absent.
   - **Seeding (idempotent):** on init, if `incidents` is empty, insert `INC-4818` and `INC-4815` with their complete `node_snapshots` chains from `scenarios.json.SEEDED_TICKETS` (INC-4818: RESOLVED/TIER_1_AUTONOMOUS; INC-4815: HALTED_STRIKES with `strike_count=3`, `max_strikes_override=3`).
   - Async CRUD helpers (`aiosqlite`, per-call connections, `row_factory=aiosqlite.Row`): `create_incident`, `update_incident_status`, `set_final_report`, `insert_node_snapshot`, `list_incidents(tier: str | None)`, `get_incident`, `get_snapshots(incident_id)`, `get_latest_snapshot(incident_id)`, `get_runtime_config`, `update_runtime_config`, `next_incident_id()` (`INC-<max+1>`, aware of seeds → next is `INC-4819`, matching CONTEXT §6's ingest example), and `get_last_healthy_summary()` (latest RESOLVED ticket digest for the idle dashboard bento).
   - Wire `core/config.py`'s `RuntimeConfig` manager to these helpers.

2. **`backend/app/mcp/server.py`** — FastMCP server exposing the six tools with **exact** names: `get_pod_metrics`, `get_container_logs`, `get_cluster_topology`, `restart_pod`, `kill_db_pid`, `flush_redis_cache`.
   - Every tool is mock-aware per Locked Decision 11: with `MOCK_ENV=true` it reads the active scenario's fixtures from `scenarios.json` (scenario resolved via a contextvar/param set by the ingest path); with `MOCK_ENV=false` it currently returns the same fixtures while logging a loud "LIVE MODE NOT PROVISIONED — serving fixtures" warning (mock-only build, per Locked Decision 6).

3. **`backend/app/mcp/client.py`** — single async entry point:
   ```python
   READ_ONLY_TOOLS = {"get_pod_metrics", "get_container_logs", "get_cluster_topology"}
   MUTATING_TOOLS = {"restart_pod", "kill_db_pid", "flush_redis_cache"}
   async def call_mcp_tool(caller_node: int, tool_name: str, args: dict) -> dict
   ```
   - Enforcement (ARCHITECTURE §4 verbatim): mutating tool + `caller_node != 7` → `PermissionError("Zero Privilege Escalation Violation: Node {caller_node} attempted to call mutating tool '{tool_name}'.")`.
   - Also rejects tools disabled in `runtime_config.enabled_tools` (`/config` matrix) with a clear `PermissionError`.
   - Transport: fastmcp 2.x **in-memory `Client`** bound to the in-process FastMCP server instance (verify exact API against the pinned fastmcp version at implementation time; the firewall logic lives in this file regardless of transport choice).

4. **`backend/tests/test_mcp_firewall.py`** — node 1/2/3 calling each mutating tool raises `PermissionError`; node 7 succeeds; read-only tools callable from nodes 1–3; a tool toggled off in `enabled_tools` is blocked; unknown tool name raises.

5. **`backend/tests/test_database.py`** — WAL mode confirmed (`PRAGMA journal_mode` → `wal`); exactly 2 seeded incidents on fresh init; seeding is idempotent (second `init_db()` adds nothing); CRUD roundtrip; `next_incident_id()` → `INC-4819`; `runtime_config` singleton read/update roundtrip.

### Verification Gate
1. `uv run pytest backend/tests/ -v` — all green.
2. One-liner: open the DB, print `PRAGMA journal_mode;` → `wal`, and `SELECT incident_id, status, selected_tier FROM incidents;` → the two seed rows.
3. Live-fire demo via `python -c`: `call_mcp_tool(caller_node=1, tool_name="restart_pod", args={})` raises the exact spec `PermissionError`; `call_mcp_tool(caller_node=7, tool_name="restart_pod", args={"pod": "worker-7f9c6d5b4-x2v1l"})` returns fixture JSON.

### Forbidden in this phase
LangGraph nodes/workflow, FastAPI routes, SSE, frontend work.

### Commit (after gate + user confirmation)
`Phase 2: FastMCP tool server, zero-privilege client firewall, SQLite WAL blackbox ledger`

---
---

## PHASE 3 — LangGraph Nodes 1–5 (Ingest → Sequential Debate → Arbiter → Blast Gate)

**Objective:** Implement the LLM factory, Nodes 1–5, and a **partial** compiled graph covering N1→N5 with correct tier routing for all three scenarios.

### Deliverables

1. **`backend/app/graph/llm_factory.py`** — per-node model constants (N2 `llama-3.3-70b-versatile` w/ backup `meta-llama/llama-4-scout-17b-16e-instruct`; N3 `openai/gpt-oss-120b`; N4 `gemini-2.5-flash` `temperature=0.0`; N8 `qwen/qwen3-32b` w/ fallback `gemini-2.5-flash`; N9 `gemini-2.5-flash`). Lazy client constructors (`ChatGroq`, `ChatGoogleGenerativeAI`) that are **never instantiated when `MOCK_ENV=true`**; missing API keys in live mode raise an explicit, actionable error.

2. **`backend/app/graph/nodes/node_01_ingest.py`** — reads `incident_id/scenario_key/service/alert_name` from state; calls the three read-only tools via `call_mcp_tool(caller_node=1, ...)`; populates `state["telemetry"] = {"metrics": ..., "logs": ..., "topology": ...}`. Mock pacing: `await asyncio.sleep(0.35)`.

3. **`backend/app/graph/nodes/node_02_forensics.py`** — exports `forensics_round1(state)` and `forensics_round3(state)`; appends Forensics `DebateMessage`s to `debate_transcript` (which uses the `Annotated[..., operator.add]` reducer).
4. **`backend/app/graph/nodes/node_03_finops.py`** — exports `finops_round2(state)` (reads R1 from transcript, counters with quota/cost/cascade math).
   - Mock mode: scripted messages from `scenarios.json` with 0.35 s pacing. Live mode: real calls with structured `DebateMessage` output (dormant).

5. **`backend/app/graph/nodes/node_04_arbiter.py`** — mock: fixture `ArbiterVerdict`; live: `gemini-2.5-flash` `.with_structured_output(ArbiterVerdict)`. Writes `state["arbiter_decision"]` as a plain dict (`model_dump()`).

6. **`backend/app/graph/nodes/node_05_blast_radius.py`** — **0% LLM.** Expose pure function:
   `compute_blast_radius(affected_pods, total_pods, d_risk, p_reversibility, blast_threshold) -> tuple[float, str]`
   implementing `B = 0.4·(affected/total) + 0.4·D + 0.2·P` and the three hard overrides (ARCHITECTURE §3.1: `D==1.0` or tool is `kill_db_pid`; ratio `>0.25`; `B > threshold`). The node reads `blast_threshold` from `runtime_config` via `database.get_runtime_config()` and writes `blast_radius_score` + `selected_tier`.

7. **`backend/app/graph/workflow.py` (PARTIAL build)** — `build_partial_graph()` wiring:
   `N1 → N2_R1 → N3_R2 → N2_R3 → N4 → N5` (sequential debate per Locked Decision 2). Include the **instrumentation wrapper** used for every node: records start/end, inserts a `node_snapshots` row (node_id, name, status, elapsed_ms, full `state_json`), and invokes an injected optional async `event_sink(event_dict)` callback (default no-op — Phase 5 will inject the SSE broadcaster). Keep the full 10-node builder for Phase 4 in the same file.

8. **Tests** — `backend/tests/test_blast_radius.py`: boundary table (ratio exactly 0.25 vs 0.250…1; `D=1.0` override; `B` exactly at threshold vs one ulp over; `kill_db_pid` name override). `backend/tests/test_graph_n1_n5.py`: run the partial graph end-to-end for all three scenarios against a temp DB; assert `S1→TIER_1_AUTONOMOUS`, `S2→TIER_2_HITL`, `S3→TIER_1_AUTONOMOUS`; assert 3 debate messages in order Forensics→FinOps→Forensics; assert one snapshot row per executed node.

### Verification Gate
1. `uv run pytest backend/tests/ -v` — all green (Phases 2 + 3 suites).
2. Demo one-liner per scenario printing the computed `B` and `selected_tier` from an actual partial-graph run.

### Forbidden in this phase
Nodes 6–10 logic, `interrupt()`, checkpointer wiring (not needed until N6 exists), FastAPI, frontend.

### Commit (after gate + user confirmation)
`Phase 3: LangGraph nodes 1-5, sequential adversarial debate, deterministic blast radius gate`

---
---

## PHASE 4 — LangGraph Nodes 6–10, Interrupt & Full 10-Node Workflow

**Objective:** Complete the graph: sandbox + HITL interrupt, execution, GitOps PR loop, reporting, ledger; full checkpointer integration; retry-strike re-entry support.

### Deliverables

1. **`backend/sandbox/runner.py`** — implement the Phase 1 ABC: `MockDriver` (scripted dry-run/pytest outcomes from `scenarios.json`, 0.35 s pacing, honors `prompt_hint` by selecting the "fixed" fixture branch) and `DockerDriver` (build/run the Phase 1 `Dockerfile`, mount patch, exec `pytest`; only engaged when `MOCK_ENV=false` **and** a daemon is reachable — otherwise raise a clear error). `get_runner()` factory selects per config.

2. **`node_06_sandbox.py`** — dry-run via runner of `arbiter_decision.command_to_run`; attach badge `verification_badge = "PASS (140ms) — 0 Syntax Errors, 0 Destructive Mutations"` (fixture timing).
   - **Tier 1:** set `hitl_decision="AUTO_APPROVED"` → continue.
   - **Tier 2:** emit `PAUSED_HITL` (briefing + badge) through the event sink, then `langgraph.types.interrupt({...briefing payload...})`; the resume value (from `/approve`) sets `hitl_decision`.
   - **Dry-run FAIL (Locked Decision 5):** `strike_count += 1`; if `strike_count >= max_strikes` → status `HALTED_STRIKES`, route to N9. No Arbiter re-query.
   - Conditional edges out of N6: `APPROVED`/`AUTO_APPROVED` → N7; `REJECTED` or halted → N9.

3. **`node_07_execution.py`** — invoke `arbiter_decision.mcp_tool_name` via `call_mcp_tool(caller_node=7, ...)`; set `execution_status = "STABILIZED" | "FAILED"` from the (mock) tool result.

4. **`check_if_pr_needed`** — implement the conditional router **verbatim** from ARCHITECTURE §3.3.

5. **`node_08_gitops_pr.py`** — fetch offending snippet (mock), synthesize `CodePatchBundle` (mock fixture; live = `qwen/qwen3-32b` dormant), pytest loop via runner up to `state["max_strikes"]`; breaker trip at max with failing pytest → revoke writes, `HALTED_STRIKES`, route N9. Success → set `patch_bundle` incl. mock `pr_url`.

6. **`node_09_reporting.py`** — tier-aware markdown: Morning Digest (T1) / HITL Post-Action Audit (T2, includes human decision + timestamps) / GitOps Incident Closure Dossier (T3, links N7 stabilization + N8 diff/pytest). Mock: deterministic templates from state; live: `gemini-2.5-flash` (dormant).

7. **`node_10_ledger.py`** — finalize the `incidents` row (`status`, `selected_tier`, `blast_radius_score`, `is_code_bug`, `strike_count`, `final_report_md`) and write the terminal snapshot. (Intermediate snapshots already flow from the Phase 3 instrumentation wrapper.)

8. **`workflow.py` (FULL)** — all 10 nodes + conditional edges (N5 tier split converging at N6, N6 decision edges, `check_if_pr_needed` after N7, N8→N9→N10→END). Compile with `AsyncSqliteSaver` on `backend/checkpoints.db` (WAL), `interrupt()` enabled. Expose `build_graph(event_sink=None)` used by both tests and Phase 5. Add the **retry-strike re-entry helper**: `resume_from_snapshot(incident_id, prompt_hint)` — loads latest snapshot `state_json`, sets `max_strikes=4` (per-ticket only) and `prompt_hint`, re-enters the compiled graph at `node_08` (via a fresh `thread_id` suffix, e.g. `{incident_id}-retry-4`, so checkpoint history never collides with the halted original thread).

9. **Tests — `backend/tests/test_graph_full.py`:**
   - **S1 full run:** path = 1,2,3,2,4,5,6,7,9,10 (debate rounds counted distinctly where recorded), `RESOLVED`, Tier 1, Morning Digest present, `hitl_decision="AUTO_APPROVED"`.
   - **S2 interrupt/resume:** run until `__interrupt__`; assert paused + briefing payload; resume `APPROVED` → `RESOLVED`; separate run resume `REJECTED` → routes to N9 audit report, N7 never executes (assert no mutating tool call recorded).
   - **Restart survival:** after pausing S2, construct a **new** `AsyncSqliteSaver` + recompiled graph on the same `checkpoints.db`/`thread_id` and resume successfully (proves Locked Decision 3).
   - **S3 Tier 3:** PR created, `pytest_passed=true`, dossier present.
   - **Halted path:** fixture-forced 3× pytest failures → `HALTED_STRIKES`, then `resume_from_snapshot` with hint → Node 8 succeeds on strike 4 → `RESOLVED`.

### Verification Gate
1. `uv run pytest backend/tests/ -v` — entire suite green.
2. Restart-survival test output shown explicitly (this is the riskiest mechanic — call it out in the gate report).

### Forbidden in this phase
FastAPI routes/SSE, frontend. (`event_sink` stays an injected no-op default.)

### Commit (after gate + user confirmation)
`Phase 4: Nodes 6-10, HITL interrupt with sqlite checkpointer, GitOps 3-strike loop, full workflow`

---
---

## PHASE 5 — FastAPI & SSE Streaming Gateway

**Objective:** Expose the graph over the exact §6 API contract with real-time SSE.

### Deliverables

1. **`backend/app/core/sse_manager.py`** — per-`incident_id` `asyncio.Queue` pub/sub: `publish(incident_id, event)`, `subscribe(incident_id)` (async generator yielding SSE-framed strings), `unsubscribe`; 15 s heartbeat comments (`: ping\n\n`) so idle Tier-2 pauses never drop; terminal event closes the stream cleanly.

2. **`backend/app/main.py`** — lifespan: `init_db()` (WAL + seeds), open `AsyncSqliteSaver`, `build_graph(event_sink=sse_manager.publish)`; CORS permissive (moot behind the proxy, harmless for direct hits). Endpoints **verbatim** from CONTEXT §6:
   - `POST /api/v1/incidents/ingest` — allocate `incident_id` via `next_incident_id()`, insert `RUNNING` row, `asyncio.create_task` the graph (`config={"configurable": {"thread_id": incident_id}}`), return `{incident_id, status: "STARTED", stream_url}`.
   - `GET /api/v1/incidents/{id}/stream` — `StreamingResponse`/`EventSourceResponse`, headers `Cache-Control: no-cache`, `X-Accel-Buffering: no`.
   - `POST /api/v1/incidents/{id}/approve` — `graph.ainvoke(Command(resume={"decision": payload.decision}), config=...)`; reject `REJECTED`-vs-`APPROVED` invalid values 422; 404 unknown incident; 409 if not paused.
   - `POST /api/v1/incidents/{id}/retry-strike` — `resume_from_snapshot` from Phase 4; returns `{incident_id, max_strikes: 4, status: "RETRIED_RESOLVED"}` (or current status if still running when the response is sent — match §6 contract shape).
   - `GET /api/v1/incidents` (+ optional `?tier=`) — `{incidents: [...], last_healthy_summary: {...}}`.
   - `GET/PUT /api/v1/config` — `RuntimeConfigModel` roundtrip persisted to `runtime_config` (validates 0.15 ≤ threshold ≤ 0.75? — **no:** spec allows the slider range; clamp 0.0–1.0 only, the UI enforces 0.15–0.75).
   - `POST /api/v1/support/quick-fix` — four actions: `RESTART_MCP` (rebind in-memory client, report success), `PURGE_SANDBOX` (docker prune if daemon present, else simulated success), `UNLOCK_SQLITE` (`PRAGMA wal_checkpoint(TRUNCATE)`), `ENABLE_MOCK_ENV` (set runtime flag). Return `{status, message, timestamp}`.
   - **Runner robustness:** background task wraps graph execution in try/except → on exception, mark incident `HALTED` (status column), publish a terminal SSE error event, log traceback.

3. **Smoke script `backend/tests/smoke_api.py`** (plain script, not pytest): boots uvicorn programmatically on a random port, then with `httpx`: ingest S1 → collect SSE stream → assert ordered `node_update` events through node 10 and incident `RESOLVED`; ingest S2 → stream shows `PAUSED` at N6 → approve → `RESOLVED`; `GET /incidents` lists seeds + new runs; `GET/PUT /config` roundtrip; one quick-fix action returns SUCCESS.

### Verification Gate
1. `uv run pytest backend/tests/ -v` green.
2. `uv run python backend/tests/smoke_api.py` green, printing the SSE event sequence for S1 and the S2 pause→approve sequence.
3. Manual curl demo of `/api/v1/incidents/INC-4815/retry-strike` with the spec payload returning `max_strikes: 4`.

### Forbidden in this phase
Any frontend code beyond what exists.

### Commit (after gate + user confirmation)
`Phase 5: FastAPI gateway, SSE streaming, HITL approve/resume and retry-strike endpoints`

---
---

## PHASE 6 — Frontend Shell & Page 1 (`/dashboard` War Room)

**Objective:** Next.js 15 dark-mode shell, global context/SSE plumbing, and the complete 5-bento War Room.

### Deliverables

1. **`frontend/next.config.ts`** — `rewrites()`: `/api/:path*` → `http://localhost:8000/api/:path*` (Locked Decision 8). `tailwind.config.ts` content globs wired; dark theme tokens `#070b14`/`#090d16`.

2. **`src/app/layout.tsx` + `src/app/page.tsx`** — root layout (dark, sidebar+topbar frame) and `/` → redirect `/dashboard`. Route stubs for `/history`, `/config`, `/support` ("Coming in Phase 7/8" placeholder pages so navigation never 404s).

3. **`src/components/layout/Sidebar.tsx`** — 4-route nav + MOCK_ENV and circuit-breaker status chips (from `/api/v1/config`).

4. **`src/components/layout/TopBar.tsx`** — Global Status Pill (`HEALTHY` / `INCIDENT ACTIVE` / `TIER 2 PAUSED`), live `20.0s` SLA stopwatch (starts on ingest SSE, freezes at stabilization/interrupt, red breach state past 20 s), **"Simulate Outage ▼"** menu → `POST /ingest` with the three scenario keys.

5. **`src/context/OAAContext.tsx`** — global state: active incident id, latest per-node SSE events map, SLA timer, incident list cache; `useIncidentSSE` hook wrapping native `EventSource` against `/api/v1/incidents/{id}/stream` (relative URL through the rewrites proxy), auto-reconnect, clean close on terminal event.

6. **The 5 bentos (`src/components/war-room/`)** wired per CONTEXT §4.1:
   - `TelemetryBento.tsx` — CPU/RAM/DB pool/504 rate/stderr tail during an incident; `last_healthy_summary` digest when idle.
   - `ActiveNodeDebateBento.tsx` — current node indicator (1–10) + live Forensics/FinOps/Arbiter cards fed by debate events.
   - `HITLApprovalBento.tsx` — amber flash on `PAUSED_HITL`, renders 3:00 AM briefing + Sandbox PASS badge + **[Approve & Execute]** / **[Reject & Escalate]** → `POST /approve`.
   - `BlastRadiusBento.tsx` — semi-circular gauge for `B`, formula breakdown (`0.4·ratio + 0.4·D + 0.2·P`), queued Tier 3 PR status.
   - `BottomScrubberBento.tsx` — full-width 10-node progress bar lighting in real time + link to `/history`.

### Verification Gate
1. `npm run build` exits 0 (type-safe).
2. Backend + frontend both running; scripted check: ingest S1 via TopBar-equivalent curl, confirm SSE-driven bento data changes are reflected in served pages where verifiable headlessly; then **user performs the visual checklist** (status pill flips, stopwatch runs, S2 amber HITL card appears, Approve resumes to RESOLVED).

### Forbidden in this phase
`/history` DAG canvas, `/config` and `/support` functionality (placeholders only).

### Commit (after gate + user confirmation)
`Phase 6: Next.js dark shell, SSE context, dashboard 5-bento war room`

---
---

## PHASE 7 — Page 2 (`/history` Blackbox Ledger & n8n-Style DAG Replay)

**Objective:** Full historical ticket explorer with interactive 10-node replay and the 4th-strike override console.

### Deliverables

1. **`src/app/history/page.tsx`** — three-column layout: ticket drawer | canvas | inspector.

2. **Left Ticket Drawer** — `GET /api/v1/incidents` (+ optional tier filter); tier badges (T1/T2/T3), `HALTED_STRIKES` distinct styling; button opening `src/components/shared/PostMortemModal.tsx` rendering the ticket's `final_report_md`.

3. **`src/components/dag/N8nFlowCanvas.tsx`** — `@xyflow/react` canvas initialized with the **exact `LOCKED_DAG_NODES` coordinates from ARCHITECTURE §5** (13 entries incl. `tier-1`, `tier-2`, `check-pr` pseudo-nodes); edges matching the locked topology incl. the Tier A/B split and the `is_code_bug` branch; node visuals driven by replay state (idle / active / completed / halted).
   - Replay engine: **[▶ Play] [⏸ Pause] [⏮ Step]** over the selected ticket's `node_snapshots` chronology (timed by recorded `elapsed_ms`, scaled); a live ticket follows SSE instead of snapshots.
   - Debate rounds R1/R2/R3 map visually onto the N2/N3 nodes (round badge), keeping the locked coordinates intact.

4. **Right Inspector + `TicketOverridePanel.tsx`** — clicking any node shows its raw `state_json` (pretty-printed). For `HALTED_STRIKES` tickets: prompt-hint input + **[↻ Run 4th Try on Node 8 Now]** → `POST /retry-strike` → subscribe to that incident's SSE so the canvas animates N8 (strike 4) → N9 → N10 live.

### Verification Gate
1. `npm run build` exits 0.
2. With backend running: replay seeded `INC-4818` and `INC-4815` from snapshots (Play + Step verified via network/state inspection where headless-verifiable); trigger the INC-4815 override via the API and confirm the ticket flips to resolved-with-4-strikes in the drawer data; **user performs the visual checklist** (canvas layout matches the locked diagram without overlaps, inspector JSON matches snapshot rows, override console live-animates).

### Forbidden in this phase
`/config` and `/support` functionality.

### Commit (after gate + user confirmation)
`Phase 7: Blackbox history drawer, n8n-style DAG replay canvas, 4th-strike override console`

---
---

## PHASE 8 — Pages 3 & 4 (`/config` Governance & `/support` Self-Healing) + Final Regression

**Objective:** Governance controls, self-healing surface, and the full end-to-end regression across every path.

### Deliverables

1. **`src/app/config/page.tsx`** —
   - Autonomous Authority Slider (`blast_threshold`, 0.15–0.75, default 0.40, `PUT /api/v1/config` with optimistic UI + rollback on error).
   - Hard Invariant Locks (read-only): Stateful DB lock and `≤25%` cluster ceiling, rendered as enforced/locked.
   - Global Circuit Breaker Policy selector (`2/3/4/5`).
   - FastMCP Tool Permission Matrix: live toggles for all six tools + `MOCK_ENV` switch, wired to `enabled_tools` via `PUT /config`; reflect that disabling a tool makes subsequent runs fail loudly (PermissionError surfaces in the incident SSE error event).

2. **`src/app/support/page.tsx`** —
   - 4 one-click self-healing cards → `POST /api/v1/support/quick-fix` with result toasts: Restart FastMCP Bridge / Purge Zombie Docker Sandbox Containers / Flush WAL & Unlock SQLite / Enable Offline Shield.
   - FAQ accordion (spec content: why incidents route to Tier 2; how the 3-strike breaker works; why Tier 3 never hot-patches live containers).
   - Direct Platform Support card: hotline/email/Slack + **"Mail Diagnostic Bundle & Ticket Logs"** → generates a client-side `.json` diagnostic download (incident rows + config + recent snapshots) plus a `mailto:` link (attachments are impossible via mailto — download + mailto is the pragmatic, honest implementation).

3. **Final regression (manual + scripted):**
   - All three scenarios end-to-end via the UI (S1 silent Tier 1 + Morning Digest; S2 amber pause → Approve **and** a separate Reject run; S3 Tier 1 stabilize + Tier 3 PR card).
   - INC-4815 4th-strike rescue from `/history`.
   - Governance effect: set threshold `0.15` → new S1 run forced Tier 2; restore 0.40; toggle `restart_pod` off → new S1 run fails with the firewall/permissions error surfaced; restore on.
   - SLA stopwatch breach rendering on an artificially slowed run is optional; do not fake it.
   - `uv run pytest backend/tests/ -v` + `npm run build` both green.
   - Regenerate `backend/requirements.txt` via `uv export` if deps changed since Phase 1.

### Verification Gate
1. Both test/build suites green.
2. Scripted API regression passes; **user signs off the UI checklist** for Pages 3 & 4 and the governance side-effects above.

### Commit (after gate + user confirmation)
`Phase 8: Config governance, support self-healing, full E2E regression`

---

## Completion Criteria (project done when…)
- All 8 phase commits exist; every gate passed; the three chaos scenarios + halted-ticket rescue + governance side-effects are demonstrably working with `MOCK_ENV=true`, zero external dependencies, on this Windows machine.
