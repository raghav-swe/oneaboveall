"""Node 5 — Blast Radius Gate (ARCHITECTURE §3.1). 100% pure Python math, 0% LLM.

Computes the operational risk score

    B = 0.40 * (N_affected / N_total) + 0.40 * D_risk + 0.20 * P_reversibility

and enforces the three hard safety-invariant overrides, which force
`TIER_2_HITL` regardless of the user-configured `blast_threshold`:

1. Stateful Database Lock: `D_risk == 1.0` (or `mcp_tool_name == "kill_db_pid"`).
2. Cluster Capacity Ceiling: `affected / total > 0.25`.
3. Threshold Breach: `B > runtime_config.blast_threshold`.

The node reads `blast_threshold` from the `runtime_config` singleton via
`database.get_runtime_config()` and writes `blast_radius_score` + `selected_tier`.
"""

from typing import Any, Dict, Optional, Tuple

from app.schemas.state import OAAState

TIER_1_AUTONOMOUS = "TIER_1_AUTONOMOUS"
TIER_2_HITL = "TIER_2_HITL"

# Formula weights (ARCHITECTURE §3.1)
_W_RATIO = 0.40
_W_DATA_RISK = 0.40
_W_REVERSIBILITY = 0.20

# Hard invariant: no autonomous action may touch more than 25% of the fleet.
_CLUSTER_CEILING = 0.25


def compute_blast_radius(
    affected_pods: int,
    total_pods: int,
    d_risk: float,
    p_reversibility: float,
    blast_threshold: float,
    mcp_tool_name: Optional[str] = None,
) -> Tuple[float, str]:
    """Pure arithmetic: returns `(B, selected_tier)`.

    `mcp_tool_name` is optional; when supplied it enables the `kill_db_pid`
    stateful-DB override (invariant #1) that the pure five-argument call cannot
    otherwise see.
    """
    ratio = affected_pods / total_pods
    b = _W_RATIO * ratio + _W_DATA_RISK * d_risk + _W_REVERSIBILITY * p_reversibility

    if d_risk == 1.0 or mcp_tool_name == "kill_db_pid":
        tier = TIER_2_HITL
    elif ratio > _CLUSTER_CEILING:
        tier = TIER_2_HITL
    elif b > blast_threshold:
        tier = TIER_2_HITL
    else:
        tier = TIER_1_AUTONOMOUS

    return b, tier


async def blast_radius_gate(state: OAAState) -> Dict[str, Any]:
    decision = state["arbiter_decision"]

    from app.core import database  # local import avoids a module-level cycle

    runtime = await database.get_runtime_config()
    blast_threshold = runtime.blast_threshold

    b, tier = compute_blast_radius(
        affected_pods=decision["affected_pods"],
        total_pods=decision["total_pods"],
        d_risk=decision["d_risk"],
        p_reversibility=decision["p_reversibility"],
        blast_threshold=blast_threshold,
        mcp_tool_name=decision.get("mcp_tool_name"),
    )

    return {"blast_radius_score": b, "selected_tier": tier}
