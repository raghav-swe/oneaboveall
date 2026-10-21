"""OAA SandboxRunner implementations (Phase 4).

- `MockDriver`   — deterministic fixture-driven dry-run/pytest outcomes from
                   `app/mocks/scenarios.json`, 0.35 s pacing (default, MOCK_ENV=true).
                   Honors `prompt_hint` by selecting the "fixed" (passing) pytest
                   branch so a 4th-strike override can deterministically succeed.
- `DockerDriver` — builds/runs `backend/sandbox/Dockerfile` when a Docker daemon is
                   reachable. Engaged only under MOCK_ENV=false; otherwise it raises
                   a clear, actionable error (Locked Decision 4).
- `get_runner()` — factory selecting the driver from runtime config.
"""

import asyncio
import logging
import os
import shutil
from abc import ABC, abstractmethod
from typing import Any, Dict, List

from app.core.config import get_settings
from app.mcp.server import get_active_scenario
from app.mocks import get_scenario
from app.schemas.models import SandboxResult

logger = logging.getLogger("oaa.sandbox")

MOCK_PACING_SECONDS = 0.35

# Test-only escape hatch: forces the MockDriver's pytest loop onto the scenario's
# `pytest_strikes_halted` fixture (3 failing strikes) so the 3-strike circuit
# breaker in Node 8 can be exercised offline. Unset by default (normal pass).
_FORCE_HALTED_PYTEST = "OAA_FORCE_HALTED_PYTEST"

_DEFAULT_SANDBOX_RESULT = {
    "sandbox_passed": True,
    "execution_time_ms": 140,
    "strike_number": 1,
    "stdout_log": "[dry-run] 0 syntax errors, 0 destructive mutations detected",
    "verification_badge": "PASS (140ms) — 0 Syntax Errors, 0 Destructive Mutations",
}


class SandboxRunner(ABC):
    """Isolation boundary for pre-flight dry-runs (Node 6) and pytest (Node 8)."""

    @abstractmethod
    async def dry_run(
        self,
        command_to_run: str,
        mcp_tool_name: str,
        mcp_tool_args: Dict[str, Any],
        strike_number: int,
    ) -> SandboxResult:
        """Node 6 pre-flight simulation of the arbiter's stabilization command."""
        ...

    @abstractmethod
    async def run_pytest(
        self,
        file_path: str,
        patch_diff: str,
        pytest_code: str,
        strike_number: int,
        prompt_hint: str | None = None,
    ) -> Dict[str, Any]:
        """Node 8 pytest verification of a candidate CodePatchBundle."""
        ...


# --------------------------------------------------------------------------- #
# MockDriver (default)                                                        #
# --------------------------------------------------------------------------- #

def _scripted_strike(
    strikes: List[Dict[str, Any]], strike_number: int, default_passed: bool = False
) -> Dict[str, Any]:
    """Pick the scripted outcome for `strike_number`, defaulting to a synthetic
    failure (or pass, for the "fixed" branch) when the fixture list does not
    script that far."""
    for entry in strikes or []:
        if entry.get("strike") == strike_number:
            return {
                "pytest_passed": bool(entry.get("passed")),
                "stdout": entry.get("stdout", ""),
                "strike": strike_number,
            }
    return {
        "pytest_passed": default_passed,
        "stdout": (
            f"[mock] pytest strike {strike_number}: "
            f"{'passed (fixed branch)' if default_passed else 'no scripted outcome — failing'}"
        ),
        "strike": strike_number,
    }


