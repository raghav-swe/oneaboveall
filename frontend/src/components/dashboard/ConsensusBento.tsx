
"use client";

import React from "react";
import { liveIncident } from "@/lib/mockData";

export default function ConsensusBento() {
  const getBorderColor = (vendor: string) => {
    if (vendor.includes("Llama")) return "border-oaa-red/50";
    if (vendor.includes("GPT")) return "border-oaa-cyan/50";
    if (vendor.includes("Gemini")) return "border-oaa-amber/50";
    return "border-oaa-line";
  };

  return (
    <div className="rounded-lg border border-oaa-cyan/50 bg-oaa-panel p-4 flex flex-col justify-between h-full font-sans">
      {/* Header row */}
      <div className="flex items-center justify-between pb-3 border-b border-oaa-line flex-wrap gap-2">
        <h2 className="text-[11px] font-mono text-oaa-muted uppercase tracking-wider">
          BENTO 2 // ACTIVE WORKING NODE & TRI-VENDOR CONSENSUS
        </h2>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-oaa-raised border border-oaa-line text-oaa-amber">
          Node 6 → Waiting at Tier 2 Gate
        </span>
      </div>

      {/* 3 cards side by side */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4">
        {liveIncident.verdicts.map((v, idx) => (
          <div
            key={idx}
            className={`rounded bg-oaa-raised border ${getBorderColor(
              v.vendor
            )} p-3 flex flex-col justify-between`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono font-bold text-xs text-oaa-text">
                  {v.vendor}
                </span>
                <span className="text-[10px] font-mono text-oaa-muted">
                  ({v.role})
                </span>
              </div>
              <p className="text-xs font-sans text-oaa-text leading-relaxed">
                &ldquo;{v.text}&rdquo;
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}