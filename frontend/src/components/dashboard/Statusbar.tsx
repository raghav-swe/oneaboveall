"use client";

import { useState } from "react";
import { liveIncident } from "@/lib/mockData";

const scenarios = [
  "Postgres lock (checkout-worker)",
  "Redis OOM (auth-cache)",
  "KeyError (payment-api)",
];

export default function StatusBar() {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const { incidentId, service, cause, slaElapsedSec, slaLimitSec } = liveIncident;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-oaa-line bg-oaa-panel p-3">
      <span className="rounded border border-oaa-amber/60 bg-oaa-amber/10 px-3 py-1.5 font-mono text-xs font-semibold text-oaa-amber">
        TIER 2 HITL PAUSED: {incidentId}
      </span>

      <div className="text-sm text-oaa-text">
        Service: <span className="font-mono font-semibold">{service}</span>{" "}
        <span className="text-oaa-muted">({cause})</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="rounded border border-oaa-cyan/40 bg-oaa-cyan/10 px-3 py-1.5 font-mono text-xs text-oaa-cyan">
          SLA Timer: {slaElapsedSec.toFixed(2).padStart(5, "0")}s / {slaLimitSec.toFixed(1)}s
        </span>

        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            aria-haspopup="listbox"
            aria-expanded={open}
            className="rounded-md bg-oaa-red px-4 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
          >
            Simulate Outage ▾
          </button>

          {open && (
            <ul
              role="listbox"
              className="absolute right-0 z-50 mt-2 w-64 rounded-md border border-oaa-line bg-oaa-panel py-1 font-mono text-xs shadow-lg"
            >
              {scenarios.map((s) => (
                <li key={s}>
                  <button
                    onClick={() => {
                      setPicked(s);
                      setOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-oaa-raised ${
                      picked === s ? "text-oaa-cyan" : "text-oaa-text"
                    }`}
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}