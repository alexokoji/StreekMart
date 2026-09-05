"use client";

// Cycles system → light → dark → system. Matches the 3-way preference
// mobile exposes via useThemePreference() in mobile/src/state/ThemeContext.
// Uses line-art SVGs (not emoji) so it matches the rest of the nav's icon
// set and renders consistently across platforms/fonts.
import { useEffect, useState } from "react";
import { useThemePreference } from "@/state/ThemeContext";

const NEXT: Record<string, "system" | "light" | "dark"> = {
  system: "light",
  light: "dark",
  dark: "system",
};

export function ThemeToggle() {
  const { preference, setPreference } = useThemePreference();

  // The stored preference only exists in the browser, so the server always
  // renders the "system" state. Swapping the icon during the first client
  // render would be a hydration mismatch — and React responds by discarding
  // the whole server-rendered tree. Hold the neutral icon until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const shown = mounted ? preference : "system";

  return (
    <button
      type="button"
      onClick={() => setPreference(NEXT[preference])}
      aria-label={`Theme: ${shown}. Tap to change.`}
      title={`Theme: ${shown}`}
      className="rounded-lg p-2 text-ink-600 hover:bg-ink-50 hover:text-violet-700 dark:text-ink-300 dark:hover:bg-ink-700 dark:hover:text-violet-300"
    >
      {shown === "system" && <SystemIcon />}
      {shown === "light" && <SunIcon />}
      {shown === "dark" && <MoonIcon />}
    </button>
  );
}

function SystemIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.5M12 19v2.5M4.4 4.4l1.8 1.8M17.8 17.8l1.8 1.8M2.5 12H5M19 12h2.5M4.4 19.6l1.8-1.8M17.8 6.2l1.8-1.8" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 14.5A8.5 8.5 0 119.5 4a7 7 0 1010.5 10.5z" />
    </svg>
  );
}
