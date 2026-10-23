import { History } from "lucide-react";

/**
 * Page 2 placeholder — the Blackbox Ledger + n8n-style DAG replay canvas
 * ships in Phase 7. The route exists now so the sidebar navigation never 404s.
 */
export default function HistoryPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-lg border border-oaa-border bg-oaa-panel p-8 text-center">
        <History className="mx-auto h-8 w-8 text-slate-600" />
        <h1 className="mt-4 text-lg font-semibold text-slate-200">
          Blackbox Ledger &amp; DAG Replay
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          The interactive ticket drawer, 10-node React Flow canvas and the
          4th-strike override console are being built in{" "}
          <span className="font-mono text-oaa-accent">Phase 7</span>.
        </p>
      </div>
    </div>
  );
}
