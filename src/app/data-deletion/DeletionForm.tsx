"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Self-serve account deletion form. Three layers of friction to make a
// misclick impossible:
//   1. The user must retype their email (compared case-insensitively).
//   2. A confirm-checkbox acknowledges the action is permanent.
//   3. A native `confirm()` dialog right before the POST fires.
//
// On success we redirect to `/`. The endpoint clears the session cookie
// so the next request renders as signed-out.
export function DeletionForm({ expectedEmail }: { expectedEmail: string }) {
  const router = useRouter();
  const [confirmEmail, setConfirmEmail] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const emailMatches =
    confirmEmail.trim().toLowerCase() === expectedEmail.trim().toLowerCase();
  const canSubmit = emailMatches && ack && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (
      !window.confirm(
        "Delete your StreekMart account and all associated data?\n\nThis can't be undone.",
      )
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/account/deletion-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Deletion failed.");
        return;
      }
      // Hard reload so server components re-fetch the session and the
      // top nav drops the signed-in chrome.
      window.location.href = "/?deleted=1";
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Type your email to confirm</label>
        <input
          type="email"
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          className="input"
          placeholder={expectedEmail}
          autoComplete="off"
          required
        />
        {confirmEmail.length > 0 && !emailMatches && (
          <p className="mt-1 text-xs text-amber-700">
            Doesn&rsquo;t match. The form unlocks when both fields are
            identical.
          </p>
        )}
      </div>

      <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-ink-200 p-3 text-sm">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          I understand this is permanent. I&rsquo;ve withdrawn any wallet
          balance and exported anything I wanted to keep.
        </span>
      </label>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="btn-danger w-full"
      >
        {busy ? "Deleting…" : "Delete my account & data"}
      </button>
    </form>
  );
}
