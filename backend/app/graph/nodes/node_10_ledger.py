"""Node 10 — Flight Ledger (ARCHITECTURE §2 row 10, CONTEXT §5).

Finalizes the `incidents` row (`status`, `selected_tier`, `blast_radius_score`,
`is_code_bug`, `strike_count`, `max_strikes_override`, `final_report_md`) and
the terminal snapshot. Intermediate snapshots already flow from the Phase 3
instrumentation wrapper in `workflow.py`.
"""

from typing import Any, Dict

from app.core import database
from app.graph.nodes.node_09_reporting import is_halted
from app.schemas.state import OAAState


async def flight_ledger_node(state: OAAState) -> Dict[str, Any]:
    incident_id = state.get("incident_id", "")
    decision = state.get("arbiter_decision") or {}

    status = "HALTED_STRIKES" if is_halted(state) else "RESOLVED"

    await database.update_incident_status(
        incident_id,
        status,
        selected_tier=state.get("selected_tier") or None,
        blast_radius_score=state.get("blast_radius_score"),
        is_code_bug=bool(decision.get("is_code_bug")),
        strike_count=state.get("strike_count", 0),
        max_strikes_override=state.get("max_strikes", 3),
    )
    await database.set_final_report(incident_id, state.get("final_post_mortem_report", ""))

    # The terminal snapshot for Node 10 is written by the instrumentation wrapper.
    return {}
