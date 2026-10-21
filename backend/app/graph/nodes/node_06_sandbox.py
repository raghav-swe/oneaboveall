"""Node 6 — Pre-flight Sandbox & Tier 2 HITL interrupt (ARCHITECTURE §3.2).

Both Track A (Tier 1) and Track B (Tier 2) converge here *before* touching the
production cluster:

1. Dry-run `arbiter_decision["command_to_run"]` via the `SandboxRunner`.
2. Attach `verification_badge = "PASS (140ms) — 0 Syntax Errors, 0 Destructive
   Mutations"` (fixture timing) into `sandbox_result`.
3. Tier 1 → set `hitl_decision = "AUTO_APPROVED"` and continue.
4. Tier 2 → emit a `PAUSED_HITL` event (briefing + badge) through the event
   sink, then call `langgraph.types.interrupt({...})`; the resume value (from
   `POST /approve`) sets `hitl_decision`.
5. Dry-run failure (Locked Decision 5): increment `strike_count`; at
   `max_strikes` revoke writes and route to Node 9 as `HALTED_STRIKES`. The
   Arbiter is **never** re-queried for an alternative command.
"""

from typing import Any, Callable, Dict, Optional

from langgraph.types import interrupt

from app.mcp.server import reset_active_scenario, set_active_scenario
from sandbox.runner import get_runner
from app.schemas.state import OAAState

TIER_1_AUTONOMOUS = "TIER_1_AUTONOMOUS"
TIER_2_HITL = "TIER_2_HITL"

# EventSink signature (mirrors workflow.EventSink) — async, optional for direct calls.
EventSink = Callable[[Dict[str, Any]], Any]


async def sandbox_node(
    state: OAAState,
    event_sink: Optional[EventSink] = None,
) -> Dict[str, Any]:
    decision = state.get("arbiter_decision") or {}
    tier = state.get("selected_tier", "")
    max_strikes = state.get("max_strikes", 3)
    strike_count = state.get("strike_count", 0)

    token = set_active_scenario(state["scenario_key"])
    try:
        runner = get_runner()

        # Deterministic dry-run fail-safe loop (Locked Decision 5): retry the
        # pre-flight dry-run, incrementing `strike_count` per failure, until it
        # passes or the breaker trips. Never re-invokes the Arbiter.
        result = None
        while True:
            attempt = await runner.dry_run(
                command_to_run=decision.get("command_to_run", ""),
                mcp_tool_name=decision.get("mcp_tool_name", ""),
                mcp_tool_args=decision.get("mcp_tool_args", {}) or {},
                strike_number=strike_count + 1,
            )
            if attempt.sandbox_passed:
                result = attempt
                break
            strike_count += 1
            if strike_count >= max_strikes:
                # Write permissions revoked — route to Node 9 (halted).
                return {
                    "strike_count": strike_count,
                    "sandbox_result": attempt.model_dump(),
                }
    finally:
        reset_active_scenario(token)

    sandbox_result = result.model_dump()
    badge = sandbox_result.get("verification_badge", "")

    if tier == TIER_2_HITL:
        briefing = decision.get("live_engineer_briefing", "")
        incident_id = state.get("incident_id", "")

        # Surface the 3:00 AM briefing + PASS badge to the SSE stream, then pause.
        if event_sink is not None:
            await event_sink(
                {
                    "event": "node_update",
                    "incident_id": incident_id,
                    "node_id": 6,
                    "status": "PAUSED",
                    "state": {
                        "live_engineer_briefing": briefing,
                        "verification_badge": badge,
                        "selected_tier": tier,
                    },
                }
            )

        resume = interrupt(
            {
                "live_engineer_briefing": briefing,
                "verification_badge": badge,
                "selected_tier": tier,
            }
        )
        hitl_decision = resume.get("decision") if isinstance(resume, dict) else None
        return {"sandbox_result": sandbox_result, "hitl_decision": hitl_decision}

    # Tier 1 — autonomous path.
    return {"sandbox_result": sandbox_result, "hitl_decision": "AUTO_APPROVED"}
