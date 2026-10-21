"""Node 3 — FinOps subagent (ARCHITECTURE §2 row 3).

Exports `finops_round2(state)` — the FinOps counter-turn (Round 2) of the debate.
It reads Round 1 (Forensics) from `state["debate_transcript"]` and counters with
cloud-quota / cost / retry-storm-cascade math, appending a FinOps `DebateMessage`.

Mock mode: the scripted counter is read from scenarios.json (round_num 2) with
`asyncio.sleep(0.35)` pacing. Live mode (dormant): openai/gpt-oss-120b sees R1 and
emits a structured `DebateMessage`.
"""

import asyncio
from typing import Any, Dict

from app.core.config import get_settings
from app.mocks import get_scenario
from app.schemas.models import DebateMessage
from app.schemas.state import OAAState

MOCK_PACING_SECONDS = 0.35


def _scripted_finops_message(scenario_key: str) -> Dict[str, Any]:
    for msg in get_scenario(scenario_key)["debate_transcript"]:
        if msg["round_num"] == 2 and msg["speaker"] == "FinOps":
            return DebateMessage(**msg).model_dump()
    raise KeyError(f"No scripted FinOps message (round 2) for '{scenario_key}'.")


async def _live_finops(state: OAAState) -> Dict[str, Any]:
    """Dormant live path — never executed while MOCK_ENV=true (Locked Decision 6)."""
    from app.graph.llm_factory import get_finops_llm

    transcript = state.get("debate_transcript") or []
    round1 = next((m for m in transcript if m.get("round_num") == 1), {})
    llm = get_finops_llm().with_structured_output(DebateMessage)
    message = await llm.ainvoke(
        {
            "service": state.get("service"),
            "telemetry": state.get("telemetry"),
            "forensics_round1": round1,
            "round_num": 2,
        }
    )
    return {"debate_transcript": [DebateMessage(**message).model_dump()]}


async def finops_round2(state: OAAState) -> Dict[str, Any]:
    await asyncio.sleep(MOCK_PACING_SECONDS)

    # Read Round 1 (Forensics) from the accumulated transcript so the counter
    # genuinely reacts to the proposal it is vetoing/refining (ARCHITECTURE §2).
    transcript = state.get("debate_transcript") or []
    assert any(m.get("round_num") == 1 for m in transcript), (
        "FinOps Round 2 ran before Forensics Round 1 — debate order violated."
    )

    if get_settings().mock_env:
        return {"debate_transcript": [_scripted_finops_message(state["scenario_key"])]}
    return await _live_finops(state)
