"""OAA runtime configuration — env loading + RuntimeConfig manager API.

Environment variables are loaded via pydantic-settings (see `.env.example`).
The `RuntimeConfig` manager exposes get/update over the governance values owned
by the `/config` page; Phase 2 backs it with the `runtime_config` SQLite table.
"""

from functools import lru_cache
from typing import Any, Dict, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.schemas.models import RuntimeConfigModel


class Settings(BaseSettings):
    """Process-level environment settings (read once from .env / OS env)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    mock_env: bool = True
    groq_api_key: str = ""
    google_api_key: str = ""
    blast_threshold: float = 0.40
    global_max_strikes: int = 3
    database_path: str = "backend/oaa_blackbox.db"
    checkpoint_db_path: str = "backend/checkpoints.db"
    backend_port: int = 8000
    frontend_port: int = 3000


@lru_cache
def get_settings() -> Settings:
    return Settings()


class RuntimeConfig:
    """Governance config manager.

    Phase 1: process-local in-memory store seeded from env.
    Phase 2: `_load_from_db` / `_persist_to_db` get wired to the
    `runtime_config` table in core/database.py (singleton row id=1).
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._model = RuntimeConfigModel(
            blast_threshold=settings.blast_threshold,
            global_max_strikes=settings.global_max_strikes,
            mock_env=settings.mock_env,
        )
        self._db_persist = False  # flipped on by database.init_db() in Phase 2

    def get(self) -> RuntimeConfigModel:
        return self._model.model_copy(deep=True)

    def update(self, patch: Dict[str, Any]) -> RuntimeConfigModel:
        merged = self._model.model_dump()
        merged.update({k: v for k, v in patch.items() if k in merged})
        self._model = RuntimeConfigModel(**merged)
        if self._db_persist:
            self._persist_to_db()
        return self.get()

    # --- Phase 2 hooks (implemented in core/database.py wiring) -------------
    def _persist_to_db(self) -> None:  # pragma: no cover - wired in Phase 2
        raise NotImplementedError("DB persistence lands in Phase 2")


@lru_cache
def get_runtime_config_manager() -> RuntimeConfig:
    return RuntimeConfig()


def get_runtime_config() -> RuntimeConfigModel:
    """Convenience accessor used by nodes (e.g. Node 5 reads blast_threshold)."""
    return get_runtime_config_manager().get()
