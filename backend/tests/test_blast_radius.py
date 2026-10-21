"""Phase 3 gate — Node 5 deterministic blast-radius math (ARCHITECTURE §3.1).

Covers the boundary table: the 25% cluster-ceiling edge, the stateful-DB
`d_risk == 1.0` and `kill_db_pid` overrides, and the strict `B > threshold`
comparison at exactly-threshold vs one-ulp-over.
"""

import math

import pytest

from app.graph.nodes.node_05_blast_radius import (
    TIER_1_AUTONOMOUS,
    TIER_2_HITL,
    compute_blast_radius,
)


def test_formula_weights_match_architecture():
    # S1 fixture: 2/12 pods, stateless, instantly reversible.
    b, _ = compute_blast_radius(2, 12, 0.0, 0.0, 0.40)
    assert b == pytest.approx(0.4 * (2 / 12) + 0.4 * 0.0 + 0.2 * 0.0)


def test_scenario_2_matches_fixture_b():
    # S2 fixture: 1/8 pods, d_risk=1.0, p=0.3 -> B = 0.05 + 0.4 + 0.06 = 0.51.
    b, tier = compute_blast_radius(1, 8, 1.0, 0.3, 0.40)
    assert b == pytest.approx(0.51)
    assert tier == TIER_2_HITL


def test_ratio_exactly_0_25_is_autonomous():
    # The ceiling invariant is strictly `> 0.25`, so exactly 25% stays Tier 1.
    b, tier = compute_blast_radius(1, 4, 0.0, 0.0, 0.75)
    assert b == pytest.approx(0.1)
    assert tier == TIER_1_AUTONOMOUS


def test_ratio_just_over_0_25_is_hitl():
    # 2501/10000 = 0.2501 — one sliver past the ceiling -> forced Tier 2 even
    # though B (0.10004) is far below the 0.75 threshold.
    b, tier = compute_blast_radius(2501, 10000, 0.0, 0.0, 0.75)
    assert 2501 / 10000 > 0.25
    assert b < 0.75
    assert tier == TIER_2_HITL


def test_d_risk_1_0_override():
    # B = 0.4004 sits below the 0.75 threshold, but the stateful-DB invariant
    # (d_risk == 1.0) forces Tier 2 regardless.
    b, tier = compute_blast_radius(1, 1000, 1.0, 0.0, 0.75)
    assert b == pytest.approx(0.4 * 0.001 + 0.4)
    assert b < 0.75
    assert tier == TIER_2_HITL


def test_kill_db_pid_name_override():
    # Benign ratio/d_risk/B, but the mutating tool touches the stateful DB.
    b, tier = compute_blast_radius(1, 100, 0.0, 0.0, 0.75, mcp_tool_name="kill_db_pid")
    assert b < 0.75
    assert tier == TIER_2_HITL


def test_b_exactly_at_threshold_is_autonomous():
    # B = 0.4*0.25 = 0.1 exactly; `B > threshold` is strict, so equality is Tier 1.
    b, tier = compute_blast_radius(1, 4, 0.0, 0.0, 0.1)
    assert b == pytest.approx(0.1)
    assert tier == TIER_1_AUTONOMOUS


def test_b_one_ulp_over_threshold_is_hitl():
    # Threshold one ulp below 0.1 -> the same B (0.1) is now strictly over.
    threshold = math.nextafter(0.1, 0.0)
    b, tier = compute_blast_radius(1, 4, 0.0, 0.0, threshold)
    assert b > threshold
    assert tier == TIER_2_HITL
