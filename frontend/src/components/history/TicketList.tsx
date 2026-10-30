
"use client";

import React from "react";
import { tickets, totalTickets } from "@/lib/mockData";

interface TicketListProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function TicketList({ selectedId, onSelect }: TicketListProps) {


  const getBadgeStyle = (badge: string) => {
    switch (badge) {
      case "3/3 STRIKES":
        return "text-oaa-red bg-oaa-red/10 border-oaa-red/40";
      case "TIER 2 HITL":
        return "text-oaa-amber bg-oaa-amber/10 border-oaa-amber/40";
      case "TIER 1 AUTO":
        return "text-oaa-green bg-oaa-green/10 border-oaa-green/40";
      default:
        return "text-oaa-muted bg-oaa-raised border-oaa-line";
    }
  };

  const NoteStyle = (badge: string) => {
    switch (badge) {
      case "3/3 STRIKES":
        return "text-oaa-red/80";
      case "TIER 2 HITL":
        return "text-oaa-amber/80";
      case "TIER 1 AUTO":
        return "text-oaa-green/80";
      default:
        return "text-oaa-muted";
    }
  };

  const getSelectedBorderStyle = (badge: string) => {
    switch (badge) {
      case "3/3 STRIKES":
        return "border-oaa-red";
      case "TIER 2 HITL":
        return "border-oaa-amber";
      case "TIER 1 AUTO":
        return "border-oaa-green";
      default:
        return "border-oaa-cyan";
    }
  };

  return (
    <section className="rounded-lg border border-oaa-line bg-oaa-panel p-4 space-y-3 font-sans">
      {/* Header row */}
      <div className="flex items-center justify-between pb-2 border-b border-oaa-line">
        <h2 className="font-mono text-[11px] uppercase text-oaa-muted">
          FLIGHT BLACKBOX TICKETS
        </h2>
        <span className="font-mono text-xs text-oaa-cyan">
          {totalTickets} TOTAL
        </span>
      </div>

      {/* Ticket List */}
      <div className="space-y-2">
        {tickets.map((ticket) => {
          const isSelected = ticket.id === selectedId;
          const borderClass = isSelected
            ? getSelectedBorderStyle(ticket.badge)
            : "border-oaa-line";

          return (
            <button
              key={ticket.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(ticket.id)}
              className={`w-full text-left rounded-md border p-3 bg-oaa-raised transition-colors space-y-1 ${borderClass}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-oaa-text">
                  {ticket.id}
                </span>
                <span
                  className={`font-mono text-[10px] rounded border px-1.5 py-0.5 ${getBadgeStyle(
                    ticket.badge
                  )}`}
                >
                  {ticket.badge}
                </span>
              </div>
              <div className="text-xs text-oaa-muted">
                {ticket.service} • {ticket.title}
              </div>
              <div className={`text-xs ${NoteStyle(ticket.badge)}`}>
                {ticket.note}
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom Button */}
      <button
        type="button"
        className="w-full text-center rounded-md border border-oaa-line bg-oaa-raised p-2.5 font-mono text-xs text-oaa-cyan hover:bg-oaa-line/50 transition-colors"
      >
        Open Post-Mortem Markdown
      </button>
    </section>
  );
}