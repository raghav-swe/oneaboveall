"""Node 9 — Shared Reporting (ARCHITECTURE §2 row 9, §6).

Tier-aware final markdown, generated deterministically from state (mock mode):

- Execution FAILED → Stabilization Failed Report (checked first — nothing
  downstream of a failed live execution is true, so it outranks every other
  template)
- Tier 1 → Morning Digest Report
- Tier 2 → HITL Post-Action Audit Report (human decision + timestamps)
- Tier 3 → GitOps Incident Closure Dossier (links Node 7 stabilization +
  Node 8 diff/pytest)
- Halted  → Circuit-Breaker Halt (strikes exhausted)

Live mode (dormant): `gemini-2.5-flash` formats the same variables.
"""

from datetime import datetime, timezone
from typing import Any, Dict

from app.core.config import get_settings
from app.schemas.state import OAAState

TIER_2_HITL = "TIER_2_HITL"


def is_halted(state: OAAState) -> bool:
    """True when the 3-strike breaker tripped: strikes exhausted AND no passing patch."""
    patch = state.get("patch_bundle")
    patch_ok = bool(patch) and bool(patch.get("pytest_passed"))
    return (state.get("strike_count", 0) >= state.get("max_strikes", 3)) and not patch_ok


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# --------------------------------------------------------------------------- #
# Deterministic report templates                                              #
# --------------------------------------------------------------------------- #

def _morning_digest(state: OAAState) -> str:
    incident_id = state.get("incident_id")
    service = state.get("service")
    decision = state.get("arbiter_decision") or {}
    b = state.get("blast_radius_score", 0.0)
    return (
        f"## ☀️ Morning Digest — {incident_id} ({service})\n\n"
        f"**Tier:** TIER_1_AUTONOMOUS (silent overnight fix — no one was paged)\n"
        f"**Blast Radius:** B = {b:.2f}\n\n"
        f"### What happened\n{decision.get('winning_summary', '')}\n\n"
        f"### What OAA did (autonomously)\n"
        f"Pre-flight dry-run PASS; rolling restart stabilized the service.\n\n"
        f"### MTTR\nAuto-healed with zero human intervention.\n"
    )


def _hitl_audit(state: OAAState) -> str:
    incident_id = state.get("incident_id")
    service = state.get("service")
    decision = state.get("arbiter_decision") or {}
    hitl = state.get("hitl_decision") or "UNKNOWN"
    badge = (state.get("sandbox_result") or {}).get("verification_badge", "")
    return (
        f"## 🧾 HITL Post-Action Audit — {incident_id} ({service})\n\n"
        f"**Tier:** TIER_2_HITL\n"
        f"**Human decision:** {hitl}\n"
        f"**Decision timestamp:** {_now()}\n"
        f"**Pre-flight badge:** {badge}\n\n"
        f"### Root cause\n{decision.get('live_engineer_briefing', '')}\n\n"
        f"### Action taken\n"
        f"{'Execution approved by on-call engineer.' if hitl == 'APPROVED' else 'Execution rejected — escalated to a human engineer (Node 7 never ran).'}\n"
    )


def _closure_dossier(state: OAAState) -> str:
    incident_id = state.get("incident_id")
    service = state.get("service")
    decision = state.get("arbiter_decision") or {}
    patch = state.get("patch_bundle") or {}
    return (
        f"## 📦 GitOps Incident Closure Dossier — {incident_id} ({service})\n\n"
        f"**Path:** TIER_1_AUTONOMOUS stabilization ➜ TIER_3 GitOps PR\n\n"
        f"### 1. Live stabilization (Node 7)\n"
        f"`{decision.get('command_to_run', '')}` — service stabilized.\n\n"
        f"### 2. Root cause\n"
        f"`{decision.get('winning_summary', '')}`\n\n"
        f"### 3. The fix (Node 8, Tier 3)\n"
        f"- Diff: `{patch.get('patch_diff', '')}`\n"
        f"- `pytest`: **{'passed' if patch.get('pytest_passed') else 'failed'}** "
        f"(sandbox, strike {patch.get('strike_count', 0)})\n"
        f"- PR: {patch.get('pr_url') or 'n/a'}\n\n"
        f"### Policy note\n"
        f"The live container was never hot-patched — stabilization and source remediation are strictly separated.\n"
    )


