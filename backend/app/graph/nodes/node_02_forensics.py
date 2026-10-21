"""Node 2 — Forensics subagent (ARCHITECTURE §2 row 2).

Exports `forensics_round1(state)` and `forensics_round3(state)` — the two
Forensics turns of the 3-turn adversarial debate. Each appends a Forensics
`DebateMessage` to `state["debate_transcript"]` (an `Annotated[..., operator.add]`
reducer key), so the returned update is a single-element list.

Mock mode: the scripted message is read from scenarios.json (round_num 1 or 3).
Live mode (dormant): llama-3.3-70b-versatile (backup scout-17b) reasons over the
telemetry + prior transcript and emits a structured `DebateMessage`.
"""

import asyncio
from typing import Any, Dict

from app.core.config import get_settings
from app.mocks import get_scenario
from app.schemas.models import DebateMessage
from app.schemas.state import OAAState

MOCK_PACING_SECONDS = 0.35


def _scripted_forensics_message(scenario_key: str, round_num: int) -> Dict[str, Any]:
    """Return the fixture Forensics DebateMessage for the given round (1 or 3)."""
    for msg in get_scenario(scenario_key)["debate_transcript"]:
        if msg["round_num"] == round_num and msg["speaker"] == "Forensics":
            return DebateMessage(**msg).model_dump()
    raise KeyError(f"No scripted Forensics message (round {round_num}) for '{scenario_key}'.")


async def _live_forensics(state: OAAState, round_num: int) -> Dict[str, Any]:
    """Dormant live path — never executed while MOCK_ENV=true (Locked Decision 6)."""
    from app.graph.llm_factory import get_forensics_llm

    transcript = state.get("debate_transcript") or []
    llm = get_forensics_llm().with_structured_output(DebateMessage)
    message = await llm.ainvoke(
        {
            "service": state.get("service"),
            "telemetry": state.get("telemetry"),
            "prior_debate": transcript,
            "round_num": round_num,
        }
    )
    return {"debate_transcript": [DebateMessage(**message).model_dump()]}


async def forensics_round1(state: OAAState) -> Dict[str, Any]:
    await asyncio.sleep(MOCK_PACING_SECONDS)
    if get_settings().mock_env:
        return {"debate_transcript": [_scripted_forensics_message(state["scenario_key"], round_num=1)]}
    return await _live_forensics(state, round_num=1)


async def forensics_round3(state: OAAState) -> Dict[str, Any]:
    await asyncio.sleep(MOCK_PACING_SECONDS)
    if get_settings().mock_env:
        return {"debate_transcript": [_scripted_forensics_message(state["scenario_key"], round_num=3)]}
    return await _live_forensics(state, round_num=3)
