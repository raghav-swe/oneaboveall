import { SlidersHorizontal } from "lucide-react";

/**
 * Page 3 placeholder — the governance console (blast-threshold slider, hard
 * invariant locks, circuit-breaker policy and the FastMCP tool permission
 * matrix) ships in Phase 8.
 */
export default function ConfigPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-lg border border-oaa-border bg-oaa-panel p-8 text-center">
        <SlidersHorizontal className="mx-auto h-8 w-8 text-slate-600" />
        <h1 className="mt-4 text-lg font-semibold text-slate-200">
          Control Plane Governance
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          The autonomous-authority slider, hard invariant locks and the FastMCP
          permission matrix are being built in{" "}
          <span className="font-mono text-oaa-accent">Phase 8</span>.
        </p>
      </div>
    </div>
  );
}
