"""OAA MCP client — the Zero-Privilege-Escalation firewall (ARCHITECTURE §4).

Every tool call from graph nodes goes through `call_mcp_tool`:

1. Unknown tools are rejected.
2. Mutating tools are rejected unless `caller_node == 7` (verbatim spec error).
3. Tools disabled in the `/config` permission matrix are rejected.
4. Only then does the request cross the in-memory FastMCP transport.
"""

import json
import logging
from typing import Any, Dict, Optional

from fastmcp import Client

from app.core.config import get_runtime_config
from app.mcp.server import mcp as mcp_server

logger = logging.getLogger("oaa.mcp")

READ_ONLY_TOOLS = {"get_pod_metrics", "get_container_logs", "get_cluster_topology"}
MUTATING_TOOLS = {"restart_pod", "kill_db_pid", "flush_redis_cache"}
ALL_TOOLS = READ_ONLY_TOOLS | MUTATING_TOOLS


async def call_mcp_tool(caller_node: int, tool_name: str, args: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Role-gated async MCP tool invocation (single entry point for all nodes)."""
    arguments: Dict[str, Any] = args or {}

    if tool_name not in ALL_TOOLS:
        raise ValueError(f"Unknown MCP tool '{tool_name}'. Known tools: {sorted(ALL_TOOLS)}.")

    if tool_name in MUTATING_TOOLS and caller_node != 7:
        raise PermissionError(
            f"Zero Privilege Escalation Violation: Node {caller_node} "
            f"attempted to call mutating tool '{tool_name}'."
        )

    if not get_runtime_config().enabled_tools.get(tool_name, False):
        raise PermissionError(
            f"MCP tool '{tool_name}' is disabled in the FastMCP permission matrix (/config)."
        )

    async with Client(mcp_server) as client:
        result = await client.call_tool(tool_name, arguments)

    payload = _extract_payload(result)
    logger.debug("node=%s tool=%s ok=%s", caller_node, tool_name, bool(payload))
    return payload


def _extract_payload(result: Any) -> Dict[str, Any]:
    """Normalise FastMCP CallToolResult -> dict (`.data` for structured tools)."""
    data = getattr(result, "data", None)
    if isinstance(data, dict):
        return data
    if data is not None:
        return {"result": data}

    structured = getattr(result, "structured_content", None)
    if isinstance(structured, dict):
        return structured

    content = getattr(result, "content", None) or []
    if content:
        text = getattr(content[0], "text", None)
        if isinstance(text, str):
            try:
                parsed = json.loads(text)
                return parsed if isinstance(parsed, dict) else {"result": parsed}
            except json.JSONDecodeError:
                return {"result": text}
    raise RuntimeError(f"Unable to extract payload from MCP result: {result!r}")
