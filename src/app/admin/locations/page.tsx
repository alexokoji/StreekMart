import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { countryName } from "@/lib/location";

// /admin/locations — geographic distribution of every account, broken down by
// country and city. Useful for picking a market expansion focus and for
// noticing weird signups (a flood from one tiny country is suspicious).
export default async function AdminLocationsPage() {
  await requireAdmin(ADMIN_PERMISSIONS.MANAGE_DELIVERY);

  const [byCountry, withoutLocation, byCity] = await Promise.all([
    prisma.user.groupBy({
      by: ["country"],
      _count: { _all: true },
      orderBy: { _count: { country: "desc" } },
    }),
    prisma.user.count({ where: { country: null } }),
    prisma.user.groupBy({
      by: ["country", "city"],
      _count: { _all: true },
      where: { country: { not: null }, city: { not: null } },
      orderBy: { _count: { city: "desc" } },
      take: 30,
    }),
  ]);

  const total = byCountry.reduce((s, r) => s + r._count._all, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Locations</h1>
        <p className="text-sm text-ink-600">
          Where StreekMart users are. Country + city are collected at signup; older accounts
          may not have them filled — we prompt those buyers in their settings.
        </p>
      </div>

      {withoutLocation > 0 && (
        <div className="card border-amber-300 bg-amber-50/40 p-4">
          <p className="text-sm font-medium text-amber-800">
            {withoutLocation} user{withoutLocation === 1 ? "" : "s"} with no country set.
          </p>
          <p className="text-xs text-amber-700/80">
            Mostly Google sign-ups from before location was required — they&apos;ll get
            prompted on first checkout.
          </p>
        </div>
      )}

      <section className="card p-6">
        <h2 className="font-display text-lg font-semibold">By country</h2>
        <p className="text-xs text-ink-500">{total} users with a country set.</p>
        <ul className="mt-3 space-y-2">
          {byCountry
            .filter((r) => r.country)
            .map((row) => {
              const pct = total ? Math.round((row._count._all / total) * 100) : 0;
              return (
                <li key={row.country!} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0">{countryName(row.country)}</span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="absolute inset-y-0 left-0 bg-violet-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-20 text-right font-mono text-xs text-ink-600">
                    {row._count._all} · {pct}%
                  </span>
                </li>
              );
            })}
        </ul>
      </section>

      <section className="card p-6">
        <h2 className="font-display text-lg font-semibold">Top cities</h2>
        <p className="text-xs text-ink-500">Top 30 city + country pairs.</p>
        {byCity.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">No city data yet.</p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {byCity.map((row) => (
              <div
                key={`${row.country}-${row.city}`}
                className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2 text-sm"
              >
                <span>
                  {row.city}
                  <span className="ml-1 text-[11px] text-ink-500">{countryName(row.country)}</span>
                </span>
                <span className="font-mono text-xs text-ink-600">{row._count._all}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
