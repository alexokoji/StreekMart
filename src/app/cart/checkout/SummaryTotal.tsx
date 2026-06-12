"use client";

import { useCheckoutTotals } from "./CheckoutTotalsContext";
import { PromoCodeInput } from "./PromoCodeInput";

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
 * Subtracts the promo discount from the displayed total if one is
 * applied; the actual gateway charge is computed server-side using the
 * same logic in /api/cart/checkout so the buyer's screen total matches
 * what they're charged.
 */
export function SummaryTotal({ subtotalNgn }: { subtotalNgn: number }) {
  const { shippingKoboTotal, promoDiscountCents } = useCheckoutTotals();
  const shippingNgn = shippingKoboTotal / 100;
  const promoNgn = promoDiscountCents / 100;
  const total = Math.max(0, subtotalNgn + shippingNgn - promoNgn);
  const subtotalCents = Math.round(subtotalNgn * 100);
  return (
    <div className="mt-3 space-y-3">
      <PromoCodeInput subtotalCents={subtotalCents} />
      <div className="space-y-1 border-t pt-3 text-base font-bold">
        {promoNgn > 0 && (
          <div className="flex justify-between text-sm font-normal text-emerald-700">
            <span>Promo discount</span>
            <span>-{NGN_FORMATTER.format(promoNgn)}</span>
          </div>
        )}
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
    </div>
  );
}