"""OAA SQLite WAL blackbox ledger — schema, seeding, and async CRUD.

Schema is verbatim from CONTEXT.md §5. WAL mode + synchronous=NORMAL give
concurrent read/write safety for the graph writer + SSE readers.

Seeding (idempotent): when `incidents` is empty, INC-4818 (RESOLVED, Tier 1)
and INC-4815 (HALTED_STRIKES, 3/3 strikes on Node 8) are inserted with their
full node_snapshots chains from app/mocks/scenarios.json (CONTEXT §8 rule 5).

DB path resolution: `OAA_DATABASE_PATH` env var (used by tests) wins over the
`DATABASE_PATH` setting from .env.
"""

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncIterator, Dict, List, Optional

import aiosqlite

from app.core.config import get_settings
from app.schemas.models import RuntimeConfigModel

_SCHEMA = """
CREATE TABLE IF NOT EXISTS incidents (
    incident_id TEXT PRIMARY KEY,
    service TEXT NOT NULL,
    alert_name TEXT NOT NULL,
    status TEXT NOT NULL, -- 'RUNNING', 'PAUSED_HITL', 'RESOLVED', 'HALTED_STRIKES'
    selected_tier TEXT,
    blast_radius_score REAL,
    is_code_bug INTEGER DEFAULT 0,
    strike_count INTEGER DEFAULT 0,
    max_strikes_override INTEGER DEFAULT 3,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    final_report_md TEXT
);

CREATE TABLE IF NOT EXISTS node_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT NOT NULL,
    node_id INTEGER NOT NULL,
    node_name TEXT NOT NULL,
    status TEXT NOT NULL,
    elapsed_ms INTEGER DEFAULT 0,
    state_json TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(incident_id) REFERENCES incidents(incident_id)
);

CREATE TABLE IF NOT EXISTS runtime_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    blast_threshold REAL DEFAULT 0.40,
    global_max_strikes INTEGER DEFAULT 3,
    mock_env INTEGER DEFAULT 1,
    tool_permissions_json TEXT NOT NULL
);
"""

_SCENARIOS_PATH = Path(__file__).resolve().parent.parent / "mocks" / "scenarios.json"
_REPO_ROOT = Path(__file__).resolve().parents[3]  # .../OAA (repo root)


def _db_path() -> str:
    """OAA_DATABASE_PATH (tests, absolute) wins; otherwise DATABASE_PATH is
    resolved relative to the repo root so cwd never changes the DB location."""
    raw = os.environ.get("OAA_DATABASE_PATH") or get_settings().database_path
    path = Path(raw)
    if not path.is_absolute():
        path = _REPO_ROOT / path
    path.parent.mkdir(parents=True, exist_ok=True)
    return str(path)


@asynccontextmanager
async def _connect() -> AsyncIterator[aiosqlite.Connection]:
    """Per-call connection (started) with Row factory for dict-style access."""
    conn = await aiosqlite.connect(_db_path())
    try:
        conn.row_factory = aiosqlite.Row
        yield conn
    finally:
        await conn.close()


def _row_to_dict(row: aiosqlite.Row) -> Dict[str, Any]:
    return dict(row)


# --------------------------------------------------------------------------- #
# init / seed                                                                  #
# --------------------------------------------------------------------------- #

async def init_db() -> None:
    """Create the WAL database, the three tables, the config singleton, and
    (on first boot only) the two seeded historical tickets."""
    async with _connect() as db:
        await db.execute("PRAGMA journal_mode=WAL;")
        await db.execute("PRAGMA synchronous=NORMAL;")
        await db.executescript(_SCHEMA)

        # runtime_config singleton (id=1), seeded from env defaults if absent
        cur = await db.execute("SELECT COUNT(*) AS n FROM runtime_config;")
        if (await cur.fetchone())["n"] == 0:
            settings = get_settings()
            defaults = RuntimeConfigModel(
                blast_threshold=settings.blast_threshold,
                global_max_strikes=settings.global_max_strikes,
                mock_env=settings.mock_env,
            )
            await db.execute(
                "INSERT INTO runtime_config (id, blast_threshold, global_max_strikes, mock_env, tool_permissions_json)"
                " VALUES (1, ?, ?, ?, ?);",
                (
                    defaults.blast_threshold,
                    defaults.global_max_strikes,
                    int(defaults.mock_env),
                    json.dumps(defaults.enabled_tools),
                ),
            )

        # seeded historical tickets — only when the ledger is empty (idempotent)
        cur = await db.execute("SELECT COUNT(*) AS n FROM incidents;")
        if (await cur.fetchone())["n"] == 0:
            await _seed_historical_tickets(db)

        await db.commit()