def _circuit_breaker_halt(state: OAAState) -> str:
    incident_id = state.get("incident_id")
    service = state.get("service")
    strike_count = state.get("strike_count", 0)
    max_strikes = state.get("max_strikes", 3)
    decision = state.get("arbiter_decision") or {}
    return (
        f"## ⛔ Circuit-Breaker Halt — {incident_id} ({service})\n\n"
        f"**Status:** HALTED_STRIKES — Node 8 exhausted {strike_count}/{max_strikes} "
        f"pytest strikes. Write/PR permissions revoked.\n\n"
        f"### What succeeded\nLive service was stabilized first (customers unaffected).\n\n"
        f"### What failed\nThe autonomous fix for `{decision.get('winning_summary', '')}` "
        f"failed sandbox pytest {strike_count} time(s).\n\n"
        f"### How to resume\nOpen `/history` → {incident_id} → provide a prompt hint → "
        f"**[↻ Run 4th Try on Node 8 Now]**.\n"
    )


def _stabilization_failed(state: OAAState) -> str:
    """Report for a live execution that was authorized but did NOT stabilize.

    The pre-flight dry-run is a *static* proof (syntax + destructive-mutation
    check); it cannot model runtime conditions. This template is the honest
    record of that gap.
    """
    incident_id = state.get("incident_id")
    service = state.get("service")
    decision = state.get("arbiter_decision") or {}
    tier = state.get("selected_tier") or "UNKNOWN"
    authorization = state.get("hitl_decision") or "UNKNOWN"
    badge = (state.get("sandbox_result") or {}).get("verification_badge", "")
    return (
        f"## ⚠️ Stabilization Failed — {incident_id} ({service})\n\n"
        f"**Tier:** {tier}\n"
        f"**Authorization:** {authorization}\n"
        f"**Pre-flight badge:** {badge}\n\n"
        f"### What was attempted\n"
        f"`{decision.get('command_to_run', '')}` "
        f"({decision.get('mcp_tool_name', '')})\n\n"
        f"### Why it failed\n"
        f"The pre-flight sandbox dry-run PASSed (0 syntax errors, 0 destructive "
        f"mutations), but the live execution did not stabilize the service. A static "
        f"dry-run cannot model runtime conditions: RBAC/IAM denial, capacity or "
        f"PodDisruptionBudget limits, admission webhooks, stale pod targets, or the "
        f"root cause re-occurring after the mutation.\n\n"
        f"### What did NOT happen\n"
        f"- No code patch or pull request was attempted — live stabilization must "
        f"succeed first.\n"
        f"- No strikes were consumed — the circuit breaker governs the sandbox/pytest "
        f"loops only.\n\n"
        f"### Next action\n"
        f"Escalate to a human engineer. OAA did **not** resolve this incident.\n"
    )


def _build_report(state: OAAState) -> str:
    decision = state.get("arbiter_decision") or {}
    is_code_bug = bool(decision.get("is_code_bug"))
    patch = state.get("patch_bundle")

    # A failed live execution outranks every other template: the service was
    # never stabilized, so no success claim downstream of it would be true.
    if state.get("execution_status") == "FAILED":
        return _stabilization_failed(state)
    if is_halted(state):
        return _circuit_breaker_halt(state)
    if is_code_bug and patch and patch.get("pytest_passed"):
        return _closure_dossier(state)
    if state.get("selected_tier") == TIER_2_HITL:
        return _hitl_audit(state)
    return _morning_digest(state)


async def _live_report(state: OAAState) -> str:
    """Dormant live path — gemini-2.5-flash formats the report (Locked Decision 6)."""
    from app.graph.llm_factory import get_reporting_llm

    llm = get_reporting_llm()
    response = await llm.ainvoke(
        {
            "incident_id": state.get("incident_id"),
            "selected_tier": state.get("selected_tier"),
            "hitl_decision": state.get("hitl_decision"),
            "execution_status": state.get("execution_status"),
            "patch_bundle": state.get("patch_bundle"),
            "arbiter_decision": state.get("arbiter_decision"),
        }
    )
    return str(getattr(response, "content", response))


async def shared_reporting_node(state: OAAState) -> Dict[str, Any]:
    if get_settings().mock_env:
        report = _build_report(state)
    else:
        report = await _live_report(state)
    return {"final_post_mortem_report": report}
