"use client";

import { useEffect, useState } from "react";

// Lightweight client countdown. Renders "HHh MMm SSs" until the target
// time; renders "Ended" past it. Updates every 1s. The "Flash sales"
// rail uses this with target=end-of-day so the user sees urgency on
// every visit without us needing a per-product saleEndsAt column.
//
// NB: helpers like end-of-day live in src/lib/time.ts so server
// components can import them. Importing plain functions from a
// "use client" module breaks SSR -- Next.js replaces them with a
// non-callable client reference proxy.
export function CountdownTimer({
  target,
  label,
}: {
  target: Date | string;
  label?: string;
}) {
  // `now` stays null until after mount. Seeding it with Date.now() during
  // render meant the server and the client produced different clock text,
  // which is a hydration mismatch — and React responds by throwing away the
  // whole server-rendered tree and re-rendering the page on the client.
  // Rendering a stable placeholder first costs one frame and keeps SSR intact.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, []);

  const targetMs = typeof target === "string" ? new Date(target).getTime() : target.getTime();

  if (now === null) {
    // Same markup shape as the live state so the swap doesn't shift layout.
    return (
      <span className="inline-flex items-baseline gap-1 font-mono text-sm font-semibold text-fuchsia-700">
        {label && <span className="text-xs font-normal text-ink-500">{label}</span>}
        <span>--:--:--</span>
      </span>
    );
  }

  const remaining = Math.max(0, targetMs - now);
  if (remaining === 0) {
    return <span className="text-xs font-medium text-ink-500">{label ?? "Ended"}</span>;
  }
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);
  return (
    <span className="inline-flex items-baseline gap-1 font-mono text-sm font-semibold text-fuchsia-700">
      {label && <span className="text-xs font-normal text-ink-500">{label}</span>}
      <span>{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>
    </span>
  );
}