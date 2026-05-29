"use client";

// Segment-level error boundary. Catches errors inside a route segment
// without nuking RootLayout (so the nav + footer stay visible). Pairs with
// global-error.tsx, which handles errors in the root layout itself.

import { useEffect } from "react";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      void fetch("/api/log/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          where: "route-error",
          message: error.message,
          digest: error.digest,
          stack: error.stack?.slice(0, 4000),
          ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
          url: typeof location !== "undefined" ? location.href : "",
        }),
        keepalive: true,
      });
    } catch {
      /* ignore */
    }
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-12">
      <div className="card p-6">
        <h1 className="font-display text-xl font-bold">Something went wrong on this page</h1>
        <p className="mt-2 text-sm text-ink-600">
          We hit an unexpected error. The details below help us fix it.
        </p>
        <pre className="mt-4 whitespace-pre-wrap break-words rounded-lg bg-violet-50 p-3 text-xs text-violet-900">
{error.message}
{error.digest ? `\nDigest: ${error.digest}` : ""}
        </pre>
        <button type="button" onClick={reset} className="btn-primary mt-4 text-sm">
          Try again
        </button>
      </div>
    </div>
  );
}
