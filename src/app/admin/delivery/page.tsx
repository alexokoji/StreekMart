import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Price } from "@/components/Price";
import { countryName } from "@/lib/location";
import { AdminDeliveryRateEditor } from "./AdminDeliveryRateEditor";

// /admin/delivery — overview of every seller's delivery rates so admins can
// spot outliers (e.g. someone charging $300 within-city). Sorted by the most
// expensive rate first to surface aggressive pricing.
export default async function AdminDeliveryRatesPage() {
  await requireAdmin();

  const sellers = await prisma.user.findMany({
    where: { OR: [{ isSeller: true }, { isDesigner: true }] },
    select: {
      id: true,
      name: true,
      email: true,
      country: true,
      city: true,
      sellerVerified: true,
      designerVerified: true,
      deliveryWithinCityCents: true,
      deliveryOutsideCityCents: true,
      deliveryOutsideCountryCents: true,
    },
  });

  // Sort by the highest of the three rates, descending — outliers float up.
  sellers.sort((a, b) => maxRate(b) - maxRate(a));

  const flagged = sellers.filter(
    (s) =>
      s.deliveryWithinCityCents === 0 &&
      s.deliveryOutsideCityCents === 0 &&
      s.deliveryOutsideCountryCents === 0,
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Delivery rate review</h1>
        <p className="text-sm text-ink-600">
          Every seller&apos;s declared shipping rates, in USD. Sellers without rates set
          ship for free — that&apos;s usually a misconfiguration.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Sellers + designers" value={sellers.length.toString()} />
        <Stat label="No rates set" value={flagged.toString()} />
        <Stat label="Avg international" value={<Price amount={avgRate(sellers, "deliveryOutsideCountryCents") / 100} />} />
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-ink-100 text-sm">
          <thead className="bg-ink-50/50 text-left text-[11px] font-semibold uppercase tracking-widest text-ink-500">
            <tr>
              <th className="px-4 py-2">Seller</th>
              <th className="px-4 py-2">Location</th>
              <th className="px-4 py-2 text-right">Within city</th>
              <th className="px-4 py-2 text-right">Outside city</th>
              <th className="px-4 py-2 text-right">International</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {sellers.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2">
                  <p className="font-medium">
                    {s.name}
                    {(s.sellerVerified || s.designerVerified) && (
                      <span className="ml-1 text-emerald-accent" title="Verified">✓</span>
                    )}
                  </p>
                  <p className="text-[11px] text-ink-500">{s.email}</p>
                </td>
                <td className="px-4 py-2 text-xs">
                  {s.city ? `${s.city}, ${countryName(s.country)}` : countryName(s.country)}
                </td>
                <RateCell cents={s.deliveryWithinCityCents} />
                <RateCell cents={s.deliveryOutsideCityCents} />
                <RateCell cents={s.deliveryOutsideCountryCents} />
                <td className="px-4 py-2 text-right">
                  <AdminDeliveryRateEditor
                    userId={s.id}
                    initial={{
                      within: s.deliveryWithinCityCents,
                      outside: s.deliveryOutsideCityCents,
                      international: s.deliveryOutsideCountryCents,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RateCell({ cents }: { cents: number }) {
  const zero = cents === 0;
  return (
    <td
      className={`px-4 py-2 text-right ${
        zero ? "text-ink-400" : cents > 5000 ? "text-burgundy-700" : ""
      }`}
    >
      {zero ? "Free" : <Price amount={cents / 100} />}
    </td>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

function maxRate(s: {
  deliveryWithinCityCents: number;
  deliveryOutsideCityCents: number;
  deliveryOutsideCountryCents: number;
}): number {
  return Math.max(
    s.deliveryWithinCityCents,
    s.deliveryOutsideCityCents,
    s.deliveryOutsideCountryCents,
  );
}

function avgRate(
  sellers: Array<Record<string, unknown>>,
  key: "deliveryWithinCityCents" | "deliveryOutsideCityCents" | "deliveryOutsideCountryCents",
): number {
  if (sellers.length === 0) return 0;
  const sum = sellers.reduce((s, x) => s + ((x[key] as number) ?? 0), 0);
  return Math.round(sum / sellers.length);
}
