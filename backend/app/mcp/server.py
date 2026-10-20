"""OAA FastMCP tool server — 3 read-only + 3 mutating SRE tools.

Mock-aware (Locked Decision 11): the tool *implementations* read deterministic
fixtures from app/mocks/scenarios.json for the scenario selected by the ingest
path (contextvar), while nodes always traverse the real MCP client/server path.
With MOCK_ENV=false the tools serve the same fixtures and log a loud warning
(mock-only build, Locked Decision 6).

This module must never import from app.mcp.client (firewall lives there).
"""

import contextvars
import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastmcp import FastMCP

from app.core.config import get_settings

logger = logging.getLogger("oaa.mcp")

SCENARIO_KEYS = ("SCENARIO_1_STATELESS", "SCENARIO_2_STATEFUL_DB", "SCENARIO_3_CODE_BUG")

_SCENARIOS_PATH = Path(__file__).resolve().parent.parent / "mocks" / "scenarios.json"

_active_scenario: contextvars.ContextVar[str] = contextvars.ContextVar(
    "oaa_active_scenario", default="SCENARIO_1_STATELESS"
)


# --------------------------------------------------------------------------- #
# Scenario resolution                                                          #
# --------------------------------------------------------------------------- #

@lru_cache(maxsize=1)
def _load_scenarios() -> Dict[str, Any]:
    with open(_SCENARIOS_PATH, encoding="utf-8") as f:
        return json.load(f)


def set_active_scenario(scenario_key: str) -> contextvars.Token:
    """Bind the active fixture scenario (called by the ingest path, Node 1)."""
    if scenario_key not in SCENARIO_KEYS:
        raise ValueError(f"Unknown scenario_key '{scenario_key}'. Expected one of {SCENARIO_KEYS}.")
    return _active_scenario.set(scenario_key)


def reset_active_scenario(token: contextvars.Token) -> None:
    _active_scenario.reset(token)


def get_active_scenario() -> str:
    return _active_scenario.get()


def _scenario() -> Dict[str, Any]:
    return _load_scenarios()[_active_scenario.get()]


def _warn_if_live(tool_name: str) -> None:
    if not get_settings().mock_env:
        logger.warning(
            "LIVE MODE NOT PROVISIONED — serving fixtures for tool '%s' (MOCK_ENV=false).",
            tool_name,
        )


# --------------------------------------------------------------------------- #
# FastMCP server + tools                                                       #
# --------------------------------------------------------------------------- #

mcp = FastMCP(
    "oaa-sre-tools",
    instructions=(
        "OneAboveAll SRE tools. Read-only diagnostics: get_pod_metrics, "
        "get_container_logs, get_cluster_topology. Mutating stabilization: "
        "restart_pod, kill_db_pid, flush_redis_cache."
    ),
)


@mcp.tool()
async def get_pod_metrics(service: str = "") -> Dict[str, Any]:
    """Read-only: CPU %, RAM %, DB pool usage, and HTTP 504 rate for a service."""
    _warn_if_live("get_pod_metrics")
    telemetry = _scenario()["telemetry"]
    return {"service": service or _scenario()["service"], **telemetry["metrics"]}


@mcp.tool()
async def get_container_logs(service: str = "", tail: int = 50) -> Dict[str, Any]:
    """Read-only: last `tail` lines of container stderr (stack traces included)."""
    _warn_if_live("get_container_logs")
    telemetry = _scenario()["telemetry"]
    lines: List[str] = telemetry["logs"]
    return {"service": service or _scenario()["service"], "lines": lines[-tail:]}


@mcp.tool()
async def get_cluster_topology(service: str = "") -> Dict[str, Any]:
    """Read-only: upstream/downstream service dependency DAG JSON."""
    _warn_if_live("get_cluster_topology")
    telemetry = _scenario()["telemetry"]
    return {"service": service or _scenario()["service"], **telemetry["topology"]}


@mcp.tool()
async def restart_pod(
    pods: Optional[List[str]] = None,
    pod: Optional[str] = None,
    strategy: str = "rolling",
    readiness_gate_seconds: int = 10,
) -> Dict[str, Any]:
    """Mutating: rolling restart of stateless worker pods (Node 7 only)."""
    _warn_if_live("restart_pod")
    args = {
        "pods": pods or ([pod] if pod else []),
        "strategy": strategy,
        "readiness_gate_seconds": readiness_gate_seconds,
    }
    return _mutating_result("restart_pod", args)


@mcp.tool()
async def kill_db_pid(pid: int, reload_pgbouncer: bool = True) -> Dict[str, Any]:
    """Mutating: pg_terminate_backend(pid) and optional PgBouncer reload (Node 7 only)."""
    _warn_if_live("kill_db_pid")
    return _mutating_result("kill_db_pid", {"pid": pid, "reload_pgbouncer": reload_pgbouncer})


@mcp.tool()
async def flush_redis_cache(pattern: str = "*") -> Dict[str, Any]:
    """Mutating: flush corrupted/OOM Redis cache keys (Node 7 only)."""
    _warn_if_live("flush_redis_cache")
    return _mutating_result("flush_redis_cache", {"pattern": pattern})


# --------------------------------------------------------------------------- #
# Fixture-backed mutation results                                              #
# --------------------------------------------------------------------------- #

def _mutating_result(tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
    """Return the scenario's scripted execution result when it matches this tool;
    otherwise synthesize a deterministic generic success."""
    scenario = _scenario()
    scripted = scenario.get("execution_result")
    if scripted and scripted.get("tool") == tool_name:
        return {**scripted, "args": args, "mock": True}
    return {
        "tool": tool_name,
        "status": "STABILIZED",
        "duration_ms": 1500,
        "stdout": f"[mock] {tool_name} executed with args {json.dumps(args, sort_keys=True)} — no scenario-specific script",
        "args": args,
        "mock": True,
    }
