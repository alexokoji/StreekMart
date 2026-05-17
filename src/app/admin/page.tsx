import Link from "next/link";
import { OrderStatus, ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Price } from "@/components/Price";
import { countryName } from "@/lib/location";
import { timeAgo } from "@/lib/utils";

// Admin Control Room — at-a-glance health check across every domain.
//
// Sections:
//   - Headline KPIs (people / catalog / money / trust)
//   - Operational queues (pending verifications, payouts, refundable orders)
//   - Order pipeline by status
//   - Recent signups + recent orders feed
//   - Top markets by user count
export default async function AdminOverviewPage() {
  await requireAdmin();

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    userCount,
    sellerCount,
    designerCount,
    trustedBuyerCount,
    productCount,
    activeProductCount,
    pendingVerifications,
    pendingPayouts,
    feeAggregate,
    refundAggregate,
    walletHeldAggregate,
    orderCounts,
    salesLast30dAggregate,
    recentSignups,
    recentOrders,
    topCountriesRaw,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isSeller: true } }),
    prisma.user.count({ where: { isDesigner: true } }),
    prisma.user.count({ where: { trustedBuyer: true } }),
    prisma.product.count(),
    prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
    prisma.verificationRequest.count({ where: { status: "PENDING" } }),
    prisma.payoutRequest.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }),
    prisma.walletTransaction.aggregate({
      where: { type: "PLATFORM_FEE" },
      _sum: { amountCents: true },
    }),
    prisma.walletTransaction.aggregate({
      where: { type: "REFUND" },
      _sum: { amountCents: true },
    }),
    prisma.wallet.aggregate({ _sum: { heldCents: true } }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.aggregate({
      where: {
        status: { in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.COMPLETED] },
        paidAt: { gte: since30d },
      },
      _sum: { totalPrice: true },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, email: true, country: true, city: true, createdAt: true, isSeller: true, isDesigner: true },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        status: true,
        totalPrice: true,
        deliveryFeeCents: true,
        deliveryZone: true,
        createdAt: true,
        product: { select: { name: true } },
        buyer: { select: { name: true } },
        seller: { select: { name: true } },
      },
    }),
    prisma.user.groupBy({
      by: ["country"],
      _count: { _all: true },
      where: { country: { not: null } },
      orderBy: { _count: { country: "desc" } },
      take: 6,
    }),
  ]);

  const feeRevenueCents = Math.abs(feeAggregate._sum.amountCents ?? 0);
  const refundsCents = Math.abs(refundAggregate._sum.amountCents ?? 0);
  const walletHeldCents = walletHeldAggregate._sum.heldCents ?? 0;
  const salesLast30d = salesLast30dAggregate._sum.totalPrice ?? 0;
  const orderCountByStatus: Record<string, number> = Object.fromEntries(
    orderCounts.map((row) => [row.status, row._count._all]),
  );

  const orderTotal = orderCounts.reduce((s, r) => s + r._count._all, 0);
  const cancellableNowCount = await prisma.order.count({
    where: {
      status: { in: [OrderStatus.PAID, OrderStatus.SHIPPED] },
      expectedDeliveryBy: { lte: new Date() },
    },
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold">Control room</h1>
        <p className="text-sm text-ink-600">
          Operational health across StreekMart in one view — last refreshed {new Date().toLocaleString()}.
        </p>
      </header>

      {/* Operational queues — anything > 0 is bordered amber to draw the eye. */}
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-500">
          Needs action
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiLink
            href="/admin/verifications"
            label="Pending verifications"
            value={pendingVerifications.toString()}
            highlight={pendingVerifications > 0}
          />
          <KpiLink
            href="/admin/payouts"
            label="Pending payouts"
            value={pendingPayouts.toString()}
            highlight={pendingPayouts > 0}
          />
          <KpiLink
            href="/admin/refunds"
            label="Past delivery window"
            sub="Buyer can self-refund"
            value={cancellableNowCount.toString()}
            highlight={cancellableNowCount > 0}
          />
          <KpiLink
            href="/admin/delivery"
            label="Delivery rate review"
            sub="Sellers · all rates set"
            value="Open"
          />
        </div>
      </section>

      {/* People + catalog */}
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-500">
          People &amp; catalog
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Users" value={userCount.toString()} />
          <Stat label="Sellers" value={sellerCount.toString()} />
          <Stat label="Designers" value={designerCount.toString()} />
          <Stat label="Trusted buyers" value={trustedBuyerCount.toString()} />
          <Stat
            label="Products"
            value={`${activeProductCount} / ${productCount}`}
            sub="active / total"
          />
        </div>
      </section>

      {/* Money */}
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-500">
          Money
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Sales (30d)"
            value={<Price amount={salesLast30d} />}
            sub={`${salesLast30dAggregate._count._all} paid orders`}
          />
          <KpiLink
            href="/admin/fees"
            label="Platform revenue"
            value={<Price amount={feeRevenueCents / 100} />}
            sub="All-time fees"
          />
          <Stat
            label="Held in escrow"
            value={<Price amount={walletHeldCents / 100} />}
            sub="Waiting on delivery confirmation"
          />
          <Stat
            label="Refunds issued"
            value={<Price amount={refundsCents / 100} />}
            sub="All-time"
          />
        </div>
      </section>

      {/* Order pipeline */}
      <section className="card p-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Order pipeline</h2>
            <p className="text-xs text-ink-500">
              {orderTotal} order{orderTotal === 1 ? "" : "s"} all-time across every status.
            </p>
          </div>
          <Link href="/admin/orders" className="text-sm text-violet-700 hover:underline">
            Inspect orders →
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          {(["PENDING", "PAID", "SHIPPED", "COMPLETED", "CANCELLED"] as const).map((s) => (
            <PipelineCell key={s} status={s} count={orderCountByStatus[s] ?? 0} />
          ))}
        </div>
      </section>

      {/* Activity feeds + markets */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Recent orders</h2>
            <Link href="/admin/orders" className="text-xs text-violet-700 hover:underline">
              View all →
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">No orders yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-ink-100">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-medium">{o.product.name}</p>
                    <p className="text-[11px] text-ink-500">
                      {o.buyer.name} → {o.seller.name} · {o.deliveryZone.toLowerCase().replace("_", " ")} · {timeAgo(o.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold"><Price amount={o.totalPrice} /></p>
                    <span className="badge bg-ink-50 text-ink-700">{o.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-display text-lg font-semibold">Top markets</h2>
          <p className="text-xs text-ink-500">Users by country.</p>
          {topCountriesRaw.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">No location data yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {topCountriesRaw.map((row) => (
                <li key={row.country ?? "unknown"} className="flex items-center justify-between text-sm">
                  <span>{countryName(row.country)}</span>
                  <span className="font-mono text-xs text-ink-600">{row._count._all}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/locations" className="mt-3 inline-block text-xs text-violet-700 hover:underline">
            Drill into locations →
          </Link>
        </div>
      </section>

      <section className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Recent signups</h2>
          <Link href="/admin/users" className="text-xs text-violet-700 hover:underline">
            All users →
          </Link>
        </div>
        {recentSignups.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">No users yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-100">
            {recentSignups.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {u.name}
                    {u.isSeller && <span className="ml-2 badge bg-violet-50 text-violet-700">Seller</span>}
                    {u.isDesigner && <span className="ml-1 badge bg-fuchsia-50 text-fuchsia-700">Designer</span>}
                  </p>
                  <p className="text-[11px] text-ink-500">
                    {u.email} · {u.city ? `${u.city}, ${countryName(u.country)}` : countryName(u.country)} · {timeAgo(u.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-500">{sub}</p>}
    </div>
  );
}

function KpiLink({
  href,
  label,
  value,
  sub,
  highlight,
}: {
  href: string;
  label: string;
  value: React.ReactNode;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`card block p-4 transition-colors hover:border-violet-400 ${
        highlight ? "border-amber-300 bg-amber-50/40" : ""
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-500">{sub}</p>}
    </Link>
  );
}

function PipelineCell({
  status,
  count,
}: {
  status: "PENDING" | "PAID" | "SHIPPED" | "COMPLETED" | "CANCELLED";
  count: number;
}) {
  const tone: Record<typeof status, string> = {
    PENDING: "bg-ink-50 text-ink-700",
    PAID: "bg-violet-50 text-violet-700",
    SHIPPED: "bg-fuchsia-50 text-fuchsia-700",
    COMPLETED: "bg-emerald-50 text-emerald-accent",
    CANCELLED: "bg-burgundy-50 text-burgundy-700",
  };
  return (
    <div className={`rounded-xl px-4 py-3 ${tone[status]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">{status}</p>
      <p className="mt-1 font-display text-2xl font-bold">{count}</p>
    </div>
  );
}
