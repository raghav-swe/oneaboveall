"use client";

interface PostMortemModalProps {
  open: boolean;
  incidentId: string | null;
  markdown: string | null;
  onClose: () => void;
}

/** Renders a ticket's `final_report_md` (Morning Digest / HITL Audit / Dossier / Halt). */
export default function PostMortemModal({ open, incidentId, markdown, onClose }: PostMortemModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Post-mortem for ${incidentId ?? "ticket"}`}
      onClick={onClose}
    >
      <div
        className="panel flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] p-4">
          <div>
            <div className="eyebrow">post-mortem</div>
            <h2 className="section-title mt-1">{incidentId}</h2>
          </div>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          {markdown ? (
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[var(--muted)]">
              {markdown}
            </pre>
          ) : (
            <p className="text-sm text-[var(--muted)]">No report was written for this ticket.</p>
          )}
        </div>
      </div>
    </div>
  );
}
