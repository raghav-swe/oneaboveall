"""Regression — `GET /api/v1/incidents/{id}/snapshots`.

The `/history` replay engine and node inspector need the ordered
`node_snapshots` chronology, which no route exposed before this suite
(CONTEXT §6). Rows must come back in execution order (`id ASC`) with node ids
repeating legitimately (debate round 2 re-uses node 2; Node 8 records one row
per strike).
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setenv("OAA_DATABASE_PATH", str(tmp_path / "ledger.db"))
    monkeypatch.setenv("OAA_CHECKPOINT_DB_PATH", str(tmp_path / "checkpoints.db"))


def test_snapshots_endpoint_returns_ordered_chronology():
    with TestClient(app) as client:
        response = client.get("/api/v1/incidents/INC-4818/snapshots")
        assert response.status_code == 200

        body = response.json()
        assert body["incident_id"] == "INC-4818"

        snapshots = body["snapshots"]
        # Seeded chain: Node 8 skipped (infra-only), debate round 2 re-uses node 2.
        assert [s["node_id"] for s in snapshots] == [1, 2, 3, 2, 4, 5, 6, 7, 9, 10]
        # Insertion order == chronology.
        assert [s["id"] for s in snapshots] == sorted(s["id"] for s in snapshots)

        first = snapshots[0]
        for key in (
            "id",
            "incident_id",
            "node_id",
            "node_name",
            "status",
            "elapsed_ms",
            "state_json",
            "timestamp",
        ):
            assert key in first, f"missing snapshot column '{key}'"


def test_snapshots_endpoint_exposes_strike_chain():
    """INC-4815 must show Node 8 three times (one row per failed strike)."""
    with TestClient(app) as client:
        snapshots = client.get("/api/v1/incidents/INC-4815/snapshots").json()["snapshots"]

    node_ids = [s["node_id"] for s in snapshots]
    assert node_ids == [1, 2, 3, 2, 4, 5, 6, 7, 8, 8, 8, 9, 10]


def test_snapshots_endpoint_404s_for_unknown_ticket():
    with TestClient(app) as client:
        response = client.get("/api/v1/incidents/INC-0000/snapshots")
    assert response.status_code == 404
