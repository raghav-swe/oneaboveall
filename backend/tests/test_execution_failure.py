"""Regression — live-execution failure path (`HALTED_EXECUTION`).

Node 7 can be authorized, pass the pre-flight dry-run, and still fail to
stabilize the service. Before this suite existed, that state was:
  * unreachable (every mock mutation returned STABILIZED),
  * reported as a Morning Digest claiming the service was stabilized,
  * persisted as RESOLVED in the ledger.

`OAA_FORCE_EXECUTION_FAILED=1` now injects the failure deterministically
(mirroring `OAA_FORCE_HALTED_PYTEST` for Node 8). This suite pins the whole
contract:

  * Node 7 → `execution_status == "FAILED"`;
  * the PR router skips Node 8 (no code work while the service is unstable);
  * Node 9 → Stabilization Failed report (never the Morning Digest / HITL audit);
  * Node 10 → `HALTED_EXECUTION` (never `RESOLVED`);
  * the gateway treats `HALTED_EXECUTION` as terminal for SSE.
"""

import pytest
from langgraph.types import Command

from app.core import database
from app.graph.nodes.node_09_reporting import is_halted
from app.graph.nodes.node_10_ledger import resolve_terminal_status
from app.graph.workflow import build_graph, make_initial_state
from app.main import TERMINAL_STATUSES


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    """Each test gets its own ledger + checkpoint DBs and the forced failure."""
    monkeypatch.setenv("OAA_DATABASE_PATH", str(tmp_path / "ledger.db"))
    monkeypatch.setenv("OAA_CHECKPOINT_DB_PATH", str(tmp_path / "checkpoints.db"))
    monkeypatch.setenv("OAA_FORCE_EXECUTION_FAILED", "1")


async def _start(incident_id: str, scenario_key: str):
    await database.init_db()
    state = make_initial_state(incident_id, scenario_key)
    await database.create_incident(incident_id, state["service"], state["alert_name"])
    return state


async def _run(incident_id: str, scenario_key: str):
    """Drive a full run to completion, returning the final state."""
    state = await _start(incident_id, scenario_key)
    graph = await build_graph()
    try:
        return await graph.ainvoke(
            state, {"configurable": {"thread_id": incident_id}}
        )
    finally:
        conn = getattr(getattr(graph, "checkpointer", None), "conn", None)
        if conn is not None:
            await conn.close()


# --------------------------------------------------------------------------- #
# Pure status mapping                                                          #
# --------------------------------------------------------------------------- #

def test_execution_failure_outranks_strikes_and_resolution():
    """`resolve_terminal_status` must put the execution failure first."""
    failed = {"execution_status": "FAILED", "strike_count": 0, "max_strikes": 3}
    assert resolve_terminal_status(failed) == "HALTED_EXECUTION"

    # A failed execution never masquerades as resolved, even with no strikes.
    assert not is_halted(failed)

    # The existing statuses keep their precedence.
    assert (
        resolve_terminal_status(
            {"execution_status": "STABILIZED", "strike_count": 3, "max_strikes": 3}
        )
        == "HALTED_STRIKES"
    )
    assert (
        resolve_terminal_status(
            {"execution_status": "STABILIZED", "strike_count": 0, "max_strikes": 3}
        )
        == "RESOLVED"
    )


def test_halted_execution_is_terminal_for_sse():
    """The SSE generator must close for this status instead of hanging."""
    assert "HALTED_EXECUTION" in TERMINAL_STATUSES


# --------------------------------------------------------------------------- #
# Tier 1 — autonomous run whose execution fails                                #
# --------------------------------------------------------------------------- #

async def test_tier1_execution_failure_reports_honestly():
    result = await _run("INC-FAIL-1", "SCENARIO_1_STATELESS")

    assert result["execution_status"] == "FAILED"
    assert result["selected_tier"] == "TIER_1_AUTONOMOUS"

    report = result["final_post_mortem_report"]
    assert "Stabilization Failed" in report
    assert "Morning Digest" not in report
    assert "did **not** resolve" in report

    # No code work while production is unstable.
    assert result["patch_bundle"] is None
    node_ids = [s["node_id"] for s in await database.get_snapshots("INC-FAIL-1")]
    assert 8 not in node_ids
    assert 9 in node_ids and 10 in node_ids

    incident = await database.get_incident("INC-FAIL-1")
    assert incident["status"] == "HALTED_EXECUTION"


# --------------------------------------------------------------------------- #
# Tier 2 — human approves, then execution fails                               #
# --------------------------------------------------------------------------- #

async def test_hitl_approved_execution_failure_does_not_claim_success():
    incident_id = "INC-FAIL-2"
    state = await _start(incident_id, "SCENARIO_2_STATEFUL_DB")
    config = {"configurable": {"thread_id": incident_id}}

    graph = await build_graph()
    try:
        paused = await graph.ainvoke(state, config)
        assert "__interrupt__" in paused  # Tier 2 gate armed

        result = await graph.ainvoke(
            Command(resume={"decision": "APPROVED"}), config
        )
    finally:
        conn = getattr(getattr(graph, "checkpointer", None), "conn", None)
        if conn is not None:
            await conn.close()

    assert result["hitl_decision"] == "APPROVED"
    assert result["execution_status"] == "FAILED"

    report = result["final_post_mortem_report"]
    assert "Stabilization Failed" in report
    # The HITL audit template would claim the approved action was taken.
    assert "HITL Post-Action Audit" not in report
    assert "**Authorization:** APPROVED" in report

    incident = await database.get_incident(incident_id)
    assert incident["status"] == "HALTED_EXECUTION"