async def _seed_historical_tickets(db: aiosqlite.Connection) -> None:
    with open(_SCENARIOS_PATH, encoding="utf-8") as f:
        seeds = json.load(f)["SEEDED_TICKETS"]

    for ticket in seeds.values():
        inc = ticket["incident"]
        await db.execute(
            "INSERT INTO incidents (incident_id, service, alert_name, status, selected_tier,"
            " blast_radius_score, is_code_bug, strike_count, max_strikes_override, created_at, final_report_md)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
            (
                inc["incident_id"],
                inc["service"],
                inc["alert_name"],
                inc["status"],
                inc["selected_tier"],
                inc["blast_radius_score"],
                inc["is_code_bug"],
                inc["strike_count"],
                inc["max_strikes_override"],
                inc["created_at"],
                inc["final_report_md"],
            ),
        )
        for snap in ticket["snapshots"]:
            await db.execute(
                "INSERT INTO node_snapshots (incident_id, node_id, node_name, status, elapsed_ms, state_json, timestamp)"
                " VALUES (?, ?, ?, ?, ?, ?, ?);",
                (
                    inc["incident_id"],
                    snap["node_id"],
                    snap["node_name"],
                    snap["status"],
                    snap["elapsed_ms"],
                    json.dumps(snap["state_json"]),
                    snap["timestamp"],
                ),
            )


# --------------------------------------------------------------------------- #
# incidents CRUD                                                               #
# --------------------------------------------------------------------------- #

async def create_incident(
    incident_id: str,
    service: str,
    alert_name: str,
    status: str = "RUNNING",
) -> Dict[str, Any]:
    async with _connect() as db:
        await db.execute(
            "INSERT INTO incidents (incident_id, service, alert_name, status) VALUES (?, ?, ?, ?);",
            (incident_id, service, alert_name, status),
        )
        await db.commit()
    created = await get_incident(incident_id)
    assert created is not None
    return created


async def update_incident_status(
    incident_id: str,
    status: str,
    *,
    selected_tier: Optional[str] = None,
    blast_radius_score: Optional[float] = None,
    is_code_bug: Optional[bool] = None,
    strike_count: Optional[int] = None,
    max_strikes_override: Optional[int] = None,
) -> None:
    fields: Dict[str, Any] = {"status": status}
    if selected_tier is not None:
        fields["selected_tier"] = selected_tier
    if blast_radius_score is not None:
        fields["blast_radius_score"] = blast_radius_score
    if is_code_bug is not None:
        fields["is_code_bug"] = int(is_code_bug)
    if strike_count is not None:
        fields["strike_count"] = strike_count
    if max_strikes_override is not None:
        fields["max_strikes_override"] = max_strikes_override

    assignments = ", ".join(f"{col} = ?" for col in fields)
    async with _connect() as db:
        await db.execute(
            f"UPDATE incidents SET {assignments} WHERE incident_id = ?;",
            (*fields.values(), incident_id),
        )
        await db.commit()


async def set_final_report(incident_id: str, report_md: str) -> None:
    async with _connect() as db:
        await db.execute(
            "UPDATE incidents SET final_report_md = ? WHERE incident_id = ?;",
            (report_md, incident_id),
        )
        await db.commit()


async def get_incident(incident_id: str) -> Optional[Dict[str, Any]]:
    async with _connect() as db:
        cur = await db.execute("SELECT * FROM incidents WHERE incident_id = ?;", (incident_id,))
        row = await cur.fetchone()
        return _row_to_dict(row) if row else None


async def list_incidents(tier: Optional[str] = None) -> List[Dict[str, Any]]:
    async with _connect() as db:
        if tier:
            cur = await db.execute(
                "SELECT * FROM incidents WHERE selected_tier = ? ORDER BY created_at DESC, incident_id DESC;",
                (tier,),
            )
        else:
            cur = await db.execute("SELECT * FROM incidents ORDER BY created_at DESC, incident_id DESC;")
        return [_row_to_dict(r) for r in await cur.fetchall()]


