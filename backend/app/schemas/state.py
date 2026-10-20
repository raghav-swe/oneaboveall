"""OAA LangGraph state definition — exact mirror of CONTEXT.md §5.

Mirrored in frontend/src/types/oaa.ts (CONTEXT.md §8, rule 1).
"""

from typing import Annotated, Any, Dict, List, Optional, TypedDict

import operator


class OAAState(TypedDict):
    incident_id: str
    scenario_key: str
    service: str
    alert_name: str
    telemetry: Dict[str, Any]
    debate_transcript: Annotated[List[Dict[str, Any]], operator.add]
    arbiter_decision: Dict[str, Any]
    blast_radius_score: float
    selected_tier: str  # "TIER_1_AUTONOMOUS" | "TIER_2_HITL"
    sandbox_result: Dict[str, Any]
    hitl_decision: Optional[str]  # "APPROVED" | "REJECTED" | "AUTO_APPROVED" (Tier 1 only) | None
    execution_status: str
    patch_bundle: Optional[Dict[str, Any]]
    strike_count: int
    max_strikes: int
    prompt_hint: Optional[str]
    final_post_mortem_report: str
