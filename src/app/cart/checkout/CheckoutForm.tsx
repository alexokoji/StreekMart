"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Price } from "@/components/Price";

type PaymentMethod = "DIRECT" | "ON_DELIVERY";

export function CheckoutForm() {
  const router = useRouter();
  const [shippingAddress, setShippingAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("DIRECT");
  const [useWalletCredit, setUseWalletCredit] = useState(false);
  const [walletAvailableCents, setWalletAvailableCents] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Fetch the buyer's available wallet credit on mount so the UI can show
  // "you have $X.XX" and gate the checkbox visibility cleanly.
  useEffect(() => {
    let alive = true;
    fetch("/api/wallet")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        const cents = typeof data.availableCents === "number" ? data.availableCents : 0;
        setWalletAvailableCents(cents);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cart/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingAddress,
          notes: notes || undefined,
          paymentMethod,
          useWalletCredit,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Checkout failed");
        return;
      }
      // Live Monnify returns a hosted-checkout URL; stub mode returns just
      // the paymentReference. Either way the buyer ends up on the return
      // page where the order group resolves.
      if (typeof data.redirectUrl === "string" && data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      router.replace(`/cart/checkout/return?ref=${encodeURIComponent(data.paymentReference)}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label">Shipping address</label>
        <textarea
          className="input min-h-[100px]"
          required
          minLength={5}
          placeholder="Street, city, postal code, country"
          value={shippingAddress}
          onChange={(e) => setShippingAddress(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Order notes <span className="text-xs text-gray-400">(optional)</span></label>
        <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <fieldset className="space-y-2">
        <legend className="label">Payment method</legend>

        <label
          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
            paymentMethod === "DIRECT"
              ? "border-violet-500 bg-violet-50/40"
              : "border-ink-200 hover:bg-ink-50"
          }`}
        >
          <input
            type="radio"
            name="paymentMethod"
            value="DIRECT"
            checked={paymentMethod === "DIRECT"}
            onChange={() => setPaymentMethod("DIRECT")}
            className="mt-0.5 h-4 w-4"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">Pay now (card, bank, or transfer)</p>
            <p className="text-xs text-ink-500">
              You&apos;ll be redirected to a secure payment page. Funds are held until you
              confirm delivery.
            </p>
          </div>
        </label>

        <label
          aria-disabled="true"
          title="Coming soon — Pay on Delivery is being rolled out to trusted buyers first."
          className="flex cursor-not-allowed items-start gap-3 rounded-xl border border-dashed border-ink-200 bg-ink-50/60 p-3 opacity-70"
        >
          <input
            type="radio"
            name="paymentMethod"
            value="ON_DELIVERY"
            disabled
            className="mt-0.5 h-4 w-4"
          />
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-ink-700">
              Pay on Delivery
              <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold-700">
                Coming soon
              </span>
            </p>
            <p className="text-xs text-ink-500">
              Pay cash when the courier arrives. We&apos;re rolling this out to trusted
              buyers first — complete a few delivered orders to qualify.
            </p>
          </div>
        </label>
      </fieldset>

      {walletAvailableCents !== null && walletAvailableCents > 0 && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={useWalletCredit}
            onChange={(e) => setUseWalletCredit(e.target.checked)}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">
              Apply refund wallet (
              <Price amount={walletAvailableCents / 100} /> available)
            </p>
            <p className="text-xs text-ink-500">
              Wallet credit is applied first; only the remaining balance — if any —
              is charged to your card.
            </p>
          </div>
        </label>
      )}

      {err && <p className="text-sm text-red-600">{err}</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Starting payment…" : "Pay & place orders"}
      </button>
    </form>
  );
}
