"""OAA SSE pub/sub manager (CONTEXT.md §6, PROMPTS.md Phase 5).

Per-`incident_id` `asyncio.Queue` fan-out:

  * `publish(incident_id, event)` is injected as the LangGraph `event_sink`; it
    fans each node event out to every subscriber of that incident.
  * `subscribe(incident_id)` is an async generator yielding SSE-framed strings
    (`data: <json>\\n\\n`). Idle streams receive a `: ping\\n\\n` heartbeat
    comment every 15 s so multi-hour Tier 2 pauses never drop (CONTEXT §6).
  * `unsubscribe(incident_id, queue=None)` drops one (or all) subscribers.
  * A terminal event (`{"event": "terminal", ...}`) is yielded once and then the
    generator returns, closing the stream cleanly.

Everything runs on a single event loop, so the dict/set mutations here are
atomic (no `await` between check and mutation) and need no explicit lock.
"""

import asyncio
import json
import logging
from typing import Any, AsyncIterator, Dict, Optional, Set

logger = logging.getLogger("oaa.sse")

HEARTBEAT_INTERVAL_SECONDS = 15.0
HEARTBEAT_COMMENT = ": ping\n\n"
TERMINAL_EVENT = "terminal"


class SSEManager:
    """In-memory pub/sub hub for SSE clients, keyed by incident id."""

    def __init__(self) -> None:
        # incident_id -> set of subscriber queues.
        self._subscribers: Dict[str, Set[asyncio.Queue]] = {}

    def _queues(self, incident_id: str) -> list:
        return list(self._subscribers.get(incident_id, ()))

    async def publish(self, incident_id: str, event: Dict[str, Any]) -> None:
        """Fan `event` out to every subscriber of `incident_id`.

        `incident_id` is injected into the event (when absent) so every frame
        self-identifies. Returns immediately when nobody is listening (events
        are fire-and-forget — a late subscriber joins mid-stream).
        """
        payload = dict(event)
        payload.setdefault("incident_id", incident_id)
        for queue in self._queues(incident_id):
            queue.put_nowait(payload)

    async def subscribe(self, incident_id: str) -> AsyncIterator[str]:
        """Yield SSE-framed events for `incident_id` until a terminal event.

        Emits a heartbeat comment whenever the stream idles for
        `HEARTBEAT_INTERVAL_SECONDS`. A terminal event is yielded, then the
        generator returns (closing the HTTP stream).
        """
        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers.setdefault(incident_id, set()).add(queue)
        try:
            while True:
                try:
                    event = await asyncio.wait_for(
                        queue.get(), timeout=HEARTBEAT_INTERVAL_SECONDS
                    )
                except asyncio.TimeoutError:
                    yield HEARTBEAT_COMMENT
                    continue
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("event") == TERMINAL_EVENT:
                    return
        finally:
            await self.unsubscribe(incident_id, queue)

    async def unsubscribe(
        self, incident_id: str, queue: Optional[asyncio.Queue] = None
    ) -> None:
        """Drop one subscriber (`queue`), or all of them when `queue` is None."""
        subscribers = self._subscribers.get(incident_id)
        if subscribers is None:
            return
        if queue is not None:
            subscribers.discard(queue)
        else:
            subscribers.clear()
        if not subscribers:
            self._subscribers.pop(incident_id, None)

    def subscriber_count(self, incident_id: str) -> int:
        """Number of live subscribers (used by tests / diagnostics)."""
        return len(self._subscribers.get(incident_id, ()))
