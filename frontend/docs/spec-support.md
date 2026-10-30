# Page 4: /support - Self-Healing Quick Fixes, FAQs & Contact ("Who watches the watchman?")

For problems in OAA itself. Status label top-right: "SELF-DIAGNOSTICS: ALL 10 NODES HEALTHY".

## Sections
1. INSTANT SELF-HEALING QUICK FIXES (4 cards, each with description + one button)
   - MCP Bridge Disconnected: "Fixes stdio/SSE pipe timeouts between LangGraph and cluster tools." Button: Restart FastMCP Bridge
   - Zombie Sandbox Containers: "Purges stuck Docker dry-run or pytest containers blocking Node 6/8." Button: Purge Docker Sandbox
   - SQLite Ledger Locked: "Clears SQLITE_BUSY write locks during high-volume alert storms." Button: Flush WAL & Unlock DB
   - LLM API Rate Limit (429): "Switches Groq/Gemini calls to deterministic local fixtures instantly." Button: Enable Offline Shield
2. FREQUENTLY ASKED QUESTIONS (expandable)
   - Q: Why did my incident route to Tier 2 HITL even though B-score was 0.30? A: The Stateful Database Protection Invariant overrides raw math whenever d_risk = 1.0 or >25% of cluster pods are touched.
   - Q: Why did Node 8 stop trying to fix our Python bug after 3 attempts? A: The 3-Strike Circuit Breaker prevents infinite LLM retry loops. You can trigger a temporary 4th try in /history or raise the global limit in /config.
   - Q: Does Tier 3 push code directly into our production containers? A: Never. Live stabilization happens first via Tier 1/2 MCP tools; Tier 3 validates a <=5-line patch with pytest in Docker and opens a GitHub PR.
3. CONTACT OAA PLATFORM SUPPORT (24/7): Emergency Hotline +1 (800) 622-SRE1 | Engineering Mail oncall@oneaboveall.dev | Slack Bridge #oaa-platform-support | Button "Mail Diagnostic Bundle & Ticket Logs to Support".

## Route summary
/dashboard War Room | /history Blackbox & DAG | /config Control Config | /support Support & Helpdesk
