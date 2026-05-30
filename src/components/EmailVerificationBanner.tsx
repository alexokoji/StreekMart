"use client";

import { useState } from "react";

// Yellow banner shown across the top of the app for users who haven't
// verified their email yet. Mounts from the root layout (layout.tsx) and
// renders only when the layout decides it should — the component itself
// has no auth check.
//
// Click "Resend" → POST /api/auth/resend-verification → flip to a
// "sent" state. We don't close the banner permanently after resending
// because the user still hasn't verified yet; closing happens on the
// next page-load once `user.emailVerifiedAt` is set.
export function EmailVerificationBanner({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  async function resend() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      if (res.ok) {
        setStatus("sent");
      } else {
        const data = await res.json().catch(() => ({}));
        setErr(data.error ?? "Couldn't resend right now.");
        setStatus("error");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-amber-900">
      <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-2 text-sm">
        <p className="min-w-0">
          {status === "sent" ? (
            <>
              <strong>Email sent.</strong> Check{" "}
              <span className="font-mono text-xs">{email}</span> for the
              verification link.
            </>
          ) : (
            <>
              <strong>Verify your email.</strong> We sent a link to{" "}
              <span className="font-mono text-xs">{email}</span> — please
              click it so we can send you order updates and chat replies.
            </>
          )}
          {err && <span className="ml-2 text-burgundy-700">{err}</span>}
        </p>
        <button
          type="button"
          onClick={resend}
          disabled={busy || status === "sent"}
          className="rounded-full border border-amber-400 bg-white px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          {busy ? "Sending…" : status === "sent" ? "Sent ✓" : "Resend email"}
        </button>
      </div>
    </div>
  );
}
