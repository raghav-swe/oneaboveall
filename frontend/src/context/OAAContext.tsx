"use client";

/**
 * OAA global context.
 *
 * Owns the live surface of the control plane:
 *   * the active incident id,
 *   * the latest per-node SSE event map,
 *   * the merged live `OAAState` snapshot,
 *   * the end-to-end SLA stopwatch,
 *   * the incident-list + runtime-config caches.
 *
 * It has two modes:
 *   * **live** — native `EventSource` against `/api/v1/incidents/{id}/stream`
 *     through the Next.js rewrite proxy (localhost / any real backend).
 *   * **demo** — the gateway is unreachable (e.g. the Vercel build), so the
 *     chaos launcher replays a scripted node timeline from `demoData.ts`.
 *     Visually identical, so the deployed demo never shows a dead screen.
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

import { apiGet, apiPost, demoConfig, demoIncidentList } from "@/lib/api";
import { DEMO_RUNS } from "@/lib/demoData";
import type {
  ApproveResponse,
  GlobalStatus,
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

export const SLA_TARGET_SECONDS = 20.0;
export const RECONNECT_BASE_DELAY_MS = 1200;
export const RECONNECT_MAX_DELAY_MS = 8000;

export type HitlDecisionPayload = "APPROVED" | "REJECTED";

export interface SlaState {
  elapsed: number;
  running: boolean;
  frozen: boolean;
  breached: boolean;
  startedAt: number | null;
}

export interface UseIncidentSSEOptions {
  onEvent?: (event: SSEEvent) => void;
  onOpen?: () => void;
  onError?: () => void;
  enabled?: boolean;
}

export interface UseIncidentSSEResult {
  connected: boolean;
}

/**
 * Subscribe to one incident's SSE stream (relative URL → Next.js rewrite → FastAPI).
 * Reconnects with bounded backoff; a terminal event closes the stream for good.
 */
export function useIncidentSSE(
  incidentId: string | null,
  options: UseIncidentSSEOptions = {},
): UseIncidentSSEResult {
  const { enabled = true } = options;
  const handlersRef = useRef<UseIncidentSSEOptions>(options);
  handlersRef.current = options;

  const sourceRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedRef = useRef(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!incidentId || !enabled) {
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
          return;
        }
        handlersRef.current.onEvent?.(payload);
        if (payload.event === "terminal") close();
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
  }, [incidentId, enabled]);

  return { connected };
}

export interface OAAContextValue {
  activeIncidentId: string | null;
  setActiveIncidentId: (incidentId: string | null) => void;
  nodeEvents: Record<number, SSENodeEvent>;
  state: OAAStateSnapshot;
  status: GlobalStatus;
  hitlPaused: boolean;
  sla: SlaState;
  incidents: IncidentRow[];
  lastHealthySummary: LastHealthySummary | null;
  config: RuntimeConfigModel | null;
  connected: boolean;
  /** True when the gateway is unreachable and the UI is replaying fixtures. */
  demoMode: boolean;
  error: string | null;
  ingest: (scenarioKey: ScenarioKey) => Promise<void>;
  approve: (incidentId: string, decision: HitlDecisionPayload) => Promise<boolean>;
  refreshIncidents: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  clearError: () => void;
}

const OAAContext = createContext<OAAContextValue | null>(null);

