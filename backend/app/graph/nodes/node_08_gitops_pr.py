"""Node 8 — GitOps Code PR (ARCHITECTURE §3.4). Tier 3.

Fetches the offending snippet (mock), synthesizes a `CodePatchBundle` (mock
fixture; live = `qwen/qwen3-32b` dormant), then verifies the patch with a
`pytest` loop via the `SandboxRunner` up to `state["max_strikes"]`.

3-Strike Circuit Breaker (ARCHITECTURE §3.4):
- If `strike_count == max_strikes` and `pytest_passed == False`, write/PR
  permissions are revoked, the ticket is marked `HALTED_STRIKES`, and the graph
  routes to Node 9 → Node 10.
- Success sets `patch_bundle` (including the mock `pr_url`).

The single-ticket 4th-strike override re-enters this node (via
`resume_from_snapshot`) with `max_strikes=4` + `prompt_hint`, so the MockDriver
selects the "fixed" (passing) pytest branch.
"""

from typing import Any, Dict

from app.core.config import get_settings
from app.mcp.server import reset_active_scenario, set_active_scenario
from app.mocks import get_scenario
from sandbox.runner import get_runner
from app.schemas.models import CodePatchBundle
from app.schemas.state import OAAState


def _empty_patch(file_path: str) -> Dict[str, Any]:
    return {
        "file_path": file_path,
        "patch_diff": "",
        "pytest_code": "",
        "pytest_passed": False,
        "strike_count": 0,
        "pr_url": None,
        "pr_markdown_report": "",
    }


def _mock_patch(state: OAAState, scenario: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic patch from the scenario fixture (mock LLM stand-in)."""
    fixture = scenario.get("patch_bundle")
    if not fixture:
        return _empty_patch((state.get("arbiter_decision") or {}).get("offending_file") or "")
    return dict(fixture)


async def _live_patch(state: OAAState) -> Dict[str, Any]:
    """Dormant live path — qwen/qwen3-32b synthesizes the diff + pytest (Locked Decision 6)."""
    from app.graph.llm_factory import get_gitops_llm

    decision = state.get("arbiter_decision") or {}
    llm = get_gitops_llm().with_structured_output(CodePatchBundle)
    patch = await llm.ainvoke(
        {
            "offending_file": decision.get("offending_file"),
            "offending_line": decision.get("offending_line"),
            "telemetry": state.get("telemetry"),
            "prompt_hint": state.get("prompt_hint"),
        }
    )
    return CodePatchBundle(**patch).model_dump()


async def gitops_pr_node(state: OAAState) -> Dict[str, Any]:
    max_strikes = state.get("max_strikes", 3)
    strike_count = state.get("strike_count", 0)
    prompt_hint = state.get("prompt_hint")

    token = set_active_scenario(state["scenario_key"])
    try:
        scenario = get_scenario(state["scenario_key"])
        runner = get_runner()

        # 1 + 2. Fetch offending snippet + synthesize the CodePatchBundle.
        if get_settings().mock_env:
            patch = _mock_patch(state, scenario)
        else:
            patch = await _live_patch(state)

        # 3. pytest verification loop (3-strike circuit breaker).
        passed = False
        for strike in range(strike_count + 1, max_strikes + 1):
            outcome = await runner.run_pytest(
                file_path=patch.get("file_path", ""),
                patch_diff=patch.get("patch_diff", ""),
                pytest_code=patch.get("pytest_code", ""),
                strike_number=strike,
                prompt_hint=prompt_hint,
            )
            strike_count = strike
            if outcome.get("pytest_passed"):
                passed = True
                break
    finally:
        reset_active_scenario(token)

    patch["pytest_passed"] = passed
    patch["strike_count"] = strike_count
    if not passed:
        # Breaker trip: revoke write/PR permissions (no pr_url), route to N9.
        patch["pr_url"] = None
        patch["pr_markdown_report"] = (
            f"(strike {strike_count} draft — still failing, PR withheld)"
        )
    # On success the mock `pr_url` from the fixture is preserved.

    return {"strike_count": strike_count, "patch_bundle": patch}
