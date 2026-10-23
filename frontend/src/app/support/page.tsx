import { LifeBuoy } from "lucide-react";

/**
 * Page 4 placeholder — the one-click self-healing cards, operational FAQ
 * accordion and the platform escalation card ship in Phase 8.
 */
export default function SupportPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-lg border border-oaa-border bg-oaa-panel p-8 text-center">
        <LifeBuoy className="mx-auto h-8 w-8 text-slate-600" />
        <h1 className="mt-4 text-lg font-semibold text-slate-200">
          Self-Healing &amp; Support
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          The four one-click quick fixes, the operational FAQ accordion and the
          diagnostic bundle mailer are being built in{" "}
          <span className="font-mono text-oaa-accent">Phase 8</span>.
        </p>
      </div>
    </div>
  );
}
