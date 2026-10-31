/**
 * API access with an offline fallback.
 *
 * Every call tries the real FastAPI gateway first. If the gateway is missing —
 * the Vercel build, a cold laptop, a judge clicking before `uvicorn` starts —
 * the request resolves to the static demo snapshot instead of an empty screen.
 *
 * `live` tells the caller which happened, so the UI can degrade quietly rather
 * than showing broken states.
 */

import {
  DEMO_CONFIG,
  DEMO_INCIDENTS,
  DEMO_LAST_HEALTHY,
  DEMO_SNAPSHOTS,
} from "./demoData";
import type { IncidentListResponse, RuntimeConfigModel } from "@/types/oaa";

export interface ApiResult<T> {
  data: T;
  live: boolean;
}

async function request<T>(
  path: string,
  init: RequestInit | undefined,
  fallback: T,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, init);
    if (!response.ok) return { data: fallback, live: false };
    return { data: (await response.json()) as T, live: true };
  } catch {
    return { data: fallback, live: false };
  }
}

export function apiGet<T>(path: string, fallback: T): Promise<ApiResult<T>> {
  return request(path, { cache: "no-store" }, fallback);
}

export function apiPost<T>(path: string, body: unknown, fallback: T): Promise<ApiResult<T>> {
  return request(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    fallback,
  );
}

export function apiPut<T>(path: string, body: unknown, fallback: T): Promise<ApiResult<T>> {
  return request(
    path,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    fallback,
  );
}

// --- demo snapshot accessors ------------------------------------------------

export function demoIncidentList(): IncidentListResponse {
  return { incidents: DEMO_INCIDENTS, last_healthy_summary: DEMO_LAST_HEALTHY };
}

export function demoConfig(): RuntimeConfigModel {
  return DEMO_CONFIG;
}

export function demoSnapshots(incidentId: string) {
  return DEMO_SNAPSHOTS[incidentId] ?? [];
}
