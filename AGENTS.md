# AGENTS.md — OneAboveAll (OAA)

Autonomous SRE control plane (hackathon build). Agentic incident response with graduated trust: diagnose → debate → decide → gate → stabilize → report.

## Immutable sources of truth
- `context.md` / `architecture.md` — architectural law. Never contradict them.
- `PROMPTS.md` — 8-phase playbook. Work ONE phase at a time, in order. Each phase: read §0 Locked Decisions → implement → run the Verification Gate → report → **await user confirmation → commit → stop**. Never start the next phase unprompted.

## Environment & toolchain (Windows, PowerShell)
- **Every shell call is a fresh PowerShell session.** Nothing persists between calls — always set env vars inline in the same command.
- `uv` is at `C:\Users\chait\.local\bin`. Prefix uv commands:
  `$env:Path = "C:\Users\chait\.local\bin;$env:Path"; $env:UV_PROJECT_ENVIRONMENT = "D:\Coding\OAA\.venv"`
- Single root venv: `D:\Coding\OAA\.venv` (`pyproject.toml` + `uv.lock` = source of truth; `requirements.txt` is generated via `uv export --no-hashes`).
- Backend gates run **from `D:\Coding\OAA\backend`**: `uv run pytest tests/ -v`.
- Temp helper scripts go in `C:\Users\chait\AppData\Local\Temp\opencode` and MUST run with `$env:PYTHONPATH = "D:\Coding\OAA\backend"` (script dir steals `sys.path[0]`).
- PowerShell quote nesting is fragile: write multi-line Python to a temp `.py` file, never inline `-c` with nested quotes.
- Interpreter is `python` / `py` — never `python3`. Frontend uses **npm** only.
- Frontend gate: `npx tsc --noEmit` from `frontend/`; later `npm run build`.

## Layout
- `backend/app/core/` — config, database (WAL ledger)
- `backend/app/schemas/` — Pydantic models + `OAAState` (mirror: `frontend/src/types/oaa.ts` must change in the same phase)
- `backend/app/mcp/` — FastMCP server + zero-privilege client firewall
- `backend/app/graph/` — LangGraph nodes (Phases 3–4)
- `backend/app/mocks/scenarios.json` — deterministic fixtures (mock-only build)
- `backend/sandbox/` — `SandboxRunner` ABC (`MockDriver` default; `DockerDriver` dormant, no Docker on this machine)
- `backend/tests/` — phase gate suites

## Hard rules
- `MOCK_ENV=true` for the whole build; LLM clients wired but dormant.
- Ports: backend `:8000`, frontend `:3000`.
- **Never run git mutations without explicit per-action user confirmation.**
- **After every phase commit, update the "Current state" section below** (phase number, commit hash, next phase). This file is the cross-session anchor — a stale state line defeats its purpose.
- Identifiers, endpoint paths, table names, env vars must match the spec docs exactly.
- Minimal changes per phase; no future-phase files beyond listed inert stubs.

## Current state
Phase 4 committed (`ac4475b`). Next: **Phase 5** (FastAPI gateway, SSE streaming, HITL approve/resume and retry-strike endpoints) — prompt lives in `PROMPTS.md`.
