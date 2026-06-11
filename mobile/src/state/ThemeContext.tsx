// Theme context — exposes the resolved Theme to every screen.
//
// User picks one of: system (default), light, dark. Persisted via
// AsyncStorage. "system" follows the OS via useColorScheme().

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkTheme, lightTheme, type Theme } from "../theme/tokens";

export type ThemePreference = "system" | "light" | "dark";
const STORAGE_KEY = "streekmart:theme-preference";

type Ctx = {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === "light" || stored === "dark" || stored === "system") {
          setPreferenceState(stored);
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  const setPreference = (p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  };

  const theme = useMemo(() => {
    const effective = preference === "system" ? system ?? "light" : preference;
    return effective === "dark" ? darkTheme : lightTheme;
  }, [preference, system]);

  // Don't render children until hydration — prevents a one-frame flash of
  // the wrong theme on cold start.
  if (!hydrated) return null;

  return (
    <ThemeContext.Provider value={{ theme, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx.theme;
}

export function useThemePreference() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemePreference must be used inside ThemeProvider");
  return { preference: ctx.preference, setPreference: ctx.setPreference };
}
