"""OAA SandboxRunner interface (Phase 1 stub — signatures only).

Implementations land in Phase 4 (PROMPTS.md):
- `MockDriver`   — deterministic fixture-driven outcomes (default, MOCK_ENV=true)
- `DockerDriver` — builds/runs backend/sandbox/Dockerfile when a daemon exists
- `get_runner()` — factory selecting the driver from runtime config
"""

from abc import ABC, abstractmethod
from typing import Any, Dict

from app.schemas.models import SandboxResult


class SandboxRunner(ABC):
    """Isolation boundary for pre-flight dry-runs and pytest verification."""

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
