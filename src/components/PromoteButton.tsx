"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PROMOTION_DURATION_DAYS,
  PROMOTION_FEE_NGN,
} from "@/lib/enums";

type Props = {
  kind: "product" | "post";
  id: string;
  // Disabled means there's already an APPROVED, currently-running promo
  // for this item — the seller can't queue another while one is live.
  disabled?: boolean;
  // Set when there's a PENDING_PAYMENT or PENDING_REVIEW row — render the
  // button in a "waiting" state instead of letting the seller pay again.
  pendingState?: "payment" | "review";
};

// Promote control.
//
// Products: ₦500 fee, fixed 3-day run, admin-approved before going live.
//   - Clicking "Confirm" POSTs /api/promotions, then redirects the
//     browser to the returned Monnify checkout URL (or to the product
//     page in stub mode, where payment is auto-confirmed).
//
// Posts: legacy free flow with a custom duration. No payment, no admin
// approval — flips on immediately.
export function PromoteButton({ kind, id, disabled, pendingState }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(7);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function promote() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kind === "product" ? { kind, id } : { kind, id, days },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Couldn't start the promotion.");
        return;
      }
      if (kind === "product" && typeof data.checkoutUrl === "string") {
        // Send the seller to Monnify (live) or back to the product page
        // with `?promo=pending` (stub mode auto-flips to PENDING_REVIEW
        // server-side — see /api/promotions).
        window.location.href = data.checkoutUrl;
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (disabled) {
    return <button disabled className="btn-secondary opacity-60">Promoted</button>;
  }

  if (pendingState) {
    const label =
      pendingState === "payment"
        ? "Payment pending"
        : "Awaiting admin approval";
    return (
      <button disabled className="btn-secondary opacity-60" title={label}>
        {label}
      </button>
    );
  }

  return (
    <div className="relative">
      <button type="button" className="btn-primary" onClick={() => setOpen((v) => !v)}>
        Promote
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-72 card p-4 shadow-lg">
          {kind === "product" ? (
            <>
              <p className="text-sm font-semibold">Feature this on the home page</p>
              <p className="mt-1 text-xs text-ink-500">
                Pay <span className="font-semibold text-ink-800">₦{PROMOTION_FEE_NGN}</span>{" "}
                to enter the front-page slider for{" "}
                <span className="font-semibold text-ink-800">
                  {PROMOTION_DURATION_DAYS} days
                </span>{" "}
                — runs after admin approval.
              </p>
              <ul className="mt-3 space-y-1 text-[11px] text-ink-500">
                <li>· Pay now via Monnify (card / transfer / USSD).</li>
                <li>· Admin reviews within 24h; rejection refunds to your wallet.</li>
                <li>· On approval, runs for {PROMOTION_DURATION_DAYS} days and you can&apos;t re-promote until it ends.</li>
              </ul>
            </>
          ) : (
            <>
              <p className="mb-2 text-sm font-medium">Boost visibility in the feed</p>
              <label className="label text-xs">Duration (days)</label>
              <input
                type="number"
                min={1}
                max={30}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="input"
              />
            </>
          )}
          {err && <p className="mt-2 text-xs text-burgundy-700">{err}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className="btn-secondary text-xs" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary text-xs"
              disabled={busy}
              onClick={promote}
            >
              {busy
                ? kind === "product"
                  ? "Starting…"
                  : "Promoting…"
                : kind === "product"
                  ? `Pay ₦${PROMOTION_FEE_NGN}`
                  : "Confirm"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
