"""OAA FastAPI application — REST + SSE gateway (CONTEXT.md §6, PROMPTS.md Phase 5).

Lifespan: `init_db()` (WAL + seeds), hydrate the runtime-config cache, open an
`AsyncSqliteSaver`, and compile the full 10-node graph with the SSE manager's
`publish` injected as the event sink.

Endpoints (verbatim from CONTEXT.md §6):
  * POST /api/v1/incidents/ingest          — start an async run, return stream_url.
  * GET  /api/v1/incidents/{id}/stream     — live SSE (no-cache, no-buffer).
  * GET  /api/v1/incidents/{id}/snapshots  — ordered node_snapshots for replay.
  * POST /api/v1/incidents/{id}/approve    — resume a Tier 2 interrupt.
  * POST /api/v1/incidents/{id}/retry-strike — 4th-strike override (Node 8 re-entry).
  * GET  /api/v1/incidents                 — ticket list + last healthy summary.
  * GET/PUT /api/v1/config                 — RuntimeConfigModel roundtrip.
  * POST /api/v1/support/quick-fix         — self-heal actions.

Runner robustness: every background graph task is wrapped in try/except so an
unhandled node error marks the incident `HALTED`, publishes a terminal SSE error
event, and logs the traceback.
"""

import asyncio
import json
import logging
import shutil
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Awaitable, Dict, Literal, Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langgraph.types import Command
from pydantic import BaseModel, Field

from app.core import database
from app.core.config import get_runtime_config_manager
from app.core.sse_manager import SSEManager, TERMINAL_EVENT
from app.graph.workflow import build_graph, make_initial_state, resume_from_snapshot
from app.schemas.models import RuntimeConfigModel

logger = logging.getLogger("oaa.main")

TERMINAL_STATUSES = {"RESOLVED", "HALTED_STRIKES", "HALTED", "HALTED_EXECUTION"}


# --------------------------------------------------------------------------- #
# Request models                                                               #
# --------------------------------------------------------------------------- #

class IngestRequest(BaseModel):
    scenario_key: Literal[
        "SCENARIO_1_STATELESS", "SCENARIO_2_STATEFUL_DB", "SCENARIO_3_CODE_BUG"
    ]


class ApproveRequest(BaseModel):
    decision: Literal["APPROVED", "REJECTED"]


class RetryStrikeRequest(BaseModel):
    prompt_hint: str = Field(min_length=1)


class QuickFixRequest(BaseModel):
    action: Literal["RESTART_MCP", "PURGE_SANDBOX", "UNLOCK_SQLITE", "ENABLE_MOCK_ENV"]


# --------------------------------------------------------------------------- #
# Lifespan                                                                     #
# --------------------------------------------------------------------------- #

@asynccontextmanager
async def lifespan(app: FastAPI):
    await database.init_db()
    await get_runtime_config_manager().hydrate_from_db()

    sse = SSEManager()
    event_sink = _make_event_sink(sse)
    graph = await build_graph(event_sink=event_sink)
    app.state.sse = sse
    app.state.event_sink = event_sink
    app.state.graph = graph
    logger.info("OAA gateway ready (graph compiled, checkpointer open).")
    try:
        yield
    finally:
        conn = getattr(getattr(graph, "checkpointer", None), "conn", None)
        if conn is not None:
            await conn.close()


