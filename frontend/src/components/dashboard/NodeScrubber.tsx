
import React from "react";
import Link from "next/link";
import { liveIncident } from "@/lib/mockData";

export default function NodeScrubber() {
  const { nodes, blast } = liveIncident;

  const getNodeStyle = (state: string) => {
    switch (state) {
      case "done":
        return "border-oaa-green/50 bg-oaa-green/10 text-oaa-green";
      case "paused":
        return "border-oaa-amber/50 bg-oaa-amber/10 text-oaa-amber";
      case "failed":
        return "border-oaa-red/50 bg-oaa-red/10 text-oaa-red";
      case "active":
        return "border-oaa-cyan/50 bg-oaa-cyan/10 text-oaa-cyan";
      case "pending":
      default:
        return "border-oaa-line bg-oaa-raised text-oaa-muted";
    }
  };

  return (
    <div className="w-full rounded-lg border border-oaa-line bg-oaa-panel p-3 font-sans">
      <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap py-1">
        <span className="font-mono text-[10px] uppercase text-oaa-muted shrink-0">
          NODE 10 SCRUBBER:
        </span>

        <div className="flex items-center gap-2">
          {nodes.map((node, idx) => {
            let labelText = `${node.id}.${node.label}`;
            if (node.id === 2) {
              labelText = `2/3.${node.label}`;
            } else if (node.id === 5) {
              labelText = `5.${node.label}(${blast.score})`;
            }

            const stateText = node.state;
            const isDone = stateText === "done";
            const isFailed = stateText === "failed";

            const nodeBox = (
              <div
                key={node.id}
                title={`${node.label}: ${stateText}`}
                className={`inline-flex items-center gap-1.5 font-mono text-xs rounded border px-3 py-2 transition ${getNodeStyle(
                  stateText
                )}`}
              >
                <span>{labelText}</span>
                {isDone && <span>✓</span>}
                {isFailed && <span>✕</span>}
              </div>
            );

            const items = [<React.Fragment key={node.id}>{nodeBox}</React.Fragment>];

            if (node.id === 5) {
              items.push(
                <span key="arrow-hitl" className="text-oaa-muted text-xs">
                  →
                </span>,
                <Link
                  key="tier2-hitl"
                  href="/history"
                  title="Open replay in /history"
                  className="inline-flex items-center font-mono text-xs rounded border border-oaa-amber bg-oaa-amber/10 text-oaa-amber px-3 py-2 font-bold hover:bg-oaa-amber/20 transition focus:outline-none focus:ring-2 focus:ring-oaa-amber"
                >
                  Tier 2 HITL ⏸
                </Link>
              );
            }

            if (idx < nodes.length - 1) {
              items.push(
                <span key={`arrow-${node.id}`} className="text-oaa-muted text-xs">
                  →
                </span>
              );
            }

            return items;
          })}
        </div>
      </div>
    </div>
  );
}