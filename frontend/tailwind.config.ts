import type { Config } from "tailwindcss";

/**
 * OAA dark-mode SRE theme — Tailwind v3.4 config-file style (locked decision:
 * do NOT migrate to v4 CSS-first).
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        oaa: {
          bg: "#070b14", // app background
          panel: "#090d16", // bento / panel background
          border: "#1b2437",
          amber: "#f59e0b", // Tier 2 HITL alert
          green: "#22c55e", // healthy / PASS badge
          red: "#ef4444", // halted / SLA breach
          accent: "#38bdf8", // active node highlight
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
