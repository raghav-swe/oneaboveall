"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
type Palette = "warm" | "lavender" | "mint";
type ThemeContextValue = { theme: Theme; palette: Palette; setTheme: (v: Theme) => void; setPalette: (v: Palette) => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [palette, setPalette] = useState<Palette>("warm");
  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem("oaa-theme");
      const savedPalette = window.localStorage.getItem("oaa-palette");
      if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
      if (savedPalette === "warm" || savedPalette === "lavender" || savedPalette === "mint") setPalette(savedPalette);
    } catch {
      // Storage can be unavailable in private browsing or locked-down web views.
    }
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.palette = palette;
    try {
      window.localStorage.setItem("oaa-theme", theme);
      window.localStorage.setItem("oaa-palette", palette);
    } catch {
      // Theme still applies for this session when persistence is unavailable.
    }
  }, [theme, palette]);
  return <ThemeContext.Provider value={{ theme, palette, setTheme, setPalette }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
