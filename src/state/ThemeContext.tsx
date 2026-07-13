"use client";

// Web theme context — mirrors mobile/src/state/ThemeContext.tsx so the
// site and app share the same light/dark behavior: user picks one of
// system (default) / light / dark, persisted to localStorage, "system"
// follows prefers-color-scheme. Unlike mobile there's no blank-screen
// hydration gate — the inline script in layout.tsx sets the class on
// <html> before paint so there's no flash either way.

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ColorScheme = "light" | "dark";
const STORAGE_KEY = "streekmart:theme-preference";

type Ctx = {
  scheme: ColorScheme;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<Ctx | null>(null);

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function systemScheme(): ColorScheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference());
  const [system, setSystem] = useState<ColorScheme>(() => systemScheme());

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystem(mql.matches ? "dark" : "light");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const setPreference = (p: ThemePreference) => {
    setPreferenceState(p);
    window.localStorage.setItem(STORAGE_KEY, p);
  };

  const scheme = useMemo<ColorScheme>(
    () => (preference === "system" ? system : preference),
    [preference, system],
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", scheme === "dark");
  }, [scheme]);

  return (
    <ThemeContext.Provider value={{ scheme, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemePreference() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemePreference must be used inside ThemeProvider");
  return ctx;
}
