"use client";

import { useCheckoutTotals } from "./CheckoutTotalsContext";

const NGN_FORMATTER = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * The summary aside's Total line. Receives the NGN-equivalent of the items
 * subtotal as a server-computed prop (so we don't ship FX rates to the client)
 * and adds the shipping total that CheckoutForm pushes via context.
 *
 * Both pieces are in NGN-kobo here so the math is a plain integer sum.
 */
export function SummaryTotal({ subtotalNgnKobo }: { subtotalNgnKobo: number }) {
  const { shippingKoboTotal } = useCheckoutTotals();
  const total = subtotalNgnKobo + shippingKoboTotal;
  return (
    <div className="mt-3 space-y-1 border-t pt-3 text-base font-bold">
      <div className="flex justify-between">
        <span>Total</span>
        <span>{NGN_FORMATTER.format(total / 100)}</span>
      </div>
      {shippingKoboTotal > 0 && (
        <p className="text-right text-xs font-normal text-ink-500">
          Includes {NGN_FORMATTER.format(shippingKoboTotal / 100)} shipping
        </p>
      )}
    </div>
  );
}
