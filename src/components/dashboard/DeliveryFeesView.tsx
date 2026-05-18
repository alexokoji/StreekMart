import { Price } from "@/components/Price";

// Read-only display of a seller's own-rider delivery rates.
//
// Rates are admin-controlled (see /admin/delivery + the cascade in
// /api/admin/delivery-fees/[userId]). The seller sees what's configured but
// can't change it themselves — keeps the marketplace's pricing consistent.
//
// All three rates are only used when the order falls back to the seller's
// rider (cross-city orders, or any order where the seller's city isn't on
// the platform's delivery whitelist). Same-city orders in supported cities
// use the admin's flat fee instead.
export function DeliveryFeesView({
  rates,
}: {
  rates: {
    withinCityCents: number;
    outsideCityCents: number;
    outsideCountryCents: number;
  };
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <RateCard label="Within your city" cents={rates.withinCityCents} />
        <RateCard label="Outside city, same country" cents={rates.outsideCityCents} />
        <RateCard label="International" cents={rates.outsideCountryCents} />
      </div>
      <p className="rounded-lg border border-ink-100 bg-ink-50/50 p-3 text-xs text-ink-600">
        Delivery rates are set by StreekMart admins to keep pricing consistent
        across the marketplace. If your rates need to change, reach out to support.
      </p>
    </div>
  );
}

function RateCard({ label, cents }: { label: string; cents: number }) {
  const zero = cents === 0;
  return (
    <div className="rounded-xl border border-ink-100 bg-white px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">
        {label}
      </p>
      <p className={`mt-1 font-display text-lg font-bold ${zero ? "text-ink-400" : "text-ink-900"}`}>
        {zero ? "Not set" : <Price amount={cents / 100} />}
      </p>
    </div>
  );
}