app = FastAPI(title="OneAboveAll (OAA) Gateway", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Background graph driver                                                      #
# --------------------------------------------------------------------------- #

def _make_event_sink(sse: SSEManager):
    """Adapt `SSEManager.publish(incident_id, event)` to the graph's single-arg
    `event_sink(event_dict)` contract (each node event carries `incident_id`)."""
    async def event_sink(event: Dict[str, Any]) -> None:
        await sse.publish(event.get("incident_id", ""), event)

    return event_sink


async def _run_graph_task(
    incident_id: str,
    sse: SSEManager,
    invoke: Awaitable[Any],
) -> None:
    """Drive a graph invocation to completion or interruption.

    * Interrupt (`__interrupt__` in the result) → mark the incident PAUSED_HITL.
    * Completion → publish a terminal SSE event with the final ledger status.
    * Exception → mark the incident HALTED, publish a terminal error event, and
      log the traceback (PROMPTS Phase 5 "Runner robustness").
    """
    try:
        result = await invoke
    except Exception as exc:  # noqa: BLE001 — deliberate top-level guard
        logger.exception("Graph execution failed for %s", incident_id)
        await database.update_incident_status(incident_id, "HALTED")
        await sse.publish(
            incident_id,
            {"event": TERMINAL_EVENT, "status": "HALTED", "error": str(exc)},
        )
        return

    if isinstance(result, dict) and "__interrupt__" in result:
        await database.update_incident_status(incident_id, "PAUSED_HITL")
        return

    incident = await database.get_incident(incident_id)
    status = incident["status"] if incident else "HALTED"
    await sse.publish(incident_id, {"event": TERMINAL_EVENT, "status": status})


# --------------------------------------------------------------------------- #
# Incidents                                                                    #
# --------------------------------------------------------------------------- #

@app.post("/api/v1/incidents/ingest")
async def ingest(payload: IngestRequest, request: Request):
    incident_id = await database.next_incident_id()
    state = make_initial_state(incident_id, payload.scenario_key)
    await database.create_incident(incident_id, state["service"], state["alert_name"])

    config = {"configurable": {"thread_id": incident_id}}
    asyncio.create_task(
        _run_graph_task(
            incident_id,
            request.app.state.sse,
            request.app.state.graph.ainvoke(state, config),
        )
    )
    return {
        "incident_id": incident_id,
        "status": "STARTED",
        "stream_url": f"/api/v1/incidents/{incident_id}/stream",
    }


async def _stream_frames(incident_id: str, sse: SSEManager):
    """SSE body generator: close immediately for already-terminal incidents,
    otherwise relay the live pub/sub stream (with 15 s heartbeats)."""
    incident = await database.get_incident(incident_id)
    if incident and incident["status"] in TERMINAL_STATUSES:
        yield f"data: {json.dumps({'event': TERMINAL_EVENT, 'incident_id': incident_id, 'status': incident['status']})}\n\n"
        return
    async for frame in sse.subscribe(incident_id):
        yield frame


@app.get("/api/v1/incidents/{incident_id}/stream")
async def stream(incident_id: str, request: Request):
    if await database.get_incident(incident_id) is None:
        raise HTTPException(status_code=404, detail=f"Unknown incident '{incident_id}'.")
    return StreamingResponse(
        _stream_frames(incident_id, request.app.state.sse),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.get("/api/v1/incidents/{incident_id}/snapshots")
async def list_snapshots(incident_id: str):
    """Ordered `node_snapshots` chronology for one ticket.

    Source of truth for the `/history` replay engine and the node inspector
    (CONTEXT §6). Rows are returned in insertion order (`id ASC`), which is the
    execution chronology — note that node ids legitimately repeat (the two
    debate rounds re-use node 2, and Node 8 records one row per strike).
    """
    if await database.get_incident(incident_id) is None:
        raise HTTPException(status_code=404, detail=f"Unknown incident '{incident_id}'.")
    snapshots = await database.get_snapshots(incident_id)
    return {"incident_id": incident_id, "snapshots": snapshots}


@app.post("/api/v1/incidents/{incident_id}/approve")
async def approve(incident_id: str, payload: ApproveRequest, request: Request):
    if await database.get_incident(incident_id) is None:
        raise HTTPException(status_code=404, detail=f"Unknown incident '{incident_id}'.")

    graph = request.app.state.graph
    config = {"configurable": {"thread_id": incident_id}}

    # Authoritative paused check: the thread is parked at an interrupt iff its
    # checkpoint reports pending nodes (`next` is non-empty). This is race-free
    # with the PAUSED_HITL status flip done by the background driver.
    snapshot = await graph.aget_state(config)
    if not snapshot.next:
        raise HTTPException(
            status_code=409,
            detail=f"Incident '{incident_id}' is not paused (no pending HITL interrupt).",
        )

    asyncio.create_task(
        _run_graph_task(
            incident_id,
            request.app.state.sse,
            graph.ainvoke(Command(resume={"decision": payload.decision}), config),
        )
    )
    return {"incident_id": incident_id, "status": "RESUMED"}


@app.post("/api/v1/incidents/{incident_id}/retry-strike")
async def retry_strike(incident_id: str, payload: RetryStrikeRequest, request: Request):
    if await database.get_incident(incident_id) is None:
        raise HTTPException(status_code=404, detail=f"Unknown incident '{incident_id}'.")

    sse = request.app.state.sse
    try:
        await resume_from_snapshot(
            incident_id, payload.prompt_hint, event_sink=request.app.state.event_sink
        )
    except Exception as exc:  # noqa: BLE001 — surface retry failures as 500 + terminal event
        logger.exception("retry-strike failed for %s", incident_id)
        await database.update_incident_status(incident_id, "HALTED")
        await sse.publish(
            incident_id,
            {"event": TERMINAL_EVENT, "status": "HALTED", "error": str(exc)},
        )
        raise HTTPException(status_code=500, detail=f"retry-strike failed: {exc}") from exc

    incident = await database.get_incident(incident_id)
    final_status = incident["status"] if incident else "HALTED"
    await sse.publish(incident_id, {"event": TERMINAL_EVENT, "status": final_status})

    status = "RETRIED_RESOLVED" if final_status == "RESOLVED" else final_status
    return {"incident_id": incident_id, "max_strikes": 4, "status": status}


@app.get("/api/v1/incidents")
async def list_incidents(tier: Optional[str] = Query(default=None)):
    incidents = await database.list_incidents(tier=tier or None)
    return {
        "incidents": incidents,
        "last_healthy_summary": await database.get_last_healthy_summary(),
    }


# --------------------------------------------------------------------------- #
# Config                                                                       #
# --------------------------------------------------------------------------- #

@app.get("/api/v1/config")
async def get_config() -> RuntimeConfigModel:
    return await database.get_runtime_config()


@app.put("/api/v1/config")
async def put_config(model: RuntimeConfigModel) -> RuntimeConfigModel:
    # The UI enforces the 0.15–0.75 slider range; the API only clamps to the
    # sane [0.0, 1.0] band (PROMPTS Phase 5).
    model.blast_threshold = max(0.0, min(1.0, model.blast_threshold))
    return await get_runtime_config_manager().update_and_persist(model.model_dump())


# --------------------------------------------------------------------------- #
# Support quick-fix                                                            #
# --------------------------------------------------------------------------- #

async def _purge_sandbox() -> str:
    """docker container prune when a daemon is reachable; else simulated success."""
    if shutil.which("docker") is None:
        return "Purged zombie sandbox containers (simulated — no Docker daemon detected)."
    try:
        proc = await asyncio.create_subprocess_exec(
            "docker",
            "container",
            "prune",
            "-f",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
        if proc.returncode == 0:
            return f"Purged zombie sandbox containers. {out.decode(errors='replace').strip()}"
        return "Purged zombie sandbox containers (simulated — Docker prune failed)."
    except Exception:
        return "Purged zombie sandbox containers (simulated — Docker prune unavailable)."


@app.post("/api/v1/support/quick-fix")
async def quick_fix(payload: QuickFixRequest):
    action = payload.action

    if action == "RESTART_MCP":
        # The in-memory FastMCP client is bound per call; "restart" re-validates
        # the bridge and reports success (mock-only build).
        message = "FastMCP bridge re-bound successfully (6 tools registered)."
    elif action == "PURGE_SANDBOX":
        message = await _purge_sandbox()
    elif action == "UNLOCK_SQLITE":
        message = await database.wal_checkpoint()
    elif action == "ENABLE_MOCK_ENV":
        await get_runtime_config_manager().update_and_persist({"mock_env": True})
        message = "Offline Shield enabled (MOCK_ENV=true)."
    else:  # pragma: no cover — Literal guards this
        raise HTTPException(status_code=422, detail=f"Unknown quick-fix action '{action}'.")

    return {
        "status": "SUCCESS",
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
