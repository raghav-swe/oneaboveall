"use client";

/**
 * OAA global context (CONTEXT.md §4.1 / §6, PROMPTS.md Phase 6).
 *
 * Owns the whole live surface of the control plane:
 *
 *   * the active incident id,
 *   * the latest per-node SSE event map (`node_events`),
 *   * the merged live `OAAState` snapshot assembled from those events,
 *   * the end-to-end SLA stopwatch (< 20.0 s target),
 *   * the incident-list + runtime-config caches,
 *   * the `useIncidentSSE` hook (native `EventSource` against the relative
 *     `/api/v1/incidents/{id}/stream` URL, so the Next.js `rewrites()` proxy
 *     carries the traffic — no CORS, no SSE buffering).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type {
  ApproveResponse,
  GlobalStatus,
  IncidentListResponse,
  IncidentRow,
  IngestResponse,
  LastHealthySummary,
  OAAStateSnapshot,
  RuntimeConfigModel,
  ScenarioKey,
  SSEEvent,
  SSENodeEvent,
  SSETerminalEvent,
} from "@/types/oaa";

/** End-to-end SLA target (CONTEXT.md §3, guardrail 3). */
export const SLA_TARGET_SECONDS = 20.0;

/** Reconnect backoff for the SSE stream (native EventSource auto-retry is
 *  deliberately re-implemented so a closed stream can be restarted cleanly). */
export const RECONNECT_BASE_DELAY_MS = 1200;
export const RECONNECT_MAX_DELAY_MS = 8000;

export type HitlDecisionPayload = "APPROVED" | "REJECTED";

export interface SlaState {
  /** Elapsed wall-clock seconds since ingestion (frozen once SLA is reached). */
  elapsed: number;
  /** True while the stopwatch is still counting. */
  running: boolean;
  /** True once the stopwatch froze (stabilization / interrupt / terminal). */
  frozen: boolean;
  /** True when the SLA target has been breached. */
  breached: boolean;
  /** Epoch ms of the ingestion moment (null when idle). */
  startedAt: number | null;
}

export interface UseIncidentSSEOptions {
  onEvent?: (event: SSEEvent) => void;
  onOpen?: () => void;
  onError?: () => void;
}

export interface UseIncidentSSEResult {
  connected: boolean;
}

/**
 * Subscribe to one incident's SSE stream.
 *
 * The native `EventSource` is pointed at the **relative** URL
 * `/api/v1/incidents/{id}/stream` so the request travels through the Next.js
 * `rewrites()` proxy to the FastAPI gateway. On a transport error the hook
 * reconnects with a bounded backoff; a terminal event closes the stream for
 * good (the backend also closes it server-side).
 */
export function useIncidentSSE(
  incidentId: string | null,
  options: UseIncidentSSEOptions = {},
): UseIncidentSSEResult {
  const handlersRef = useRef<UseIncidentSSEOptions>(options);
  handlersRef.current = options;

  const sourceRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedRef = useRef(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!incidentId) {
      setConnected(false);
      return;
    }

    closedRef.current = false;
    let attempt = 0;

    const clearTimer = () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const close = () => {
      closedRef.current = true;
      clearTimer();
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }
      setConnected(false);
    };

    const connect = () => {
      if (closedRef.current) return;
      const url = `/api/v1/incidents/${encodeURIComponent(incidentId)}/stream`;
      const source = new EventSource(url);
      sourceRef.current = source;

      source.onopen = () => {
        attempt = 0;
        setConnected(true);
        handlersRef.current.onOpen?.();
      };

      source.onmessage = (message: MessageEvent<string>) => {
        let payload: SSEEvent;
        try {
          payload = JSON.parse(message.data) as SSEEvent;
        } catch {
          return; // heartbeat comments and malformed frames are ignored
        }
        handlersRef.current.onEvent?.(payload);
        if (payload.event === "terminal") {
          close();
        }
      };

      source.onerror = () => {
        setConnected(false);
        handlersRef.current.onError?.();
        if (closedRef.current) return;
        source.close();
        attempt += 1;
        const delay = Math.min(RECONNECT_BASE_DELAY_MS * attempt, RECONNECT_MAX_DELAY_MS);
        clearTimer();
        timerRef.current = setTimeout(connect, delay);
      };
    };

    connect();
    return close;
  }, [incidentId]);

  return { connected };
}

