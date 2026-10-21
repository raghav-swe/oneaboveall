"""Phase 4 gate — full 10-node workflow: sandbox + HITL interrupt, execution,
GitOps PR loop, reporting, ledger, and retry-strike re-entry (PROMPTS.md Phase 4).

Covers:
  - S1 full run (Tier 1)  — path 1,2,3,2,4,5,6,7,9,10, RESOLVED, AUTO_APPROVED.
  - S2 interrupt/resume  — paused + briefing payload; APPROVED → RESOLVED;
                           REJECTED → routes to N9, N7 never executes.
  - Restart survival     — new saver + recompiled graph on the same checkpoints.db
                           resumes a paused thread (Locked Decision 3).
  - S3 Tier 3            — PR created, pytest_passed=true, closure dossier.
  - Halted path          — forced 3× pytest failures → HALTED_STRIKES, then
                           resume_from_snapshot with a hint → strike 4 → RESOLVED.
"""

import os
from contextlib import asynccontextmanager

import pytest
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.types import Command

from app.core import database
from app.graph.workflow import build_graph, make_initial_state, resume_from_snapshot

PATH_TIER1 = [1, 2, 3, 2, 4, 5, 6, 7, 9, 10]
PATH_TIER3 = [1, 2, 3, 2, 4, 5, 6, 7, 8, 9, 10]
PATH_REJECTED = [1, 2, 3, 2, 4, 5, 6, 9, 10]  # N7 never executes


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    """Each test gets its own ledger + checkpoint DBs."""
    monkeypatch.setenv("OAA_DATABASE_PATH", str(tmp_path / "ledger.db"))
    monkeypatch.setenv("OAA_CHECKPOINT_DB_PATH", str(tmp_path / "checkpoints.db"))


@asynccontextmanager
async def _graph():
    """Yield a compiled full graph, closing its checkpoint connection on exit."""
    graph = await build_graph()
    try:
        yield graph
    finally:
        conn = getattr(getattr(graph, "checkpointer", None), "conn", None)
        if conn is not None:
            await conn.close()


async def _snapshot_path(incident_id: str) -> list:
    return [s["node_id"] for s in await database.get_snapshots(incident_id)]


async def _start(incident_id: str, scenario_key: str):
    """Mirror the `/ingest` step: init the ledger, allocate an incident row, and
    return the initial graph state."""
    await database.init_db()
    state = make_initial_state(incident_id, scenario_key)
    await database.create_incident(incident_id, state["service"], state["alert_name"])
    return state


# --------------------------------------------------------------------------- #
# S1 — Tier 1 full run                                                        #
# --------------------------------------------------------------------------- #

async def test_s1_full_run_tier1():
    initial = await _start("INC-S1", "SCENARIO_1_STATELESS")
    config = {"configurable": {"thread_id": "INC-S1"}}

    async with _graph() as graph:
        result = await graph.ainvoke(initial, config)

    assert result["selected_tier"] == "TIER_1_AUTONOMOUS"
    assert result["hitl_decision"] == "AUTO_APPROVED"
    assert result["execution_status"] == "STABILIZED"
    assert result["sandbox_result"]["verification_badge"] == (
        "PASS (140ms) — 0 Syntax Errors, 0 Destructive Mutations"
    )
    assert "Morning Digest" in result["final_post_mortem_report"]

    assert await _snapshot_path("INC-S1") == PATH_TIER1

    inc = await database.get_incident("INC-S1")
    assert inc["status"] == "RESOLVED"
    assert inc["selected_tier"] == "TIER_1_AUTONOMOUS"
    assert inc["is_code_bug"] == 0


# --------------------------------------------------------------------------- #
# S2 — Tier 2 interrupt / resume                                              #
# --------------------------------------------------------------------------- #

async def _pause_s2(graph, thread_id: str):
    initial = await _start(thread_id, "SCENARIO_2_STATEFUL_DB")
    config = {"configurable": {"thread_id": thread_id}}
    result = await graph.ainvoke(initial, config)
    assert "__interrupt__" in result
    interrupts = result["__interrupt__"]
    assert len(interrupts) == 1
    payload = interrupts[0].value
    assert payload["live_engineer_briefing"]
    assert payload["verification_badge"].startswith("PASS")
    return config


async def test_s2_interrupt_approve_resolves():
    async with _graph() as graph:
        config = await _pause_s2(graph, "INC-S2")
        result = await graph.ainvoke(Command(resume={"decision": "APPROVED"}), config)

    assert result["hitl_decision"] == "APPROVED"
    assert result["execution_status"] == "STABILIZED"
    assert result["selected_tier"] == "TIER_2_HITL"
    assert "HITL Post-Action Audit" in result["final_post_mortem_report"]

    assert await _snapshot_path("INC-S2") == PATH_TIER1
    inc = await database.get_incident("INC-S2")
    assert inc["status"] == "RESOLVED"
    assert inc["blast_radius_score"] == pytest.approx(0.51)


