"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Per-order rider quick actions:
//   - "Open delivery confirm" → /deliver/[id] (existing code-entry flow)
//   - "Mark out for delivery" → posts a DISPATCHED tracking update so the
//     buyer sees movement (visible on their /account/orders/[id] timeline).
//   - "Arriving soon" → same, but kind=ARRIVING.
export function RiderActions({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"dispatch" | "arriving" | null>(null);
  const [posted, setPosted] = useState<string | null>(null);

  async function postUpdate(kind: "DISPATCHED" | "ARRIVING") {
    const message =
      kind === "DISPATCHED"
        ? "Out for delivery — package picked up."
        : "Arriving soon — heading to you now.";
    const tag = kind === "DISPATCHED" ? "dispatch" : "arriving";
    setBusy(tag);
    setPosted(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, message }),
      });
      if (res.ok) {
        setPosted(kind === "DISPATCHED" ? "Buyer notified you're on the way." : "Buyer notified you're nearly there.");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setPosted(data.error ?? "Couldn't post update.");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Link
        href={`/deliver/${orderId}`}
        className="rounded-md bg-emerald-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
      >
        Confirm delivery →
      </Link>
      <button
        type="button"
        onClick={() => postUpdate("DISPATCHED")}
        disabled={busy !== null}
        className="rounded-md border border-violet-500 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
      >
        {busy === "dispatch" ? "Posting…" : "Out for delivery"}
      </button>
      <button
        type="button"
        onClick={() => postUpdate("ARRIVING")}
        disabled={busy !== null}
        className="rounded-md border border-violet-500 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
      >
        {busy === "arriving" ? "Posting…" : "Arriving soon"}
      </button>
      <span className="ml-auto text-[11px] text-ink-500">Status: {status}</span>
      {posted && <p className="basis-full text-xs text-ink-600">{posted}</p>}
    </div>
  );
}
