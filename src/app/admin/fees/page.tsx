import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { Price } from "@/components/Price";
import { timeAgo } from "@/lib/utils";
import { PLATFORM_FEE_BPS, WITHDRAWAL_FEE_BPS } from "@/lib/monnify";

export default async function AdminFeesPage() {
  await requireAdmin(ADMIN_PERMISSIONS.MANAGE_DELIVERY);

  const [salesAggregate, platformFeeAggregate, withdrawalFeeAggregate, recentFees] = await Promise.all([
    prisma.walletTransaction.aggregate({
      where: { type: "SALE_CREDIT" },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.walletTransaction.aggregate({
      where: { type: "PLATFORM_FEE" },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.walletTransaction.aggregate({
      where: { type: "WITHDRAWAL_FEE" },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.walletTransaction.findMany({
      where: { type: { in: ["PLATFORM_FEE", "WITHDRAWAL_FEE"] } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { wallet: { include: { user: { select: { id: true, name: true } } } } },
    }),
  ]);

  const grossSalesCents = salesAggregate._sum.amountCents ?? 0;
  const platformFeesCents = Math.abs(platformFeeAggregate._sum.amountCents ?? 0);
  const withdrawalFeesCents = Math.abs(withdrawalFeeAggregate._sum.amountCents ?? 0);
  const totalRevenueCents = platformFeesCents + withdrawalFeesCents;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Platform fees</h1>
        <p className="text-sm text-ink-600">
          Sales fee {(PLATFORM_FEE_BPS / 100).toFixed(2)}% · withdrawal fee {(WITHDRAWAL_FEE_BPS / 100).toFixed(2)}%.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Gross sales (lifetime)" value={<Price amount={grossSalesCents / 100} />} sub={`${salesAggregate._count} sale events`} />
        <Stat label="Sale fees collected" value={<Price amount={platformFeesCents / 100} />} sub={`${platformFeeAggregate._count} entries`} />
        <Stat label="Withdrawal fees" value={<Price amount={withdrawalFeesCents / 100} />} sub={`${withdrawalFeeAggregate._count} withdrawals`} />
        <Stat label="Total platform revenue" value={<Price amount={totalRevenueCents / 100} />} highlight />
      </div>

      <section className="card overflow-hidden">
        <header className="border-b border-ink-100 p-4">
          <h2 className="font-display text-base font-semibold">Recent fee events</h2>
        </header>
        {recentFees.length === 0 ? (
          <p className="p-6 text-sm text-ink-500">No fees collected yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {recentFees.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{t.description}</p>
                  <p className="text-xs text-ink-500">
                    from {t.wallet.user.name} · {timeAgo(t.createdAt)} · {t.type.toLowerCase().replace("_", " ")}
                  </p>
                </div>
                <p className="font-semibold text-emerald-accent">
                  +<Price amount={Math.abs(t.amountCents) / 100} />
                </p>
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
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`card p-4 ${highlight ? "border-violet-300 bg-violet-50/40" : ""}`}>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">{label}</p>
      <p className="mt-1 font-display text-xl font-bold">{value}</p>
      {sub && <p className="text-[11px] text-ink-500">{sub}</p>}
    </div>
  );
}
