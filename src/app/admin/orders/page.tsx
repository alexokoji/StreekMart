import Link from "next/link";
import { OrderStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Price } from "@/components/Price";
import { timeAgo } from "@/lib/utils";
import { deliveryZoneLabel } from "@/lib/location";

const STATUS_FILTERS = [
  "ALL",
  "PENDING",
  "PAID",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];

// /admin/orders — searchable, status-filtered ledger of every order.
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string };
}) {
  await requireAdmin();

  const filter: StatusFilter = (STATUS_FILTERS.includes(searchParams.status as StatusFilter)
    ? (searchParams.status as StatusFilter)
    : "ALL");
  const q = (searchParams.q ?? "").trim();

  const where: Record<string, unknown> = {};
  if (filter !== "ALL") where.status = filter;
  if (q) {
    where.OR = [
      { id: { contains: q } },
      { paymentReference: { contains: q } },
      { product: { name: { contains: q } } },
      { buyer: { email: { contains: q } } },
      { seller: { email: { contains: q } } },
    ];
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      product: { select: { id: true, name: true } },
      buyer: { select: { id: true, name: true, email: true } },
      seller: { select: { id: true, name: true, email: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Orders</h1>
        <p className="text-sm text-ink-600">Every order on the platform — newest first, capped at 100.</p>
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((s) => {
            const active = s === filter;
            const params = new URLSearchParams();
            if (s !== "ALL") params.set("status", s);
            if (q) params.set("q", q);
            return (
              <Link
                key={s}
                href={`/admin/orders?${params.toString()}`}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  active
                    ? "bg-violet-600 text-white"
                    : "bg-ink-50 text-ink-700 hover:bg-ink-100"
                }`}
              >
                {s === OrderStatus.PENDING ? "Pending" : s === "ALL" ? "All" : s.toLowerCase().replace(/(^|_)\w/g, (c) => c.toUpperCase())}
              </Link>
            );
          })}
        </div>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by id, ref, email, product…"
          className="input ml-auto w-full max-w-xs text-sm"
        />
        {filter !== "ALL" && <input type="hidden" name="status" value={filter} />}
        <button type="submit" className="btn-secondary text-xs">Search</button>
      </form>

      {orders.length === 0 ? (
        <div className="card p-10 text-center text-sm text-ink-500">
          No orders match those filters.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-100 text-sm">
            <thead className="bg-ink-50/50 text-left text-[11px] font-semibold uppercase tracking-widest text-ink-500">
              <tr>
                <th className="px-4 py-2">Order</th>
                <th className="px-4 py-2">Buyer → Seller</th>
                <th className="px-4 py-2">Delivery</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2">
                    <p className="font-medium">{o.product.name}</p>
                    <p className="font-mono text-[10px] text-ink-400">{o.id.slice(0, 12)}…</p>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <p>{o.buyer.name}</p>
                    <p className="text-ink-500">→ {o.seller.name}</p>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <p>{deliveryZoneLabel(o.deliveryZone as Parameters<typeof deliveryZoneLabel>[0])}</p>
                    <p className="text-ink-500"><Price amount={o.deliveryFeeCents / 100} /></p>
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">
                    <Price amount={o.totalPrice} />
                  </td>
                  <td className="px-4 py-2">
                    <span className="badge bg-ink-50 text-ink-700">{o.status}</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-ink-500">{timeAgo(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
