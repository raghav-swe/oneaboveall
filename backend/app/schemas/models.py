"""OAA Pydantic v2 models — exact mirror of CONTEXT.md §5.

Any change here MUST be mirrored in frontend/src/types/oaa.ts in the same commit
(CONTEXT.md §8, rule 1).
"""

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class DebateMessage(BaseModel):
    round_num: int
    speaker: Literal["Forensics", "FinOps"]
    model_used: str
    stance: str
    argument: str
    proposed_action: str


class ArbiterVerdict(BaseModel):
    winning_summary: str = Field(description="Concise synthesis of the 3-turn debate")
    command_to_run: str = Field(description="Exact MCP tool or shell stabilization command")
    mcp_tool_name: Literal["restart_pod", "kill_db_pid", "flush_redis_cache"]
    mcp_tool_args: Dict[str, Any]
    target_service: str
    affected_pods: int = Field(ge=1)
    total_pods: int = Field(ge=1)
    d_risk: float = Field(ge=0.0, le=1.0, description="0.0 stateless, 1.0 stateful DB")
    p_reversibility: float = Field(ge=0.0, le=1.0, description="0.0 instant rollback, 1.0 permanent")
    is_code_bug: bool = Field(description="True if underlying cause is source code exception")
    offending_file: Optional[str] = None
    offending_line: Optional[int] = None
    live_engineer_briefing: str = Field(
        description="3-bullet wake-up briefing for Tier 2 HITL: (1) Root cause, (2) Why scaling was vetoed, (3) Exact impact of approving."
    )


class SandboxResult(BaseModel):
    sandbox_passed: bool
    execution_time_ms: int
    strike_number: int
    stdout_log: str
    verification_badge: str


class CodePatchBundle(BaseModel):
    file_path: str
    patch_diff: str = Field(description="Unified git diff <= 5 lines changed")
    pytest_code: str = Field(description="Unit test verifying the fix")
    pytest_passed: bool
    strike_count: int
    pr_url: Optional[str] = None
    pr_markdown_report: str = Field(description="GitHub PR body explaining root cause and diff")


_DEFAULT_ENABLED_TOOLS = {
    "get_pod_metrics": True,
    "get_container_logs": True,
    "get_cluster_topology": True,
    "restart_pod": True,
    "kill_db_pid": True,
    "flush_redis_cache": True,
}


class RuntimeConfigModel(BaseModel):
    blast_threshold: float = 0.40
    global_max_strikes: int = 3
    mock_env: bool = True
    # Schema-identical micro-fix vs CONTEXT.md §5: default_factory avoids a shared
    # mutable class-attribute dict across instances.
    enabled_tools: Dict[str, bool] = Field(default_factory=lambda: dict(_DEFAULT_ENABLED_TOOLS))
