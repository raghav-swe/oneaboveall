"use client";

import React from "react";

interface ReplayControlsProps {
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
}

export default function ReplayControls({
  playing,
  onPlay,
  onPause,
  onStep,
}: ReplayControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-oaa-line bg-oaa-panel p-2 font-sans">
      <button
        type="button"
        onClick={onPlay}
        disabled={playing}
        className={`font-mono text-xs font-bold rounded-md px-3 py-2 bg-oaa-green text-oaa-bg transition-colors ${
          playing ? "opacity-40 cursor-not-allowed" : "hover:opacity-90"
        }`}
      >
        ▶ PLAY DAG
      </button>

      <button
        type="button"
        onClick={onPause}
        disabled={!playing}
        className={`font-mono text-xs font-bold rounded-md px-3 py-2 border border-oaa-line bg-oaa-raised text-oaa-text transition-colors ${
          !playing ? "opacity-40 cursor-not-allowed" : "hover:bg-oaa-line/50"
        }`}
      >
        ⏸ PAUSE
      </button>

      <button
        type="button"
        onClick={onStep}
        className="font-mono text-xs font-bold rounded-md px-3 py-2 border border-oaa-line bg-oaa-raised text-oaa-text hover:bg-oaa-line/50 transition-colors"
      >
        ⏮ STEP
      </button>

      <span className="ml-auto font-mono text-xs text-oaa-muted">
        n8n-Style Live Node Inspector
      </span>
    </div>
  );
}