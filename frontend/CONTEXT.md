# CONTEXT.md - paste this at the start of every new AI chat

## What we are building
OneAboveAll (OAA): the frontend of an agentic SRE platform. When a Prometheus/Datadog alert fires,
a 10-node LangGraph pipeline diagnoses it with 3 LLMs, scores the risk, and either auto-heals,
asks a human to approve, or opens a GitHub PR. This repo is ONLY the web UI (control plane).
The backend (FastAPI + SSE) is built by teammates. For now every screen uses mock data from `src/lib/mockData.ts`.

## Stack (do not change)
- Next.js 14 (App Router, TypeScript), Tailwind CSS 3, `@xyflow/react` (React Flow) for the DAG
- No other UI libraries unless I ask. No localStorage needed. Prefer plain React state.
- Path alias: `@/` = `src/`

## Routes (4 pages)
| Route | Name | Job |
|---|---|---|
| /dashboard | Bento War Room | 5-second triage: 5 bento cards + bottom node scrubber |
| /history | Blackbox & DAG replay | Ticket list, n8n-style 10-node canvas, per-ticket override |
| /config | Control Config | Permanent global rules: blast slider, strike policy, MCP tool matrix, LLM routing |
| /support | Support & QuickFix | Self-heal cards, FAQ, contact |
Detailed spec per page is in `docs/spec-<page>.md`. I will paste only the page we are working on.

## Domain rules the UI must respect
- Blast radius score `B`. Default Tier 1 limit is `B <= 0.40`. If `B > 0.40` the graph pauses (`interrupt()`) and a human must approve (Tier 2 HITL).
- Stateful DB protection overrides the math: if `d_risk = 1.0` or more than 25% of cluster pods are touched, it is always Tier 2.
- Tier 1 = auto-heal with safe MCP tools. Tier 2 = needs human approve/reject. Tier 3 = code patch (<= 5 lines) validated by pytest in Docker, then a GitHub PR. Tier 3 never pushes to production.
- 3-Strike Circuit Breaker on Node 6 (sandbox) and Node 8 (GitOps). After 3 failures write permission is revoked.
  - `/history` = one-time 4th try for ONE ticket. `/config` = permanent change of the global limit.
- 10 nodes: 1 Ingestion, 2 Forensics (Llama-3.3-70B), 3 FinOps (GPT-OSS-120B), 4 Arbiter (Gemini 2.5 Flash), 5 Blast Radius Gate, 6 Sandbox Dry-Run, 7 MCP Execution, 8 GitOps PR, 9 Shared Reporting, 10 Flight Ledger (SQLite).
- MCP tools: read-only diagnostics (nodes 1-3), mutating tools (node 7 only). `pg_terminate_backend` is locked to Tier 2. `drop_or_truncate_table` is permanently revoked. No privilege escalation.
- `MOCK_ENV` = offline shield: uses local fixtures instead of real LLM APIs.

## Design system (already in tailwind.config.ts, use these names, never raw hex)
Dark control-room look, high contrast, dense but readable.
- Backgrounds: `bg-oaa-bg` (page), `bg-oaa-panel` (cards), `bg-oaa-raised` (inner boxes), borders `border-oaa-line`
- Text: `text-oaa-text`, `text-oaa-muted`
- Status colors: cyan = live/consensus, amber = Tier 2 HITL/warning, green = pass/healthy/Tier 1, red = error/outage/strikes, violet = PR/GitOps
- Fonts: `font-sans` (Inter) for text, `font-mono` for commands, IDs, numbers, logs
- Cards: `rounded-lg border border-oaa-line bg-oaa-panel p-4`
- Keep motion minimal. Respect keyboard focus and reduced motion. Must work from ~1024px up (mobile is optional).

## Code rules
- One component per file in `src/components/<page>/`, PascalCase, default export, typed props (types in `src/lib/types.ts`).
- Pages in `src/app/<route>/page.tsx` stay thin: they compose components and read mock data.
- Add `"use client"` only to files that use state/effects/hooks.
- Never invent new colors, libraries, or file locations. Ask me if something is unclear.
- When you reply with code: give the full file, state the exact file path above each code block, and list any new npm package needed.
- Do not rewrite files I did not ask about.

## Current status
See `PROGRESS.md` (I paste the latest version each time).

## Repo layout
```
CONTEXT.md  PROGRESS.md  README.md
docs/        spec-dashboard.md spec-history.md spec-config.md spec-support.md
prompts/     kickoff.md steps.md
src/app/     layout.tsx, globals.css, page.tsx, dashboard|history|config|support/page.tsx
src/components/ layout/Sidebar.tsx, dashboard/, history/, config/, support/, ui/
src/lib/     types.ts, mockData.ts
```
- Transparency rule: every card/section container uses `bg-oaa-panel` (clear glass). Inner boxes use `bg-oaa-raised`.
  Never use solid fills on containers. Tints like bg-oaa-green/10 are only for small badges, nodes and buttons.