"""Node 1 — Ingestion (ARCHITECTURE §2 row 1).

Reads `incident_id` / `scenario_key` / `service` / `alert_name` from state, then
calls the three read-only FastMCP tools through the zero-privilege firewall
(`call_mcp_tool(caller_node=1, ...)`) and populates `state["telemetry"]`.

Under MOCK_ENV=true the tools read fixtures from scenarios.json (the scenario is
bound via the `oaa_active_scenario` contextvar so the firewall path stays real).
Mock pacing is `asyncio.sleep(0.35)` so SSE animations stream realistically.
"""

import asyncio
from typing import Any, Dict

from app.mcp.client import call_mcp_tool
from app.mcp.server import reset_active_scenario, set_active_scenario
from app.schemas.state import OAAState

MOCK_PACING_SECONDS = 0.35


async def ingest_node(state: OAAState) -> Dict[str, Any]:
    scenario_key = state["scenario_key"]
    service = state.get("service") or ""

    await asyncio.sleep(MOCK_PACING_SECONDS)

    token = set_active_scenario(scenario_key)
    try:
        metrics = await call_mcp_tool(1, "get_pod_metrics", {"service": service})
        logs = await call_mcp_tool(1, "get_container_logs", {"service": service})
        topology = await call_mcp_tool(1, "get_cluster_topology", {"service": service})
    finally:
        reset_active_scenario(token)

    return {
        "telemetry": {
            "metrics": metrics,
            "logs": logs.get("lines", []),
            "topology": topology,
        },
    }
