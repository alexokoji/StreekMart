"use client";

import { useCheckoutTotals } from "./CheckoutTotalsContext";

const NGN_FORMATTER = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * The summary aside's Total line. Receives the items subtotal in NGN
 * (regular units, matching how product prices are stored) and adds the
 * shipping total the form pushes via context (NGN-kobo for precision).
 */
export function SummaryTotal({ subtotalNgn }: { subtotalNgn: number }) {
  const { shippingKoboTotal } = useCheckoutTotals();
  const shippingNgn = shippingKoboTotal / 100;
  const total = subtotalNgn + shippingNgn;
  return (
    <div className="mt-3 space-y-1 border-t pt-3 text-base font-bold">
      <div className="flex justify-between">
        <span>Total</span>
        <span>{NGN_FORMATTER.format(total)}</span>
      </div>
      {shippingNgn > 0 && (
        <p className="text-right text-xs font-normal text-ink-500">
          Includes {NGN_FORMATTER.format(shippingNgn)} shipping
        </p>
      )}
    </div>
  );
}
