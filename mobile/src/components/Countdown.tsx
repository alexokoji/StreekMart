import React, { useEffect, useState } from "react";
import { Text } from "react-native";
import { useTheme } from "../state/ThemeContext";
import { type } from "../theme/tokens";

// Counts down to `targetMs`. Ticks every 1s. Designed to be inlined into
// section headers and product cards on the mobile flash sales rail.
export function Countdown({ targetMs, label, color }: { targetMs: number; label?: string; color?: string }) {
  const t = useTheme();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, []);
  const remaining = Math.max(0, targetMs - now);
  if (remaining === 0) {
    return <Text style={[type.small, { color: color ?? t.textMuted }]}>{label ?? "Ended"}</Text>;
  }
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);
  return (
    <Text style={[type.bodyStrong, { color: color ?? t.promo, fontFamily: "monospace" }]}>
      {label ? `${label} ` : ""}{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </Text>
  );
}

// End of the current UTC day in ms epoch.
export function endOfTodayMs(): number {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}