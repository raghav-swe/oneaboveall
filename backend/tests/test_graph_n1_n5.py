"""Phase 3 gate — partial graph (Nodes 1→5) end-to-end for all three scenarios.

Asserts the sequential debate produces 3 transcript entries in order
Forensics → FinOps → Forensics, the deterministic blast-radius gate routes each
scenario to its expected tier, and the instrumentation wrapper writes exactly
one snapshot per executed node step.
"""

import pytest

from app.core import database
from app.graph.workflow import build_partial_graph, make_initial_state

DEBATE_ORDER = ["Forensics", "FinOps", "Forensics"]
EXPECTED_NODE_PATH = [1, 2, 3, 2, 4, 5]  # N1, N2 R1, N3 R2, N2 R3, N4, N5


@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    """Every test gets its own throwaway WAL database (mirrors test_database.py)."""
    monkeypatch.setenv("OAA_DATABASE_PATH", str(tmp_path / "test.db"))


async def _run_scenario(scenario_key: str, incident_id: str):
    await database.init_db()
    app = build_partial_graph()
    initial = make_initial_state(incident_id, scenario_key)
    return await app.ainvoke(initial)


async def _assert_common_shape(result, incident_id):
    # Three debate messages, strictly sequential, correct speakers + rounds.
    transcript = result["debate_transcript"]
    assert [m["speaker"] for m in transcript] == DEBATE_ORDER
    assert [m["round_num"] for m in transcript] == [1, 2, 3]

    # Telemetry was populated by Node 1 via the read-only MCP tools.
    assert "cpu_pct" in result["telemetry"]["metrics"]
    assert isinstance(result["telemetry"]["logs"], list) and result["telemetry"]["logs"]
    assert "upstream" in result["telemetry"]["topology"]

    # One snapshot per executed node step, in execution order.
    snaps = await database.get_snapshots(incident_id)
    assert [s["node_id"] for s in snaps] == EXPECTED_NODE_PATH
    assert all(s["status"] == "COMPLETED" for s in snaps)
    assert all("state_json" in s for s in snaps)


async def test_scenario_1_stateless_routes_tier_1():
    result = await _run_scenario("SCENARIO_1_STATELESS", "INC-T1")
    await _assert_common_shape(result, "INC-T1")

    assert result["selected_tier"] == "TIER_1_AUTONOMOUS"
    assert result["blast_radius_score"] == pytest.approx(0.4 * (2 / 12))
    assert result["arbiter_decision"]["mcp_tool_name"] == "restart_pod"
    assert result["arbiter_decision"]["is_code_bug"] is False


async def test_scenario_2_stateful_db_routes_tier_2():
    result = await _run_scenario("SCENARIO_2_STATEFUL_DB", "INC-T2")
    await _assert_common_shape(result, "INC-T2")

    assert result["selected_tier"] == "TIER_2_HITL"
    assert result["blast_radius_score"] == pytest.approx(0.51)
    assert result["arbiter_decision"]["mcp_tool_name"] == "kill_db_pid"
    assert result["arbiter_decision"]["d_risk"] == 1.0


async def test_scenario_3_code_bug_routes_tier_1():
    result = await _run_scenario("SCENARIO_3_CODE_BUG", "INC-T3")
    await _assert_common_shape(result, "INC-T3")

    assert result["selected_tier"] == "TIER_1_AUTONOMOUS"
    assert result["blast_radius_score"] == pytest.approx(0.4 * (1 / 10))
    assert result["arbiter_decision"]["is_code_bug"] is True
    assert result["arbiter_decision"]["offending_file"] == "app/services/pricing.py"
