"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Telemetry } from "@/lib/types";

type MetricKey = "db" | "http" | "ram";
type Values = Record<MetricKey, number>;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const initialHistory = (value: number, spread: number) =>
  Array.from({ length: 18 }, (_, index) => clamp(value - ((17 - index) % 5) * spread * 0.22, 0, 100));

function Sparkline({ values, label, color }: { values: number[]; label: string; color: string }) {
  const points = values.length > 1
    ? values.map((value, index) => `${(index / (values.length - 1)) * 100},${94 - value * 0.74}`).join(" ")
    : "0,50 100,50";
  return (
    <svg className="telemetry-sparkline" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${label} recent streaming history`}>
      <path d="M0 94H100" className="telemetry-baseline" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function MetricCard({
  label, value, formatted, note, tone, history,
}: {
  label: string; value: number; formatted: string; note: string; tone: "danger" | "warn" | "normal"; history: number[];
}) {
  const color = tone === "danger" ? "var(--danger)" : tone === "warn" ? "var(--warn)" : "var(--accent)";
  return (
    <div className="telemetry-card">
      <div className="eyebrow">{label}</div>
      <div className="telemetry-card-value" style={{ color }}>{formatted}</div>
      <div className="telemetry-card-note">{note}</div>
      <div className="telemetry-chart-wrap">
        <Sparkline values={history} label={label} color={color} />
        <span className="telemetry-sweep" aria-hidden="true" />
      </div>
    </div>
  );
}

export default function LiveTelemetry({ telemetry }: { telemetry: Telemetry }) {
  const initial: Values = {
    db: telemetry.dbPool.used,
    http: telemetry.http504Pct,
    ram: telemetry.ramLoadPct,
  };
  const [values, setValues] = useState<Values>(initial);
  const [targets, setTargets] = useState<Values>(initial);
  const [history, setHistory] = useState<Record<MetricKey, number[]>>({
    db: initialHistory(initial.db, 2),
    http: initialHistory(initial.http, 4),
    ram: initialHistory(initial.ram, 2.2),
  });
  const [paused, setPaused] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [reducedMotion, setReducedMotion] = useState(false);
  const seed = useRef(0);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      seed.current += 1;
      const step = seed.current;
      // Smooth, deterministic signals: broad sine waves plus small repeating noise.
      const next: Values = {
        db: clamp(Math.round(96 + Math.sin(step * 0.83) * 3 + ((step * 7) % 3) - 1), 90, 99),
        http: clamp(Number((34.2 + Math.sin(step * 0.68) * 4 + ((step * 11) % 5) * 0.18).toFixed(1)), 25, 45),
        ram: clamp(Number((61.8 + Math.sin(step * 0.42) * 4 + ((step * 5) % 4) * 0.2).toFixed(1)), 52, 72),
      };
      setTargets(next);
      setHistory((previous) => ({
        db: [...previous.db.slice(-23), next.db],
        http: [...previous.http.slice(-23), next.http],
        ram: [...previous.ram.slice(-23), next.ram],
      }));
      setLastUpdated(new Date());
    }, 1400);
    return () => window.clearInterval(timer);
  }, [paused]);

  useEffect(() => {
    if (reducedMotion) {
      setValues(targets);
      return;
    }
    const from = values;
    const started = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - started) / 720);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValues({
        db: from.db + (targets.db - from.db) * eased,
        http: from.http + (targets.http - from.http) * eased,
        ram: from.ram + (targets.ram - from.ram) * eased,
      });
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
    // Values intentionally omitted: this animation should only restart for a new target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets, reducedMotion]);

  const requestHealth = useMemo(() => history.http.map((value, index) => clamp(100 - value * 1.6 + Math.sin(index) * 3, 10, 100)), [history.http]);
  const formatUpdated = lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="section-title">Live telemetry</h2><p className="section-sub">checkout-worker · production</p></div>
        <div className="telemetry-actions">
          <span className={`tag ${paused ? "tag-warn" : "tag-good"}`} aria-live="polite"><span className="pulse mr-1">●</span>{paused ? "PAUSED" : "LIVE"}</span>
          <button type="button" className="btn telemetry-pause" onClick={() => setPaused((current) => !current)} aria-label={paused ? "Resume live telemetry updates" : "Pause live telemetry updates"}>
            {paused ? "▶ Resume" : "Ⅱ Pause"}
          </button>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--muted)]">
        <span className="data">{paused ? "Mock stream paused" : "Mock stream · bounded values"}</span>
        <span className="data" aria-label={`Last telemetry update at ${formatUpdated}`}>Updated {formatUpdated}</span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <MetricCard label="DB pool" value={values.db} formatted={`${Math.round(values.db)}/100`} note={`${Math.round(values.db)} connections used`} tone="danger" history={history.db} />
        <MetricCard label="HTTP 504s" value={values.http} formatted={`${values.http.toFixed(1)}%`} note="rolling error rate" tone="warn" history={history.http} />
        <MetricCard label="RAM load" value={values.ram} formatted={`${values.ram.toFixed(1)}%`} note="within baseline" tone="normal" history={history.ram} />
      </div>
      <div className="mt-5 h-28 overflow-hidden rounded-lg bg-[var(--surface-2)] p-3">
        <div className="eyebrow">request health · live stream</div>
        <svg viewBox="0 0 700 75" preserveAspectRatio="none" className="mt-2 h-16 w-full" role="img" aria-label="Request health chart connected to live HTTP 504 telemetry">
          <polyline points={requestHealth.map((value, index) => `${(index / (requestHealth.length - 1)) * 700},${75 - value * 0.62}`).join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <path d="M0 65 L700 65" stroke="var(--line)" />
        </svg>
      </div>
      <p className="mt-4 data text-[var(--danger)]">✕ LIVE ERR: {telemetry.liveError}</p>
    </>
  );
}
