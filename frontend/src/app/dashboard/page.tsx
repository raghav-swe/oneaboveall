"use client";

/**
 * Page 1 — The Bento Grid War Room (CONTEXT.md §4.1).
 *
 * Five bentos: live telemetry, the active node & debate, the Tier 2 HITL
 * gate, the blast-radius gauge & PR queue, and the full-width timeline
 * scrubber.
 */

import ActiveNodeDebateBento from "@/components/war-room/ActiveNodeDebateBento";
import BlastRadiusBento from "@/components/war-room/BlastRadiusBento";
import BottomScrubberBento from "@/components/war-room/BottomScrubberBento";
import HITLApprovalBento from "@/components/war-room/HITLApprovalBento";
import TelemetryBento from "@/components/war-room/TelemetryBento";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4 p-4 lg:p-5">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <TelemetryBento />
        </div>
        <div className="xl:col-span-4">
          <ActiveNodeDebateBento />
        </div>
        <div className="xl:col-span-3">
          <HITLApprovalBento />
        </div>
      </div>

      <BlastRadiusBento />

      <BottomScrubberBento />
    </div>
  );
}
