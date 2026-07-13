"use client";

// Cycles system → light → dark → system. Matches the 3-way preference
// mobile exposes via useThemePreference() in mobile/src/state/ThemeContext.
import { useThemePreference } from "@/state/ThemeContext";

const ICON: Record<string, string> = { system: "🖥️", light: "☀️", dark: "🌙" };
const NEXT: Record<string, "system" | "light" | "dark"> = {
  system: "light",
  light: "dark",
  dark: "system",
};

export function ThemeToggle() {
  const { preference, setPreference } = useThemePreference();
  return (
    <button
      type="button"
      onClick={() => setPreference(NEXT[preference])}
      aria-label={`Theme: ${preference}. Tap to change.`}
      title={`Theme: ${preference}`}
      className="rounded-lg p-2 text-ink-600 hover:bg-ink-50 hover:text-violet-700 dark:text-ink-300 dark:hover:bg-ink-700 dark:hover:text-violet-300"
    >
      <span aria-hidden>{ICON[preference]}</span>
    </button>
  );
}