export interface OAAContextValue {
  /** The incident currently streamed by the war room (null when idle). */
  activeIncidentId: string | null;
  setActiveIncidentId: (incidentId: string | null) => void;
  /** Latest SSE event per node id (1..10). */
  nodeEvents: Record<number, SSENodeEvent>;
  /** Merged live state snapshot assembled from the SSE events. */
  state: OAAStateSnapshot;
  /** Global status pill state. */
  status: GlobalStatus;
  /** True while the Tier 2 HITL gate is armed (Node 6 paused). */
  hitlPaused: boolean;
  /** SLA stopwatch. */
  sla: SlaState;
  /** Cached ticket list (`GET /api/v1/incidents`). */
  incidents: IncidentRow[];
  /** Digest of the last RESOLVED ticket (idle dashboard bento). */
  lastHealthySummary: LastHealthySummary | null;
  /** Runtime governance config (`GET /api/v1/config`). */
  config: RuntimeConfigModel | null;
  /** Live SSE connection state. */
  connected: boolean;
  /** Last transport/action error (surfaced in the top bar). */
  error: string | null;
  /** Chaos launcher → `POST /api/v1/incidents/ingest`. */
  ingest: (scenarioKey: ScenarioKey) => Promise<void>;
  /** HITL gate → `POST /api/v1/incidents/{id}/approve`. */
  approve: (
    incidentId: string,
    decision: HitlDecisionPayload,
  ) => Promise<boolean>;
  refreshIncidents: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  clearError: () => void;
}

const OAAContext = createContext<OAAContextValue | null>(null);

/**
 * Merge one incremental node update into the accumulated live state.
 * `debate_transcript` uses LangGraph's `operator.add` reducer, so the SSE
 * frames carry deltas that must be concatenated (not replaced).
 */
export function mergeState(
  previous: OAAStateSnapshot,
  update: Partial<OAAStateSnapshot> | undefined,
): OAAStateSnapshot {
  if (!update) return previous;
  const next: OAAStateSnapshot = { ...previous };
  for (const [key, value] of Object.entries(update)) {
    if (key === "debate_transcript") {
      const incoming = Array.isArray(value) ? value : [];
      const existing = Array.isArray(next.debate_transcript) ? next.debate_transcript : [];
      next.debate_transcript = [...existing, ...incoming];
    } else {
      (next as Record<string, unknown>)[key] = value;
    }
  }
  return next;
}

