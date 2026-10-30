"use client";

import { useState } from "react";
import { useTheme } from "./ThemeProvider";

const palettes = [
  { id: "warm", label: "Warm", color: "#e57552" },
  { id: "lavender", label: "Lavender", color: "#8d7bd1" },
  { id: "mint", label: "Mint", color: "#3d9d87" },
] as const;

export default function AppearanceControl({ compact = false }: { compact?: boolean }) {
  const { theme, palette, setTheme, setPalette } = useTheme();
  const [open, setOpen] = useState(false);
  const modeLabel = theme === "light" ? "Light mode" : "Dark mode";

  return (
    <div className={`appearance-control ${compact ? "appearance-compact" : ""}`}>
      <button
        type="button"
        className="appearance-trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Appearance settings. Currently ${modeLabel}, ${palette} palette`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="appearance-trigger-icon" aria-hidden="true">{theme === "light" ? "☼" : "☾"}</span>
        <span className="appearance-trigger-copy">
          <strong>{modeLabel}</strong>
          <small>{palette[0].toUpperCase() + palette.slice(1)} palette</small>
        </span>
        <span className="appearance-chevron" aria-hidden="true">{open ? "⌃" : "⌄"}</span>
      </button>
      {open && (
        <div className="appearance-popover" role="dialog" aria-label="Appearance settings">
          <div className="appearance-popover-heading">
            <span>Appearance</span>
            <button type="button" className="appearance-close" onClick={() => setOpen(false)} aria-label="Close appearance settings">×</button>
          </div>
          <button
            type="button"
            className="mode-choice"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            <span aria-hidden="true">{theme === "light" ? "☼" : "☾"}</span>
            <span><b>{modeLabel}</b><small>Switch to {theme === "light" ? "dark" : "light"} mode</small></span>
            <span className="mode-choice-check" aria-hidden="true">✓</span>
          </button>
          <div className="palette-label">Color palette</div>
          <div className="palette-options">
            {palettes.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`palette-option ${palette === item.id ? "selected" : ""}`}
                onClick={() => setPalette(item.id)}
                aria-label={`Use ${item.label} palette`}
                aria-pressed={palette === item.id}
              >
                <i style={{ background: item.color }} aria-hidden="true" />
                <span>{item.label}</span>
                {palette === item.id && <b aria-hidden="true">✓</b>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
