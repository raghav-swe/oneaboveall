"""Phase 2 gate — Zero-Privilege-Escalation firewall + mock-aware tools."""

import pytest

from app.core.config import get_runtime_config_manager
from app.mcp.client import MUTATING_TOOLS, READ_ONLY_TOOLS, call_mcp_tool


@pytest.mark.parametrize("node", [1, 2, 3])
@pytest.mark.parametrize("tool", sorted(MUTATING_TOOLS))
async def test_mutating_tools_blocked_for_readonly_nodes(node, tool):
    with pytest.raises(PermissionError) as exc:
        await call_mcp_tool(caller_node=node, tool_name=tool, args={})
    assert str(exc.value) == (
        f"Zero Privilege Escalation Violation: Node {node} "
        f"attempted to call mutating tool '{tool}'."
    )


async def test_node_7_can_restart_pod():
    result = await call_mcp_tool(7, "restart_pod", {"pods": ["worker-7f9c6d5b4-x2v1l"]})
    assert result["status"] == "STABILIZED"
    assert result["tool"] == "restart_pod"


async def test_node_7_can_kill_db_pid():
    result = await call_mcp_tool(7, "kill_db_pid", {"pid": 4821})
    assert result["status"] == "STABILIZED"


async def test_node_7_can_flush_redis_cache():
    result = await call_mcp_tool(7, "flush_redis_cache", {"pattern": "corrupt:*"})
    assert result["status"] == "STABILIZED"


@pytest.mark.parametrize("node", [1, 2, 3])
async def test_read_only_tools_callable_from_diagnostic_nodes(node):
    metrics = await call_mcp_tool(node, "get_pod_metrics", {"service": "checkout-worker"})
    assert "cpu_pct" in metrics and "ram_pct" in metrics

    logs = await call_mcp_tool(node, "get_container_logs", {})
    assert isinstance(logs["lines"], list) and logs["lines"]

    topo = await call_mcp_tool(node, "get_cluster_topology", {})
    assert "upstream" in topo and "downstream" in topo


async def test_disabled_tool_is_blocked():
    manager = get_runtime_config_manager()
    original = manager.get()
    try:
        manager.update({"enabled_tools": {**original.enabled_tools, "get_pod_metrics": False}})
        with pytest.raises(PermissionError, match="disabled in the FastMCP permission matrix"):
            await call_mcp_tool(1, "get_pod_metrics", {})
    finally:
        manager.update({"enabled_tools": original.enabled_tools})


async def test_unknown_tool_raises_value_error():
    with pytest.raises(ValueError, match="Unknown MCP tool"):
        await call_mcp_tool(1, "drop_database", {})


async def test_scenario_switch_changes_fixtures():
    from app.mcp.server import reset_active_scenario, set_active_scenario

    token = set_active_scenario("SCENARIO_2_STATEFUL_DB")
    try:
        metrics = await call_mcp_tool(1, "get_pod_metrics", {})
        assert metrics["db_pool"] == {"used": 99, "max": 100}

        result = await call_mcp_tool(7, "kill_db_pid", {"pid": 4821})
        assert "pg_terminate_backend(4821)" in result["stdout"]
    finally:
        reset_active_scenario(token)
