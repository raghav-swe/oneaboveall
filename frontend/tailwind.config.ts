import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        oaa: {
          bg: "#101010",
          panel: "#171717",
          raised: "#202020",
          line: "#303030",
          muted: "#8b8b8b",
          
          text: "#f1f1f1",
          cyan: "#d7d7d7",
          amber: "#f2b84b",
          green: "#7ed6a3",
          red: "#ff6b5f",
          violet: "#b7a3e8",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;