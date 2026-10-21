"""OAA LangGraph workflow builder.

Phase 3 ships the *partial* graph — Nodes 1→5 with the sequential adversarial
debate (Locked Decision 2):

    N1 (ingest) → N2 R1 (forensics) → N3 R2 (finops) → N2 R3 (forensics)
                → N4 (arbiter) → N5 (blast-radius gate) → END

Every node is wrapped in an instrumentation wrapper that:
  * records start/end and elapsed_ms,
  * inserts a `node_snapshots` row (node_id, name, status, elapsed_ms, full state_json),
  * invokes an injected optional async `event_sink(event_dict)` callback
    (default no-op — Phase 5 injects the SSE broadcaster).

The full 10-node builder (`build_graph`) is reserved for Phase 4.
"""

import time
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

from langgraph.graph import END, START, StateGraph

from app.core import database
from app.graph.nodes.node_01_ingest import ingest_node
from app.graph.nodes.node_02_forensics import forensics_round1, forensics_round3
from app.graph.nodes.node_03_finops import finops_round2
from app.graph.nodes.node_04_arbiter import arbiter_node
from app.graph.nodes.node_05_blast_radius import blast_radius_gate
from app.mocks import get_scenario
from app.schemas.state import OAAState

EventSink = Callable[[Dict[str, Any]], Awaitable[None]]

# Keys that use an Annotated reducer (operator.add) in OAAState — the
# instrumentation wrapper must apply the same merge semantics when building the
# full `state_json` snapshot.
_REDUCER_KEYS = {"debate_transcript"}

# (graph key, node_id, node_name, node fn) — in execution order.
_PARTIAL_NODES: List[Tuple[str, int, str, Callable]] = [
    ("node_01_ingest", 1, "ingest_node", ingest_node),
    ("node_02_forensics_r1", 2, "forensics_node", forensics_round1),
    ("node_03_finops_r2", 3, "finops_node", finops_round2),
    ("node_02_forensics_r3", 2, "forensics_node", forensics_round3),
    ("node_04_arbiter", 4, "arbiter_node", arbiter_node),
    ("node_05_blast_radius", 5, "blast_radius_gate", blast_radius_gate),
]


# --------------------------------------------------------------------------- #
# Initial state                                                                #
# --------------------------------------------------------------------------- #

def make_initial_state(incident_id: str, scenario_key: str) -> Dict[str, Any]:
    """Build a complete OAAState for the given scenario (service/alert_name are
    derived from the fixture, as the `/ingest` API only supplies scenario_key)."""
    scenario = get_scenario(scenario_key)
    return {
        "incident_id": incident_id,
        "scenario_key": scenario_key,
        "service": scenario["service"],
        "alert_name": scenario["alert_name"],
        "telemetry": {},
        "debate_transcript": [],
        "arbiter_decision": {},
        "blast_radius_score": 0.0,
        "selected_tier": "",
        "sandbox_result": {},
        "hitl_decision": None,
        "execution_status": "",
        "patch_bundle": None,
        "strike_count": 0,
        "max_strikes": 3,
        "prompt_hint": None,
        "final_post_mortem_report": "",
    }


# --------------------------------------------------------------------------- #
# Instrumentation wrapper                                                      #
# --------------------------------------------------------------------------- #

def _apply_update(state: Dict[str, Any], update: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Merge a node's returned update into the full state, honouring the
    `operator.add` reducer on `debate_transcript` (the only reducer key)."""
    merged = dict(state)
    for key, value in (update or {}).items():
        if key in _REDUCER_KEYS:
            merged[key] = list(state.get(key) or []) + list(value)
        else:
            merged[key] = value
    return merged


async def _noop_event_sink(event: Dict[str, Any]) -> None:
    return None


def _instrument(
    node_id: int,
    node_name: str,
    fn: Callable,
    event_sink: EventSink,
) -> Callable:
    async def wrapped(state: Dict[str, Any]) -> Dict[str, Any]:
        incident_id = state.get("incident_id", "")
        start = time.perf_counter()

        await event_sink(
            {
                "event": "node_update",
                "incident_id": incident_id,
                "node_id": node_id,
                "status": "RUNNING",
                "state": {},
            }
        )

        try:
            update = await fn(state)
        except Exception:
            elapsed_ms = int((time.perf_counter() - start) * 1000)
            await database.insert_node_snapshot(
                incident_id, node_id, node_name, "HALTED", elapsed_ms, _apply_update(state, {})
            )
            await event_sink(
                {
                    "event": "node_update",
                    "incident_id": incident_id,
                    "node_id": node_id,
                    "status": "HALTED",
                    "state": {},
                }
            )
            raise

        elapsed_ms = int((time.perf_counter() - start) * 1000)
        await database.insert_node_snapshot(
            incident_id, node_id, node_name, "COMPLETED", elapsed_ms, _apply_update(state, update)
        )
        await event_sink(
            {
                "event": "node_update",
                "incident_id": incident_id,
                "node_id": node_id,
                "status": "COMPLETED",
                "state": update or {},
            }
        )
        return update

    return wrapped


# --------------------------------------------------------------------------- #
# Graph builders                                                               #
# --------------------------------------------------------------------------- #

def build_partial_graph(event_sink: Optional[EventSink] = None):
    """Compile Nodes 1→5 with the sequential debate + instrumentation wrapper."""
    sink: EventSink = event_sink or _noop_event_sink

    graph = StateGraph(OAAState)

    for key, node_id, node_name, fn in _PARTIAL_NODES:
        graph.add_node(key, _instrument(node_id, node_name, fn, sink))

    keys = [key for key, _, _, _ in _PARTIAL_NODES]
    graph.add_edge(START, keys[0])
    for prev, nxt in zip(keys, keys[1:]):
        graph.add_edge(prev, nxt)
    graph.add_edge(keys[-1], END)

    return graph.compile()


def build_graph(event_sink: Optional[EventSink] = None):
    """Full 10-node builder — implemented in Phase 4 (PROMPTS.md)."""
    raise NotImplementedError(
        "The full 10-node workflow (Nodes 6–10, interrupt(), checkpointer) "
        "lands in Phase 4. Use build_partial_graph() for the Nodes 1–5 gate."
    )
