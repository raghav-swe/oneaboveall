"""Phase 5 smoke test (plain script, not pytest) — PROMPTS.md Verification Gate.

Boots uvicorn programmatically on a random port, then drives the full REST + SSE
contract over httpx:

  1. Ingest S1 → collect SSE → ordered node_update events through node 10 + RESOLVED.
  2. Ingest S2 → PAUSED at node 6 → approve → RESOLVED.
  3. GET /api/v1/incidents → seeds + the two new runs.
  4. GET/PUT /api/v1/config → roundtrip + threshold clamp.
  5. One quick-fix action → SUCCESS.

Run from anywhere (the backend dir is injected onto sys.path):
    uv run python backend/tests/smoke_api.py
"""

import asyncio
import json
import os
import socket
import sys
import tempfile
from pathlib import Path

# UTF-8 output so emoji/arrows don't break the Windows cp1252 console.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Ensure `app` is importable regardless of cwd (script dir steals sys.path[0]).
_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# Isolate ledger + checkpointer BEFORE the server (lifespan) reads settings.
_TMP = tempfile.mkdtemp(prefix="oaa-smoke-")
os.environ["OAA_DATABASE_PATH"] = os.path.join(_TMP, "ledger.db")
os.environ["OAA_CHECKPOINT_DB_PATH"] = os.path.join(_TMP, "checkpoints.db")

import httpx  # noqa: E402
import uvicorn  # noqa: E402

from app.main import app  # noqa: E402

PATH_TIER1 = [1, 2, 3, 2, 4, 5, 6, 7, 9, 10]


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


async def _read_sse_lines(response, on_event, until_terminal=True):
    """Iterate SSE frames; invoke `on_event(event)` for each parsed event.

    Yields control back between events so the caller can issue an HTTP request
    (e.g. `/approve`) mid-stream without dropping buffered frames.
    """
    events = []
    async for line in response.aiter_lines():
        if not line or line.startswith(":"):
            continue
        if not line.startswith("data: "):
            continue
        event = json.loads(line[len("data: "):])
        events.append(event)
        on_event(event)
        if event.get("event") == "terminal":
            break
    return events