class MockDriver(SandboxRunner):
    """Deterministic fixture driver (default under MOCK_ENV=true)."""

    async def dry_run(
        self,
        command_to_run: str,
        mcp_tool_name: str,
        mcp_tool_args: Dict[str, Any],
        strike_number: int,
    ) -> SandboxResult:
        await asyncio.sleep(MOCK_PACING_SECONDS)
        scenario = get_scenario(get_active_scenario())
        fixture = scenario.get("sandbox_result") or _DEFAULT_SANDBOX_RESULT
        return SandboxResult(**fixture)

    async def run_pytest(
        self,
        file_path: str,
        patch_diff: str,
        pytest_code: str,
        strike_number: int,
        prompt_hint: str | None = None,
    ) -> Dict[str, Any]:
        await asyncio.sleep(MOCK_PACING_SECONDS)
        scenario = get_scenario(get_active_scenario())

        if prompt_hint is not None:
            # Operator hint unlocks the "fixed" (passing) fixture branch.
            return _scripted_strike(scenario.get("pytest_strikes", []), strike_number, default_passed=True)

        if os.environ.get(_FORCE_HALTED_PYTEST):
            return _scripted_strike(scenario.get("pytest_strikes_halted", []), strike_number)

        return _scripted_strike(scenario.get("pytest_strikes", []), strike_number)


# --------------------------------------------------------------------------- #
# DockerDriver (dormant — no daemon on this machine)                          #
# --------------------------------------------------------------------------- #

_DOCKERFILE_DIR = os.path.join(os.path.dirname(__file__))
_IMAGE_TAG = "oaa-sandbox:latest"


class DockerDriver(SandboxRunner):
    """Real Docker-backed isolation (dormant until a daemon exists)."""

    def __init__(self) -> None:
        if get_settings().mock_env:
            raise RuntimeError(
                "DockerDriver cannot be used under MOCK_ENV=true — "
                "use the MockDriver (offline fixtures) instead (Locked Decision 4)."
            )
        if shutil.which("docker") is None:
            raise RuntimeError(
                "Docker daemon is not reachable: the 'docker' executable is not on PATH. "
                "DockerDriver requires MOCK_ENV=false AND a running Docker daemon. "
                "Keep MOCK_ENV=true to use the deterministic MockDriver."
            )

    async def _run(self, *args: str) -> str:
        proc = await asyncio.create_subprocess_exec(
            "docker",
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        stdout, _ = await proc.communicate()
        return stdout.decode(errors="replace")

    async def _ensure_image(self) -> None:
        await self._run("build", "-t", _IMAGE_TAG, _DOCKERFILE_DIR)

    async def dry_run(
        self,
        command_to_run: str,
        mcp_tool_name: str,
        mcp_tool_args: Dict[str, Any],
        strike_number: int,
    ) -> SandboxResult:
        await self._ensure_image()
        output = await self._run("run", "--rm", _IMAGE_TAG, "python", "-c", command_to_run)
        passed = "Error" not in output and "Traceback" not in output
        return SandboxResult(
            sandbox_passed=passed,
            execution_time_ms=0,
            strike_number=strike_number,
            stdout_log=output,
            verification_badge=(
                "PASS (docker)" if passed else "FAIL (docker) — dry-run error"
            ),
        )

    async def run_pytest(
        self,
        file_path: str,
        patch_diff: str,
        pytest_code: str,
        strike_number: int,
        prompt_hint: str | None = None,
    ) -> Dict[str, Any]:
        await self._ensure_image()
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            test_file = os.path.join(tmp, "test_patch.py")
            with open(test_file, "w", encoding="utf-8") as f:
                f.write(pytest_code)
            output = await self._run(
                "run",
                "--rm",
                "-v",
                f"{tmp}:/sandbox",
                _IMAGE_TAG,
                "pytest",
                "-q",
            )
        return {
            "pytest_passed": "passed" in output and "failed" not in output,
            "stdout": output,
            "strike": strike_number,
        }


# --------------------------------------------------------------------------- #
# Factory                                                                     #
# --------------------------------------------------------------------------- #

def get_runner() -> SandboxRunner:
    """Select the sandbox driver from runtime config (Locked Decision 4)."""
    if get_settings().mock_env:
        return MockDriver()
    return DockerDriver()
