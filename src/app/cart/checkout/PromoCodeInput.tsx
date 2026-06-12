"use client";

import { useState } from "react";
import { useCheckoutTotals } from "./CheckoutTotalsContext";

// Buyer enters a promo code, we hit /api/promo-codes/validate, show the
// discount, and store {code, discountCents} on the shared context so the
// sidebar summary can subtract it and the CheckoutForm's onSubmit can
// forward the code to /api/cart/checkout.
export function PromoCodeInput({ subtotalCents }: { subtotalCents: number }) {
  const { promoCode, promoDiscountCents, setPromo } = useCheckoutTotals();
  const [code, setCode] = useState(promoCode ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function apply() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase(), subtotalCents }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setErr(data.error ?? "Code not valid.");
        setPromo(null);
        return;
      }
      setPromo({ code: data.promo.code, discountCents: data.discountCents });
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setCode("");
    setErr(null);
    setPromo(null);
  }

  return (
    <div className="card p-4">
      <p className="label">Promo code</p>
      {promoCode ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span>
            <strong>{promoCode}</strong> applied &mdash; saving NGN {Math.round(promoDiscountCents / 100).toLocaleString("en-NG")}
          </span>
          <button onClick={clear} className="text-xs text-emerald-900 underline">
            Remove
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Got a code? Enter it here"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button className="btn-primary text-sm" onClick={apply} disabled={busy || !code.trim()}>
            {busy ? "..." : "Apply"}
          </button>
        </div>
      )}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  );
}