async def get_last_healthy_summary() -> Optional[Dict[str, Any]]:
    """Digest of the most recent RESOLVED ticket — powers the idle dashboard bento."""
    async with _connect() as db:
        cur = await db.execute(
            "SELECT * FROM incidents WHERE status = 'RESOLVED' ORDER BY created_at DESC, incident_id DESC LIMIT 1;"
        )
        row = await cur.fetchone()
        if not row:
            return None
        inc = _row_to_dict(row)
        cur = await db.execute(
            "SELECT COUNT(*) AS n FROM node_snapshots WHERE incident_id = ?;", (inc["incident_id"],)
        )
        snap_count = (await cur.fetchone())["n"]
        return {
            "incident_id": inc["incident_id"],
            "service": inc["service"],
            "alert_name": inc["alert_name"],
            "selected_tier": inc["selected_tier"],
            "blast_radius_score": inc["blast_radius_score"],
            "resolved_at": inc["created_at"],
            "snapshot_count": snap_count,
            "final_report_md": inc["final_report_md"],
        }


# --------------------------------------------------------------------------- #
# node_snapshots CRUD                                                          #
# --------------------------------------------------------------------------- #

async def insert_node_snapshot(
    incident_id: str,
    node_id: int,
    node_name: str,
    status: str,
    elapsed_ms: int,
    state_json: Dict[str, Any],
) -> int:
    async with _connect() as db:
        cur = await db.execute(
            "INSERT INTO node_snapshots (incident_id, node_id, node_name, status, elapsed_ms, state_json)"
            " VALUES (?, ?, ?, ?, ?, ?);",
            (incident_id, node_id, node_name, status, elapsed_ms, json.dumps(state_json)),
        )
        await db.commit()
        return int(cur.lastrowid)


async def get_snapshots(incident_id: str) -> List[Dict[str, Any]]:
    async with _connect() as db:
        cur = await db.execute(
            "SELECT * FROM node_snapshots WHERE incident_id = ? ORDER BY id ASC;", (incident_id,)
        )
        return [_row_to_dict(r) for r in await cur.fetchall()]


async def get_latest_snapshot(incident_id: str) -> Optional[Dict[str, Any]]:
    async with _connect() as db:
        cur = await db.execute(
            "SELECT * FROM node_snapshots WHERE incident_id = ? ORDER BY id DESC LIMIT 1;", (incident_id,)
        )
        row = await cur.fetchone()
        return _row_to_dict(row) if row else None


# --------------------------------------------------------------------------- #
# runtime_config CRUD + id allocation                                          #
# --------------------------------------------------------------------------- #

async def get_runtime_config() -> RuntimeConfigModel:
    async with _connect() as db:
        cur = await db.execute("SELECT * FROM runtime_config WHERE id = 1;")
        row = await cur.fetchone()
        if row is None:
            raise RuntimeError("runtime_config singleton missing — run init_db() first")
        return RuntimeConfigModel(
            blast_threshold=row["blast_threshold"],
            global_max_strikes=row["global_max_strikes"],
            mock_env=bool(row["mock_env"]),
            enabled_tools=json.loads(row["tool_permissions_json"]),
        )


async def update_runtime_config(model: RuntimeConfigModel) -> RuntimeConfigModel:
    async with _connect() as db:
        await db.execute(
            "UPDATE runtime_config SET blast_threshold = ?, global_max_strikes = ?, mock_env = ?,"
            " tool_permissions_json = ? WHERE id = 1;",
            (
                model.blast_threshold,
                model.global_max_strikes,
                int(model.mock_env),
                json.dumps(model.enabled_tools),
            ),
        )
        await db.commit()
    return await get_runtime_config()


async def next_incident_id() -> str:
    """INC-<max numeric suffix + 1>. With the seeded ledger this yields INC-4819."""
    async with _connect() as db:
        cur = await db.execute(
            "SELECT MAX(CAST(SUBSTR(incident_id, 5) AS INTEGER)) AS mx FROM incidents;"
        )
        mx = (await cur.fetchone())["mx"]
        return f"INC-{(mx or 4799) + 1}"