/** Merge one incremental node update. `debate_transcript` uses an add-reducer. */
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
  const [lastHealthySummary, setLastHealthySummary] = useState<LastHealthySummary | null>(null);
  const [config, setConfig] = useState<RuntimeConfigModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [slaStartedAt, setSlaStartedAt] = useState<number | null>(null);
  const [slaFrozenAt, setSlaFrozenAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  const demoTimers = useRef<number[]>([]);
  const demoRunRef = useRef<ScenarioKey | null>(null);
  const demoCountRef = useRef(0);

  const clearDemoTimers = useCallback(() => {
    demoTimers.current.forEach((t) => window.clearTimeout(t));
    demoTimers.current = [];
  }, []);

  const refreshIncidents = useCallback(async () => {
    const { data, live } = await apiGet("/api/v1/incidents", demoIncidentList());
    setIncidents(data.incidents ?? []);
    setLastHealthySummary(data.last_healthy_summary ?? null);
    if (!live) setDemoMode(true);
  }, []);

  const refreshConfig = useCallback(async () => {
    const { data, live } = await apiGet("/api/v1/config", demoConfig());
    setConfig(data);
    if (!live) setDemoMode(true);
  }, []);

  const refreshIncidentsRef = useRef(refreshIncidents);
  refreshIncidentsRef.current = refreshIncidents;

  const activeIncidentRef = useRef<string | null>(null);
  activeIncidentRef.current = activeIncidentId;

  /**
   * Backfill node states from the ledger once a run ends.
   *
   * SSE is fire-and-forget: a subscriber that attaches a beat late (fresh tab,
   * slow hydration) misses the first frames. On the terminal event we reconcile
   * against the recorded snapshot chain so the scrubber is always complete.
   */
  const reconcileFromSnapshots = useCallback(async (incidentId: string) => {
    const { data, live } = await apiGet<{ snapshots: { node_id: number; status: string }[] }>(
      `/api/v1/incidents/${encodeURIComponent(incidentId)}/snapshots`,
      { snapshots: [] },
    );
    if (!live || !data.snapshots?.length) return;
    setNodeEvents((previous) => {
      const next = { ...previous };
      for (const row of data.snapshots) {
        next[row.node_id] = {
          event: "node_update",
          node_id: row.node_id,
          status: row.status === "HALTED" ? "HALTED" : "COMPLETED",
          state: {},
        };
      }
      return next;
    });
  }, []);

  const reconcileFromSnapshotsRef = useRef(reconcileFromSnapshots);
  reconcileFromSnapshotsRef.current = reconcileFromSnapshots;

  const handleEvent = useCallback((event: SSEEvent) => {
    if (event.event === "terminal") {
      const terminal = event as SSETerminalEvent;
      setTerminalStatus(terminal.status);
      setSlaFrozenAt((previous) => previous ?? Date.now());
      void refreshIncidentsRef.current();
      const incidentId = activeIncidentRef.current;
      if (incidentId) void reconcileFromSnapshotsRef.current(incidentId);
      return;
    }
    if (event.event !== "node_update") return;

    const nodeEvent = event as SSENodeEvent;
    setNodeEvents((previous) => ({ ...previous, [nodeEvent.node_id]: nodeEvent }));
    setState((previous) => mergeState(previous, nodeEvent.state));

    setSlaStartedAt((previous) => previous ?? Date.now());
    if (nodeEvent.status === "PAUSED") {
      setSlaFrozenAt((previous) => previous ?? Date.now());
    }
    if (nodeEvent.state?.execution_status === "STABILIZED") {
      setSlaFrozenAt((previous) => previous ?? Date.now());
    }
  }, []);

  const handleEventRef = useRef(handleEvent);
  handleEventRef.current = handleEvent;

  // ---- demo replay --------------------------------------------------------
  const scheduleSteps = useCallback(
    (
      steps: (typeof DEMO_RUNS)[ScenarioKey]["before_pause"],
      startAt: number,
      onDone?: () => void,
    ): number => {
      let cursor = startAt;
      steps.forEach((step) => {
        cursor += step.delay_ms;
        demoTimers.current.push(
          window.setTimeout(() => {
            handleEventRef.current({
              event: "node_update",
              node_id: step.node_id,
              status: step.status,
              state: step.state,
            } as SSENodeEvent);
          }, cursor),
        );
      });
      if (onDone) demoTimers.current.push(window.setTimeout(onDone, cursor + 200));
      return cursor;
    },
    [],
  );

  const finishDemo = useCallback((key: ScenarioKey) => {
    const run = DEMO_RUNS[key];
    setTerminalStatus(run.final_status);
    setSlaFrozenAt((previous) => previous ?? Date.now());
  }, []);

  const startDemoRun = useCallback(
    (key: ScenarioKey) => {
      clearDemoTimers();
      demoRunRef.current = key;
      demoCountRef.current += 1;
      const incidentId = `INC-${4820 + demoCountRef.current}`;
      const run = DEMO_RUNS[key];

      setDemoMode(true);
      setActiveIncidentId(incidentId);
      setNodeEvents({});
      setState({});
      setTerminalStatus(null);
      setHitlResolved(false);
      setSlaStartedAt(Date.now());
      setSlaFrozenAt(null);
      setNow(Date.now());
      setError(null);

      const pausesAtGate = run.before_pause.some((step) => step.status === "PAUSED");
      const elapsed = scheduleSteps(run.before_pause, 0, pausesAtGate ? undefined : () => {
        scheduleSteps(run.after_pause, 0, () => finishDemo(key));
      });

      // Record the ticket in the drawer once the run begins.
      const service = String(
        (run.before_pause.find((s) => s.state?.service)?.state.service as string) ?? "service",
      );
      setTimeout(() => {
        setIncidents((previous) => [
          {
            incident_id: incidentId,
            service,
            alert_name: "Simulated",
            status: pausesAtGate ? "PAUSED_HITL" : "RUNNING",
            selected_tier: run.tier as IncidentRow["selected_tier"],
            blast_radius_score: run.blast,
            is_code_bug: key === "SCENARIO_3_CODE_BUG" ? 1 : 0,
            strike_count: 0,
            max_strikes_override: 3,
            created_at: new Date().toISOString(),
            final_report_md: null,
          },
          ...previous.filter((i) => i.incident_id !== incidentId),
        ]);
      }, Math.min(elapsed, 400));
    },
    [clearDemoTimers, finishDemo, scheduleSteps],
  );

  const resumeDemo = useCallback(
    (decision: HitlDecisionPayload) => {
      const key = demoRunRef.current;
      if (!key) return;
      setHitlResolved(true);
      if (decision === "REJECTED") {
        // Rejection routes straight to reporting, skipping execution.
        handleEventRef.current({
          event: "node_update",
          node_id: 6,
          status: "COMPLETED",
          state: { sandbox_result: {}, hitl_decision: "REJECTED" },
        } as SSENodeEvent);
        scheduleSteps(
          DEMO_RUNS[key].after_pause.filter((s) => s.node_id === 9 || s.node_id === 10),
          0,
          () => finishDemo(key),
        );
        return;
      }
      scheduleSteps(DEMO_RUNS[key].after_pause, 0, () => finishDemo(key));
    },
    [finishDemo, scheduleSteps],
  );

  // ---- SSE (live mode only) ----------------------------------------------
  const { connected } = useIncidentSSE(activeIncidentId, {
    onEvent: handleEvent,
    enabled: !demoMode,
  });

  useEffect(() => {
    if (slaStartedAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [slaStartedAt]);

  useEffect(() => {
    void refreshIncidents();
    void refreshConfig();
  }, [refreshIncidents, refreshConfig]);

  useEffect(() => clearDemoTimers, [clearDemoTimers]);

  const ingest = useCallback(
    async (scenarioKey: ScenarioKey) => {
      setError(null);
      try {
        const response = await fetch("/api/v1/incidents/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario_key: scenarioKey }),
        });
        if (!response.ok) throw new Error(`ingest failed with HTTP ${response.status}`);
        const payload = (await response.json()) as IngestResponse;

        setDemoMode(false);
        setActiveIncidentId(payload.incident_id);
        setNodeEvents({});
        setState({});
        setTerminalStatus(null);
        setHitlResolved(false);
        setSlaStartedAt(Date.now());
        setSlaFrozenAt(null);
        setNow(Date.now());
        void refreshIncidentsRef.current();
      } catch {
        startDemoRun(scenarioKey);
      }
    },
    [startDemoRun],
  );

  const approve = useCallback(
    async (incidentId: string, decision: HitlDecisionPayload): Promise<boolean> => {
      setError(null);
      if (demoMode) {
        resumeDemo(decision);
        return true;
      }
      try {
        const { data, live } = await apiPost<ApproveResponse>(
          `/api/v1/incidents/${encodeURIComponent(incidentId)}/approve`,
          { decision },
          { incident_id: incidentId, status: "RESUMED" },
        );
        if (!live) {
          resumeDemo(decision);
          return true;
        }
        setHitlResolved(true);
        void refreshIncidentsRef.current();
        return data.status === "RESUMED";
      } catch {
        setError("approve failed");
        return false;
      }
    },
    [demoMode, resumeDemo],
  );

  const sla = useMemo<SlaState>(() => {
    const elapsed = slaStartedAt === null ? 0 : ((slaFrozenAt ?? now) - slaStartedAt) / 1000;
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
      demoMode,
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
      demoMode,
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
  if (!context) throw new Error("useOAA() must be used inside <OAAProvider>.");
  return context;
}
