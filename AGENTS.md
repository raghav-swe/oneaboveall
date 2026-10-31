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
- **Fold the "Current state" update below into the phase commit itself** — one commit per phase, and **never a separate commit for an `AGENTS.md` edit**. Identify the phase by its **commit subject, not a hash**, because the hash only exists after the commit is created (a hash written into the commit would be self-referentially wrong). This file is the cross-session anchor — a stale state line defeats its purpose.
- Identifiers, endpoint paths, table names, env vars must match the spec docs exactly.
- Minimal changes per phase; no future-phase files beyond listed inert stubs.

## Current state
Phases 7 + 8 committed (`Phase 8: Config governance, support self-healing, full E2E regression`), on top of the `frontend-design` refresh. All four pages are live against the real backend and the demo path is green. Next: demo polish only.

Notes for future sessions:
- **Design source of truth is Naitik's `frontend-design` branch** (`components/dashboard/*`, `components/history/*`, `lib/mockData.ts`, `lib/types.ts`, `docs/spec-*.md`). His branch also downgrades Next 15→14 / React 19→18 and adds duplicate `next.config.mjs` / `postcss.config.mjs`; we deliberately took **his `src/` + `tailwind.config.ts` + docs only** and kept the Next 15 toolchain. Do not reintroduce the `.mjs` configs (two config files break the build).
- `next.config.ts` must keep `compress: false` + the `/api/*` rewrite. Next's gzip buffers `text/event-stream` into one burst at the end, which silently freezes the live War Room.
- `src/context/OAAContext.tsx` still owns the live surface (`useIncidentSSE`, merged `OAAStateSnapshot`, SLA stopwatch, config cache). The redesigned dashboard reads it via `useOAA()`; his original pages were mock-data only.
- `/history` replay is driven by `GET /api/v1/incidents/{id}/snapshots` (`revealedCount` = rows lit). Node ids repeat legitimately (node 2 = debate R1/R3, node 8 = one row per strike), so replay walks **rows**, not the 10 node ids.
- The DAG is the **simplified 10-node pipeline** (`DAG_LAYOUT` in `components/history/DagCanvas.tsx`), chosen by the user over the 13-node `LOCKED_DAG_NODES`. If the spec lock is ever enforced, restore those coordinates.
- `retry-strike` is still synchronous; the override panel re-fetches snapshots after the POST returns instead of live-streaming N8→N9→N10. Still pending if true live animation is ever required: fire-and-forget + flip status to `RUNNING` before replying + a `?follow=1` stream flag.
- Governance caveat: the `/config` slider floor is 0.15, but S1's B is 0.067 and S3's is 0.04 — **no scenario can be forced to Tier 2 via the slider**. The Phase 8 "set 0.15 → S1 forced Tier 2" check is mathematically impossible; demonstrate the firewall side-effect (disable `restart_pod`) instead.
- **Offline demo fallback (Vercel):** `src/lib/api.ts` + `src/lib/demoData.ts` serve a fixture snapshot whenever `/api` is unreachable, and `OAAContext` replays `DEMO_RUNS` instead of opening an SSE stream — so the deployed build looks identical to localhost. `demoData.ts` is *generated* from `scenarios.json`; regenerate it, never hand-edit.
- **Vercel:** the team is `kindcode`; the project is `oneaboveall` → **https://oneaboveall-six.vercel.app**. Deploy with `cd frontend && vercel --prod`. The project's dashboard preset is "Other" with Root Directory `.`, which builds nothing — `frontend/vercel.json` pins `framework: nextjs` to override it. **`oaa-sre.vercel.app` belongs to a different Vercel account and is not ours**; ignore it.