async def test_s2_interrupt_reject_routes_to_reporting_no_execution():
    async with _graph() as graph:
        config = await _pause_s2(graph, "INC-S2-REJ")
        result = await graph.ainvoke(Command(resume={"decision": "REJECTED"}), config)

    assert result["hitl_decision"] == "REJECTED"
    # Node 7 never executed — execution_status untouched, no mutating call recorded.
    assert result["execution_status"] == ""
    assert "HITL Post-Action Audit" in result["final_post_mortem_report"]

    assert await _snapshot_path("INC-S2-REJ") == PATH_REJECTED
    inc = await database.get_incident("INC-S2-REJ")
    assert inc["status"] == "RESOLVED"  # workflow completed (escalated, not auto-fixed)


# --------------------------------------------------------------------------- #
# Restart survival (Locked Decision 3)                                        #
# --------------------------------------------------------------------------- #

async def test_restart_survival_resumes_paused_thread():
    thread_id = "INC-RESTART"
    config = {"configurable": {"thread_id": thread_id}}

    # First process: pause at the Tier 2 interrupt.
    graph1 = await build_graph()
    initial = await _start(thread_id, "SCENARIO_2_STATEFUL_DB")
    result = await graph1.ainvoke(initial, config)
    assert "__interrupt__" in result
    await graph1.checkpointer.conn.close()  # simulate process shutdown

    # "Restart": brand-new saver + recompiled graph on the same checkpoints.db.
    checkpoint_path = os.environ["OAA_CHECKPOINT_DB_PATH"]
    async with AsyncSqliteSaver.from_conn_string(checkpoint_path) as saver:
        graph2 = await build_graph(checkpointer=saver)
        result2 = await graph2.ainvoke(Command(resume={"decision": "APPROVED"}), config)

    assert result2["hitl_decision"] == "APPROVED"
    assert result2["execution_status"] == "STABILIZED"
    assert await _snapshot_path(thread_id) == PATH_TIER1
    assert (await database.get_incident(thread_id))["status"] == "RESOLVED"


# --------------------------------------------------------------------------- #
# S3 — Tier 3 GitOps PR                                                       #
# --------------------------------------------------------------------------- #

async def test_s3_tier3_creates_pr():
    initial = await _start("INC-S3", "SCENARIO_3_CODE_BUG")
    config = {"configurable": {"thread_id": "INC-S3"}}

    async with _graph() as graph:
        result = await graph.ainvoke(initial, config)

    assert result["selected_tier"] == "TIER_1_AUTONOMOUS"
    patch = result["patch_bundle"]
    assert patch["pytest_passed"] is True
    assert patch["pr_url"] == "https://github.com/oneaboveall/pricing-api/pull/42"
    assert "GitOps Incident Closure Dossier" in result["final_post_mortem_report"]

    assert await _snapshot_path("INC-S3") == PATH_TIER3
    inc = await database.get_incident("INC-S3")
    assert inc["status"] == "RESOLVED"
    assert inc["is_code_bug"] == 1


# --------------------------------------------------------------------------- #
# Halted path → 4th-strike retry                                              #
# --------------------------------------------------------------------------- #

async def test_halted_then_retry_strike_succeeds(monkeypatch):
    monkeypatch.setenv("OAA_FORCE_HALTED_PYTEST", "1")

    initial = await _start("INC-HALT", "SCENARIO_3_CODE_BUG")
    config = {"configurable": {"thread_id": "INC-HALT"}}

    async with _graph() as graph:
        result = await graph.ainvoke(initial, config)

    assert result["strike_count"] == 3
    assert result["patch_bundle"]["pytest_passed"] is False
    assert result["patch_bundle"]["pr_url"] is None
    assert "Circuit-Breaker Halt" in result["final_post_mortem_report"]
    assert await _snapshot_path("INC-HALT") == PATH_TIER3

    inc = await database.get_incident("INC-HALT")
    assert inc["status"] == "HALTED_STRIKES"
    assert inc["strike_count"] == 3

    # Operator override: re-enter at Node 8 with a hint → strike 4 succeeds.
    result2 = await resume_from_snapshot("INC-HALT", "Use dict.get('tax', 0.0)")

    assert result2["strike_count"] == 4
    assert result2["patch_bundle"]["pytest_passed"] is True
    assert result2["patch_bundle"]["pr_url"] == "https://github.com/oneaboveall/pricing-api/pull/42"
    assert "GitOps Incident Closure Dossier" in result2["final_post_mortem_report"]

    inc = await database.get_incident("INC-HALT")
    assert inc["status"] == "RESOLVED"
    assert inc["strike_count"] == 4
    assert inc["max_strikes_override"] == 4