async def main() -> None:
    port = _free_port()
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning", access_log=False)
    server = uvicorn.Server(config)
    server_task = asyncio.create_task(server.serve())

    # Wait for startup (lifespan: init_db + graph compile).
    while not server.started:
        if server_task.done():
            server_task.result()  # re-raise if startup crashed
        await asyncio.sleep(0.05)

    base = f"http://127.0.0.1:{port}"
    try:
        async with httpx.AsyncClient(base_url=base, timeout=httpx.Timeout(30.0)) as client:
            # ------------------------------------------------------------- #
            # 1. S1 — Tier 1 autonomous, full run                            #
            # ------------------------------------------------------------- #
            r = await client.post("/api/v1/incidents/ingest", json={"scenario_key": "SCENARIO_1_STATELESS"})
            r.raise_for_status()
            ingest1 = r.json()
            inc1 = ingest1["incident_id"]
            assert ingest1["status"] == "STARTED"
            assert ingest1["stream_url"] == f"/api/v1/incidents/{inc1}/stream"

            print(f"\n=== S1 ({inc1}) SSE sequence ===")
            async with client.stream("GET", ingest1["stream_url"]) as stream:
                assert stream.status_code == 200
                assert stream.headers.get("cache-control") == "no-cache"
                assert stream.headers.get("x-accel-buffering") == "no"

                def _print(event):
                    if event.get("event") == "node_update":
                        print(f"  node {event['node_id']:>2}  {event['status']}")
                    else:
                        print(f"  {event}")

                events = await _read_sse_lines(stream, _print)

            node_events = [e for e in events if e.get("event") == "node_update"]
            completed_path = [e["node_id"] for e in node_events if e["status"] == "COMPLETED"]
            assert completed_path == PATH_TIER1, f"S1 path mismatch: {completed_path}"
            terminal = [e for e in events if e.get("event") == "terminal"]
            assert terminal and terminal[-1]["status"] == "RESOLVED", terminal

            # ------------------------------------------------------------- #
            # 2. S2 — Tier 2 HITL pause → approve → resolve                 #
            # ------------------------------------------------------------- #
            r = await client.post("/api/v1/incidents/ingest", json={"scenario_key": "SCENARIO_2_STATEFUL_DB"})
            r.raise_for_status()
            ingest2 = r.json()
            inc2 = ingest2["incident_id"]

            print(f"\n=== S2 ({inc2}) SSE pause → approve sequence ===")
            approved = False

            async with client.stream("GET", ingest2["stream_url"]) as stream:
                events2 = []

                async def _s2_on_event(event):
                    nonlocal approved
                    events2.append(event)
                    if event.get("event") == "node_update":
                        print(f"  node {event['node_id']:>2}  {event['status']}")
                    else:
                        print(f"  {event}")

                # Read one frame at a time; approve the moment node 6 pauses.
                async for line in stream.aiter_lines():
                    if not line or line.startswith(":"):
                        continue
                    if not line.startswith("data: "):
                        continue
                    event = json.loads(line[len("data: "):])
                    await _s2_on_event(event)

                    if (
                        event.get("event") == "node_update"
                        and event.get("node_id") == 6
                        and event.get("status") == "PAUSED"
                        and not approved
                    ):
                        apr = await client.post(
                            f"/api/v1/incidents/{inc2}/approve", json={"decision": "APPROVED"}
                        )
                        apr.raise_for_status()
                        assert apr.json() == {"incident_id": inc2, "status": "RESUMED"}
                        approved = True

                    if event.get("event") == "terminal":
                        break

            assert approved, "S2 never paused at node 6"
            paused_events = [e for e in events2 if e.get("status") == "PAUSED"]
            assert paused_events and paused_events[0]["node_id"] == 6
            terminal2 = [e for e in events2 if e.get("event") == "terminal"]
            assert terminal2 and terminal2[-1]["status"] == "RESOLVED", terminal2

            # ------------------------------------------------------------- #
            # 3. GET /incidents — seeds + new runs                          #
            # ------------------------------------------------------------- #
            r = await client.get("/api/v1/incidents")
            r.raise_for_status()
            body = r.json()
            ids = {i["incident_id"] for i in body["incidents"]}
            assert {"INC-4818", "INC-4815"} <= ids, ids
            assert {inc1, inc2} <= ids, ids
            assert body["last_healthy_summary"] is not None
            print(f"\n=== /incidents: {len(body['incidents'])} tickets, last_healthy={body['last_healthy_summary']['incident_id']} ===")

            # ------------------------------------------------------------- #
            # 4. GET/PUT /config roundtrip + clamp                          #
            # ------------------------------------------------------------- #
            r = await client.get("/api/v1/config")
            r.raise_for_status()
            cfg = r.json()
            assert cfg["blast_threshold"] == 0.40
            assert cfg["global_max_strikes"] == 3
            assert cfg["mock_env"] is True
            assert len(cfg["enabled_tools"]) == 6

            updated = json.loads(json.dumps(cfg))
            updated["blast_threshold"] = 0.55
            updated["global_max_strikes"] = 4
            updated["enabled_tools"]["kill_db_pid"] = False
            r = await client.put("/api/v1/config", json=updated)
            r.raise_for_status()
            assert r.json()["blast_threshold"] == 0.55
            assert r.json()["global_max_strikes"] == 4
            assert r.json()["enabled_tools"]["kill_db_pid"] is False

            # Clamp: the API only enforces [0.0, 1.0] (UI owns 0.15–0.75).
            updated["blast_threshold"] = 1.5
            r = await client.put("/api/v1/config", json=updated)
            r.raise_for_status()
            assert r.json()["blast_threshold"] == 1.0

            # Restore defaults.
            r = await client.put("/api/v1/config", json=cfg)
            r.raise_for_status()
            assert r.json()["blast_threshold"] == 0.40
            print("\n=== /config roundtrip + clamp OK ===")

            # ------------------------------------------------------------- #
            # 5. Quick-fix                                                  #
            # ------------------------------------------------------------- #
            r = await client.post("/api/v1/support/quick-fix", json={"action": "UNLOCK_SQLITE"})
            r.raise_for_status()
            qf = r.json()
            assert qf["status"] == "SUCCESS"
            assert qf["message"]
            assert qf["timestamp"]
            print(f"\n=== quick-fix: {qf} ===")

    finally:
        server.should_exit = True
        await server_task

    print("\nSMOKE TEST PASSED ✅")


if __name__ == "__main__":
    asyncio.run(main())
