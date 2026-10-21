"""Node 4 — Arbiter consensus (ARCHITECTURE §2 row 4).

Synthesizes the 3-turn debate into a structured `ArbiterVerdict` and writes
`state["arbiter_decision"]` as a plain dict (`model_dump()`).

Mock mode: the fixture `ArbiterVerdict` is loaded from scenarios.json.
Live mode (dormant): gemini-2.5-flash at `temperature=0.0` with
`.with_structured_output(ArbiterVerdict)`.
"""

import asyncio
from typing import Any, Dict

from app.core.config import get_settings
from app.mocks import get_scenario
from app.schemas.models import ArbiterVerdict
from app.schemas.state import OAAState

MOCK_PACING_SECONDS = 0.35


async def _live_arbiter(state: OAAState) -> Dict[str, Any]:
    """Dormant live path — never executed while MOCK_ENV=true (Locked Decision 6)."""
    from app.graph.llm_factory import get_arbiter_llm

    llm = get_arbiter_llm().with_structured_output(ArbiterVerdict)
    verdict = await llm.ainvoke(
        {
            "service": state.get("service"),
            "telemetry": state.get("telemetry"),
            "debate_transcript": state.get("debate_transcript") or [],
        }
    )
    return {"arbiter_decision": ArbiterVerdict(**verdict).model_dump()}


async def arbiter_node(state: OAAState) -> Dict[str, Any]:
    await asyncio.sleep(MOCK_PACING_SECONDS)

    if get_settings().mock_env:
        fixture = get_scenario(state["scenario_key"])["arbiter_decision"]
        return {"arbiter_decision": ArbiterVerdict(**fixture).model_dump()}

    return await _live_arbiter(state)
