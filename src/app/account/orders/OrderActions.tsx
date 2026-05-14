"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Buyer-side actions for an order row.
//
// - Confirm delivery → flips status to COMPLETED, which releases the seller's
//   held funds. Visible only on PAID/SHIPPED orders.
// - Cancel order → only allowed under specific conditions (the API enforces;
//   this UI surfaces the right CTA based on `cancellable`).
export function OrderActions({
  orderId,
  status,
  cancellable,
  cancelHint,
}: {
  orderId: string;
  status: string;
  cancellable: boolean;
  cancelHint: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"confirm" | "cancel" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function patch(next: "COMPLETED" | "CANCELLED", action: "confirm" | "cancel") {
    setErr(null);
    setBusy(action);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Couldn't update the order.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const showConfirm = status === "PAID" || status === "SHIPPED";
  const showCancel = status === "PENDING" || status === "PAID" || status === "SHIPPED";

  if (!showConfirm && !showCancel) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {showConfirm && (
        <button
          type="button"
          onClick={() => patch("COMPLETED", "confirm")}
          disabled={busy !== null}
          className="rounded-md bg-emerald-accent px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy === "confirm" ? "Confirming…" : "Confirm delivery"}
        </button>
      )}
      {showCancel && (
        <button
          type="button"
          onClick={() => patch("CANCELLED", "cancel")}
          disabled={!cancellable || busy !== null}
          title={cancellable ? "Cancel this order" : cancelHint}
          className="rounded-md border border-burgundy-500 px-2.5 py-1 text-xs font-semibold text-burgundy-700 hover:bg-burgundy-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "cancel" ? "Cancelling…" : "Cancel"}
        </button>
      )}
      {err && <p className="text-xs text-burgundy-700">{err}</p>}
    </div>
  );
}