export function OAAProvider({ children }: { children: ReactNode }) {
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
  const [nodeEvents, setNodeEvents] = useState<Record<number, SSENodeEvent>>({});
  const [state, setState] = useState<OAAStateSnapshot>({});
  const [terminalStatus, setTerminalStatus] = useState<string | null>(null);
  const [hitlResolved, setHitlResolved] = useState(false);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [lastHealthySummary, setLastHealthySummary] = useState<LastHealthySummary | null>(
    null,
  );
  const [config, setConfig] = useState<RuntimeConfigModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slaStartedAt, setSlaStartedAt] = useState<number | null>(null);
  const [slaFrozenAt, setSlaFrozenAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  const refreshIncidents = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/incidents", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as IncidentListResponse;
      setIncidents(payload.incidents ?? []);
      setLastHealthySummary(payload.last_healthy_summary ?? null);
    } catch {
      /* the ledger cache is best-effort */
    }
  }, []);

  const refreshConfig = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/config", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as RuntimeConfigModel;
      setConfig(payload);
    } catch {
      /* config chips are best-effort */
    }
  }, []);

  const refreshIncidentsRef = useRef(refreshIncidents);
  refreshIncidentsRef.current = refreshIncidents;

  const handleEvent = useCallback((event: SSEEvent) => {
    if (event.event === "terminal") {
      const terminal = event as SSETerminalEvent;
      setTerminalStatus(terminal.status);
      setSlaFrozenAt((previous) => previous ?? Date.now());
      void refreshIncidentsRef.current();
      return;
    }
    if (event.event !== "node_update") return;

    const nodeEvent = event as SSENodeEvent;
    setNodeEvents((previous) => ({ ...previous, [nodeEvent.node_id]: nodeEvent }));
    setState((previous) => mergeState(previous, nodeEvent.state));

    // SLA stopwatch: starts on the first ingest frame, freezes at the HITL
    // interrupt or at live-service stabilization.
    setSlaStartedAt((previous) => previous ?? Date.now());
    if (nodeEvent.status === "PAUSED") {
      setSlaFrozenAt((previous) => previous ?? Date.now());
    }
    if (nodeEvent.state?.execution_status === "STABILIZED") {
      setSlaFrozenAt((previous) => previous ?? Date.now());
    }
  }, []);

  const { connected } = useIncidentSSE(activeIncidentId, { onEvent: handleEvent });

  // Ticking clock for the SLA stopwatch (100 ms resolution).
  useEffect(() => {
    if (slaStartedAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [slaStartedAt]);

  // Bootstrap the idle caches (ledger + governance chips).
  useEffect(() => {
    void refreshIncidents();
    void refreshConfig();
  }, [refreshIncidents, refreshConfig]);

  const ingest = useCallback(async (scenarioKey: ScenarioKey) => {
    setError(null);
    try {
      const response = await fetch("/api/v1/incidents/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_key: scenarioKey }),
      });
      if (!response.ok) {
        throw new Error(`ingest failed with HTTP ${response.status}`);
      }
      const payload = (await response.json()) as IngestResponse;

      setActiveIncidentId(payload.incident_id);
      setNodeEvents({});
      setState({});
      setTerminalStatus(null);
      setHitlResolved(false);
      setSlaStartedAt(Date.now());
      setSlaFrozenAt(null);
      setNow(Date.now());
      void refreshIncidentsRef.current();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  const approve = useCallback(
    async (incidentId: string, decision: HitlDecisionPayload): Promise<boolean> => {
      setError(null);
      try {
        const response = await fetch(`/api/v1/incidents/${encodeURIComponent(incidentId)}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        });
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(`approve failed with HTTP ${response.status}: ${detail}`);
        }
        const payload = (await response.json()) as ApproveResponse;
        setHitlResolved(true);
        void refreshIncidentsRef.current();
        return payload.status === "RESUMED";
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
        return false;
      }
    },
    [],
  );

  const sla = useMemo<SlaState>(() => {
    const elapsed =
      slaStartedAt === null ? 0 : ((slaFrozenAt ?? now) - slaStartedAt) / 1000;
    return {
      elapsed,
      running: slaStartedAt !== null && slaFrozenAt === null,
      frozen: slaFrozenAt !== null,
      breached: elapsed > SLA_TARGET_SECONDS,
      startedAt: slaStartedAt,
    };
  }, [slaStartedAt, slaFrozenAt, now]);

  const hitlPaused = nodeEvents[6]?.status === "PAUSED" && !hitlResolved;

  const status = useMemo<GlobalStatus>(() => {
    if (hitlPaused) return "TIER_2_PAUSED";
    if (activeIncidentId && !terminalStatus) return "INCIDENT_ACTIVE";
    return "HEALTHY";
  }, [activeIncidentId, hitlPaused, terminalStatus]);

  const value = useMemo<OAAContextValue>(
    () => ({
      activeIncidentId,
      setActiveIncidentId,
      nodeEvents,
      state,
      status,
      hitlPaused,
      sla,
      incidents,
      lastHealthySummary,
      config,
      connected,
      error,
      ingest,
      approve,
      refreshIncidents,
      refreshConfig,
      clearError: () => setError(null),
    }),
    [
      activeIncidentId,
      nodeEvents,
      state,
      status,
      hitlPaused,
      sla,
      incidents,
      lastHealthySummary,
      config,
      connected,
      error,
      ingest,
      approve,
      refreshIncidents,
      refreshConfig,
    ],
  );

  return <OAAContext.Provider value={value}>{children}</OAAContext.Provider>;
}

export function useOAA(): OAAContextValue {
  const context = useContext(OAAContext);
  if (!context) {
    throw new Error("useOAA() must be used inside <OAAProvider>.");
  }
  return context;
}
