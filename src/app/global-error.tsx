"use client";

// Last-resort error boundary. Catches errors thrown by the root layout
// itself (RootLayout, providers, the very top of the React tree) — anything
// that would otherwise leave the user staring at a blank page.
//
// Why this file exists: iOS Safari hydration errors render nothing at all
// when there's no boundary, so the user just sees a white screen and we
// have no signal in our logs. Surfacing `error.message` + the digest gives
// us something to act on the next time someone reports "doesn't open".
//
// global-error.tsx must define its OWN <html>/<body> because it replaces
// RootLayout (which itself errored).

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Best-effort report to the server so we capture errors that only
    // happen on real devices we can't open Web Inspector on.
    try {
      void fetch("/api/log/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          where: "global-error",
          message: error.message,
          digest: error.digest,
          stack: error.stack?.slice(0, 4000),
          ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
          url: typeof location !== "undefined" ? location.href : "",
        }),
        keepalive: true,
      });
    } catch {
      /* ignore — we're already in the failure path */
    }
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "-apple-system, Segoe UI, Roboto, sans-serif", margin: 0, padding: "32px 20px", background: "#fbfafe", color: "#0a0a14" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", background: "#fff", border: "1px solid #e4e4e8", borderRadius: 16, padding: 28 }}>
          <h1 style={{ fontSize: 20, margin: 0, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: "#525258", marginTop: 0 }}>
            The page hit an unexpected error while loading. The details below help us fix it — please screenshot if you reach out to support.
          </p>
          <pre style={{ marginTop: 16, padding: 12, background: "#f5f3ff", borderRadius: 10, fontSize: 12, lineHeight: 1.5, color: "#3b0764", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
{error.message}
{error.digest ? `\nDigest: ${error.digest}` : ""}
          </pre>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 16, padding: "10px 18px", background: "#7c3aed", color: "#fff", border: 0, borderRadius: 10, fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
          <p style={{ marginTop: 16, fontSize: 12, color: "#737378" }}>
            <a href="/" style={{ color: "#7c3aed" }}>Reload home</a>
          </p>
        </div>
      </body>
    </html>
  );
}
