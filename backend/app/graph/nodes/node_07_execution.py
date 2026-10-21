"""Node 7 — Execution (ARCHITECTURE §2 row 7, §3.3).

Invokes `arbiter_decision["mcp_tool_name"]` through the zero-privilege firewall
via `call_mcp_tool(caller_node=7, ...)` — the ONLY node authorized to call
mutating tools — and sets `execution_status` to `"STABILIZED"` or `"FAILED"`
from the (mock) tool result.
"""

from typing import Any, Dict

from app.mcp.client import call_mcp_tool
from app.mcp.server import reset_active_scenario, set_active_scenario
from app.schemas.state import OAAState


async def execution_node(state: OAAState) -> Dict[str, Any]:
    decision = state.get("arbiter_decision") or {}
    tool_name = decision.get("mcp_tool_name", "")
    tool_args = decision.get("mcp_tool_args") or {}

    token = set_active_scenario(state["scenario_key"])
    try:
        result = await call_mcp_tool(7, tool_name, tool_args)
    finally:
        reset_active_scenario(token)

    execution_status = "STABILIZED" if result.get("status") == "STABILIZED" else "FAILED"
    return {"execution_status": execution_status}
