"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Stub-mode confirmation control. When the payment gateway is in stub mode,
// this lets developers simulate the asynchronous webhook by calling
// /api/monnify/stub-confirm directly.
export function StubConfirmPanel({ paymentReference }: { paymentReference: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"paid" | "failed" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function send(outcome: "paid" | "failed") {
    setBusy(outcome);
    setErr(null);
    try {
      const res = await fetch("/api/monnify/stub-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentReference, outcome }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error ?? "Failed to confirm.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <h1 className="font-display text-xl font-semibold">Stub checkout</h1>
      <p className="mt-2 text-sm text-ink-600">
        Payment gateway is in stub mode (set <code>KORAPAY_LIVE=1</code> in <code>.env</code> for real
        payments). Pick an outcome to simulate the webhook.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={() => send("paid")}
          disabled={!!busy}
        >
          {busy === "paid" ? "Confirming…" : "Simulate paid"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => send("failed")}
          disabled={!!busy}
        >
          {busy === "failed" ? "Cancelling…" : "Simulate failure"}
        </button>
      </div>
      {err && <p className="mt-3 text-sm text-burgundy-700">{err}</p>}
    </>
  );
}
