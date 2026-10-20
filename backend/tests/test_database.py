"""Phase 2 gate — SQLite WAL blackbox ledger: schema, seeding, CRUD."""

import os
import sqlite3

import pytest

from app.core import database


@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    """Every test gets its own throwaway WAL database."""
    monkeypatch.setenv("OAA_DATABASE_PATH", str(tmp_path / "test.db"))


async def test_wal_mode_and_seeds():
    await database.init_db()

    conn = sqlite3.connect(os.environ["OAA_DATABASE_PATH"])
    try:
        mode = conn.execute("PRAGMA journal_mode;").fetchone()[0]
    finally:
        conn.close()
    assert mode == "wal"

    incidents = await database.list_incidents()
    assert len(incidents) == 2
    by_id = {inc["incident_id"]: inc for inc in incidents}

    assert by_id["INC-4818"]["status"] == "RESOLVED"
    assert by_id["INC-4818"]["selected_tier"] == "TIER_1_AUTONOMOUS"
    assert by_id["INC-4815"]["status"] == "HALTED_STRIKES"
    assert by_id["INC-4815"]["strike_count"] == 3
    assert by_id["INC-4815"]["max_strikes_override"] == 3

    snaps_4818 = await database.get_snapshots("INC-4818")
    snaps_4815 = await database.get_snapshots("INC-4815")
    assert len(snaps_4818) == 10  # 1,2,3,2,4,5,6,7,9,10 — Node 8 skipped (infra-only)
    assert len(snaps_4815) == 13  # 1,2,3,2,4,5,6,7 + three Node-8 strikes + 9,10
    assert [s["state_json"] for s in snaps_4815 if s["node_id"] == 8]


async def test_seed_idempotent():
    await database.init_db()
    await database.init_db()  # second boot must not duplicate anything
    assert len(await database.list_incidents()) == 2
    assert len(await database.get_snapshots("INC-4815")) == 13


async def test_crud_roundtrip():
    await database.init_db()
    created = await database.create_incident("INC-9901", "demo-svc", "HighErrorRate")
    assert created["status"] == "RUNNING"

    await database.update_incident_status(
        "INC-9901",
        "PAUSED_HITL",
        selected_tier="TIER_2_HITL",
        blast_radius_score=0.51,
        is_code_bug=True,
        strike_count=2,
    )
    inc = await database.get_incident("INC-9901")
    assert inc["status"] == "PAUSED_HITL"
    assert inc["selected_tier"] == "TIER_2_HITL"
    assert inc["blast_radius_score"] == 0.51
    assert inc["is_code_bug"] == 1
    assert inc["strike_count"] == 2

    await database.set_final_report("INC-9901", "# final report")
    inc = await database.get_incident("INC-9901")
    assert inc["final_report_md"] == "# final report"

    await database.insert_node_snapshot("INC-9901", 1, "ingest_node", "COMPLETED", 120, {"k": 1})
    await database.insert_node_snapshot("INC-9901", 4, "arbiter_node", "COMPLETED", 300, {"k": 2})
    snaps = await database.get_snapshots("INC-9901")
    assert [s["node_id"] for s in snaps] == [1, 4]
    latest = await database.get_latest_snapshot("INC-9901")
    assert latest["node_id"] == 4

    tier2 = await database.list_incidents(tier="TIER_2_HITL")
    assert {i["incident_id"] for i in tier2} == {"INC-9901"}


async def test_next_incident_id():
    await database.init_db()
    assert await database.next_incident_id() == "INC-4819"
    await database.create_incident("INC-4819", "svc", "Alert")
    assert await database.next_incident_id() == "INC-4820"


async def test_runtime_config_roundtrip():
    await database.init_db()
    cfg = await database.get_runtime_config()
    assert cfg.blast_threshold == 0.40
    assert cfg.global_max_strikes == 3
    assert cfg.mock_env is True
    assert len(cfg.enabled_tools) == 6
    assert all(cfg.enabled_tools.values())

    cfg.blast_threshold = 0.55
    cfg.global_max_strikes = 4
    cfg.mock_env = False
    cfg.enabled_tools["kill_db_pid"] = False
    await database.update_runtime_config(cfg)

    persisted = await database.get_runtime_config()
    assert persisted.blast_threshold == 0.55
    assert persisted.global_max_strikes == 4
    assert persisted.mock_env is False
    assert persisted.enabled_tools["kill_db_pid"] is False


async def test_last_healthy_summary():
    await database.init_db()
    summary = await database.get_last_healthy_summary()
    assert summary is not None
    assert summary["incident_id"] == "INC-4818"
    assert summary["selected_tier"] == "TIER_1_AUTONOMOUS"
    assert "Morning Digest" in summary["final_report_md"]
