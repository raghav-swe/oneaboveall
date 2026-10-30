# Step prompts - send ONE at a time after the kickoff

Always tell the AI which spec you pasted. After each step: run `npm run dev`, check, commit, tick PROGRESS.md.

## STEP 1 - /dashboard (paste docs/spec-dashboard.md)
1.1  Build `src/components/dashboard/StatusBar.tsx`: top bar with the "TIER 2 HITL PAUSED: INC-4819" pill, service name, SLA timer (3.42s / 20.0s) and a red "Simulate Outage" button. Use liveIncident from mockData.
1.2  Build `TelemetryBento.tsx` (Bento 1): three metric boxes (DB pool, HTTP 504s, RAM load) plus the "last healthy request" box and the live error line.
1.3  Build `ConsensusBento.tsx` (Bento 2): three vendor verdict cards (Llama, GPT-OSS, Gemini) and the "Node 6 -> Waiting at Tier 2 Gate" tag.
1.4  Build `HitlBento.tsx` (Bento 3): root cause, why HITL, command box, sandbox PASS badge, Approve and Reject buttons. Buttons only update local state for now (show "Approved"/"Rejected" message).
1.5  Build `BlastBento.tsx` (Bento 4): progress bar with the 0.40 limit marker and current 0.84, the ratio/D_risk/P_rev line, and the queued PR box.
1.6  Build `NodeScrubber.tsx`: the bottom row of pipeline nodes with arrows; the paused node is highlighted amber; clicking it links to /history.
1.7  Compose all of it in `src/app/dashboard/page.tsx` as a 2-column bento grid like the spec screenshot.
1.8  (Optional) Add a "healthy" state: when a toggle is off, show only the last-resolved summary instead of live cards.

## STEP 2 - /history (paste docs/spec-history.md)
2.1  `TicketList.tsx`: left column with the 3 mock tickets, badge colors, selected state, "Open Post-Mortem" button.
2.2  `DagCanvas.tsx`: React Flow canvas with the 10 nodes laid out as in the spec (fixed positions, no dragging needed). Remember `import "@xyflow/react/dist/style.css"` and `"use client"`.
2.3  Add Play / Pause / Step controls that light up nodes one by one using local state and a timer.
2.4  `NodeInspector.tsx`: bottom panel showing the selected node and its status.
2.5  `OverrideConsole.tsx`: right panel with the pytest failure log, hint box and "Run 4th try on Node 8 now" button (updates local state), plus Download .diff and Force Close buttons.
2.6  Compose in `src/app/history/page.tsx` (3 columns).

## STEP 3 - /config (paste docs/spec-config.md)
3.1  `BlastSlider.tsx`: slider from 0.15 to 0.75 with the three preset markers and the live "B <= value" label; locked-rule rows below.
3.2  `StrikeSelector.tsx`: 2/3/4/5 segmented control with the active one highlighted.
3.3  `McpMatrix.tsx`: read-only tools list and mutating tools list with the 4 status styles (enabled read, auto allowed, locked to Tier 2, permanently revoked). The revoked tool cannot be toggled.
3.4  `LlmRouting.tsx`: three model cards (Forensics, FinOps, Arbiter) and the MOCK_ENV toggle.
3.5  Compose in `src/app/config/page.tsx` with a "Save & Hot-Reload Config" button (shows a success message, no backend yet).

## STEP 4 - /support (paste docs/spec-support.md)
4.1  `QuickFixCard.tsx` (reusable) and the 4 cards; clicking a button shows a loading state then a success message.
4.2  `Faq.tsx`: the 3 questions as expandable items.
4.3  `ContactPanel.tsx`: hotline, mail, slack and the "Mail Diagnostic Bundle" button (mailto link).
4.4  Compose in `src/app/support/page.tsx` plus the "all 10 nodes healthy" self-diagnostics label.

## STEP 5 - polish and backend
5.1  Review all 4 pages for visual consistency against the spec screenshots; list differences, then fix them one by one.
5.2  Make a `src/lib/api.ts` with typed fetch functions that return mock data now. Later swap them for FastAPI calls.
5.3  Add an SSE hook `useIncidentStream()` that currently simulates events with a timer.

## When something breaks
"Here is the exact error: <paste>. Here is the file: <paste that one file>. Fix only this."
