import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { countryName } from "@/lib/location";
import { Price } from "@/components/Price";
import { CityForm } from "./CityForm";
import { CityRow } from "./CityRow";

// /admin/delivery-cities — manage the platform-served delivery whitelist.
export default async function AdminDeliveryCitiesPage() {
  await requireAdmin();
  const cities = await prisma.deliveryCity.findMany({
    orderBy: [{ active: "desc" }, { country: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Delivery cities</h1>
        <p className="text-sm text-ink-600">
          A buyer + seller in the same listed city use the platform&apos;s in-house delivery.
          Sellers outside this list have to assign their own rider. International orders
          are blocked everywhere.
        </p>
      </div>

      <section className="card p-5">
        <h2 className="font-display text-base font-semibold">Add a city</h2>
        <CityForm />
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-500">
          Whitelist ({cities.length})
        </h2>
        {cities.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-500">
            No supported cities yet. Add at least one above to enable platform delivery.
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100 text-sm">
              <thead className="bg-ink-50/50 text-left text-[11px] font-semibold uppercase tracking-widest text-ink-500">
                <tr>
                  <th className="px-4 py-2">City</th>
                  <th className="px-4 py-2">Country</th>
                  <th className="px-4 py-2 text-right">Fee</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {cities.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 font-medium">
                      {c.name}
                      {c.region && <span className="ml-1 text-xs text-ink-500">({c.region})</span>}
                    </td>
                    <td className="px-4 py-2 text-xs">{countryName(c.country)}</td>
                    <td className="px-4 py-2 text-right">
                      <Price amount={c.feeCents / 100} />
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`badge ${
                          c.active ? "bg-emerald-50 text-emerald-accent" : "bg-ink-50 text-ink-400"
                        }`}
                      >
                        {c.active ? "Active" : "Paused"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <CityRow id={c.id} feeCents={c.feeCents} active={c.active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
