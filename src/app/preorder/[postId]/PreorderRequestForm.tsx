"use client";

import { useState } from "react";

export function PreorderRequestForm({ postId }: { postId: string }) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/preorders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, notes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't start the preorder.");
        return;
      }
      // The gateway returns a checkout URL we redirect to. In stub mode
      // we get back our own absolute URL pointing at the buyer's preorder
      // detail page — also fine.
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <div>
        <label className="label">Anything the designer should know? (optional)</label>
        <textarea
          className="input min-h-[100px] text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          placeholder="Size, colour preference, deadline, fabric notes…"
        />
      </div>
      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Starting payment…" : "Preorder & pay design fee"}
      </button>
      <p className="text-[11px] text-ink-500">
        You&rsquo;ll be redirected to a secure payment page. Delivery is a
        separate charge once the piece is ready.
      </p>
    </form>
  );
}
