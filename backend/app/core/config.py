"""OAA runtime configuration — env loading + RuntimeConfig manager API.

Environment variables are loaded via pydantic-settings (see `.env.example`).
The `RuntimeConfig` manager keeps an in-memory cache of the governance values
owned by the `/config` page and is backed by the `runtime_config` SQLite table
(singleton row id=1) via `hydrate_from_db()` / `update_and_persist()`.

Node code reads the synchronous cache through `get_runtime_config()`.
"""

from functools import lru_cache
from typing import Any, Dict

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
    """Governance config manager (in-memory cache + SQLite persistence)."""

    def __init__(self) -> None:
        settings = get_settings()
        self._model = RuntimeConfigModel(
            blast_threshold=settings.blast_threshold,
            global_max_strikes=settings.global_max_strikes,
            mock_env=settings.mock_env,
        )

    def get(self) -> RuntimeConfigModel:
        return self._model.model_copy(deep=True)

    def update(self, patch: Dict[str, Any]) -> RuntimeConfigModel:
        """Memory-only update (call `update_and_persist` to also write the DB)."""
        merged = self._model.model_dump()
        merged.update({k: v for k, v in patch.items() if k in merged})
        self._model = RuntimeConfigModel(**merged)
        return self.get()

    async def hydrate_from_db(self) -> RuntimeConfigModel:
        """Load the persisted singleton row into the cache (call after init_db)."""
        from app.core import database  # local import avoids a circular dependency

        self._model = await database.get_runtime_config()
        return self.get()

    async def update_and_persist(self, patch: Dict[str, Any]) -> RuntimeConfigModel:
        """Update the cache and persist atomically to runtime_config (id=1)."""
        from app.core import database  # local import avoids a circular dependency

        self.update(patch)
        self._model = await database.update_runtime_config(self._model)
        return self.get()


@lru_cache
def get_runtime_config_manager() -> RuntimeConfig:
    return RuntimeConfig()


def get_runtime_config() -> RuntimeConfigModel:
    """Synchronous accessor used by nodes (e.g. Node 5 reads blast_threshold)."""
    return get_runtime_config_manager().get()
