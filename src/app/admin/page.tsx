import Link from "next/link";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Price } from "@/components/Price";

// Admin overview — top-line numbers + shortcuts to the deep dive pages.
export default async function AdminOverviewPage() {
  await requireAdmin();

  const [
    userCount,
    sellerCount,
    designerCount,
    productCount,
    activeProductCount,
    pendingVerifications,
    pendingPayouts,
    feeAggregate,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isSeller: true } }),
    prisma.user.count({ where: { isDesigner: true } }),
    prisma.product.count(),
    prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
    prisma.verificationRequest.count({ where: { status: "PENDING" } }),
    prisma.payoutRequest.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }),
    prisma.walletTransaction.aggregate({
      where: { type: "PLATFORM_FEE" },
      _sum: { amountCents: true },
    }),
  ]);

  // Platform fee transactions are stored as negative debits to the seller's
  // wallet — the platform's accumulated revenue is the absolute sum.
  const feeRevenueCents = Math.abs(feeAggregate._sum.amountCents ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Control room</h1>
        <p className="text-sm text-ink-600">A bird&apos;s-eye view of StreekMart.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Users" value={userCount.toString()} />
        <Stat label="Sellers" value={sellerCount.toString()} />
        <Stat label="Designers" value={designerCount.toString()} />
        <Stat
          label="Active products"
          value={`${activeProductCount} / ${productCount}`}
        />
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
          href="/admin/fees"
          label="Platform revenue"
          value={<Price amount={feeRevenueCents / 100} />}
        />
      </div>

      <section className="card p-6">
        <h2 className="font-display text-lg font-semibold">Quick actions</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Link href="/admin/verifications" className="btn-secondary">
            Review verification requests
          </Link>
          <Link href="/admin/users" className="btn-secondary">
            Find &amp; verify a user manually
          </Link>
          <Link href="/admin/products" className="btn-secondary">
            Browse all products
          </Link>
          <Link href="/admin/payouts" className="btn-secondary">
            Inspect payouts
          </Link>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

function KpiLink({
  href,
  label,
  value,
  highlight,
}: {
  href: string;
  label: string;
  value: React.ReactNode;
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
    </Link>
  );
}
