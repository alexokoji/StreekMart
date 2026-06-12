import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { timeAgo } from "@/lib/utils";
import { Price } from "@/components/Price";
import { ReferralCard } from "@/components/ReferralCard";
import { DailyCheckIn } from "@/components/DailyCheckIn";
import { ensureReferralCode } from "@/lib/referrals";

// /account is the buyer dashboard. Sellers and designers have their own
// dashboards; we forward them there so the avatar chip lands on the right
// surface every time. A user with both Seller AND Designer permissions stays
// here so they can pick which dashboard to enter â€” landing them automatically
// on either one would be wrong.
export default async function AccountPage() {
  const user = await requireUser();

  if (user.isSeller && !user.isDesigner) redirect("/seller");
  if (user.isDesigner && !user.isSeller) redirect("/designer");

  const referralCode = await ensureReferralCode(user.id);
  const [orders, wishlistCount, cart, unreadMessages, referralCount, currentUser] = await Promise.all([
    prisma.order.findMany({
      where: { buyerId: user.id },
      include: { product: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.favorite.count({ where: { userId: user.id, productId: { not: null } } }),
    prisma.cart.findUnique({
      where: { userId: user.id },
      include: { items: true },
    }),
    prisma.message.count({
      where: { chat: { participants: { some: { userId: user.id } } }, readAt: null, senderId: { not: user.id } },
    }).catch(() => 0),
    prisma.referral.count({ where: { referrerId: user.id } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { pointsBalance: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Welcome back, {user.name}</h1>
          <p className="text-sm text-ink-600">{user.email}</p>
        </div>
        <Link href="/" className="btn-secondary text-sm">Browse storefront</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiLink href="/cart" label="Items in cart" value={cart?.items.length ?? 0} />
        <KpiLink href="/wishlist" label="Wishlist" value={wishlistCount} />
        <KpiLink href="/messages" label="Unread messages" value={unreadMessages} />
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/account/orders" className="btn-secondary">My orders</Link>
        <Link href="/account/preorders" className="btn-secondary">My preorders</Link>
        <Link href="/account/notifications" className="btn-secondary">Notifications</Link>
        <Link href="/account/payment-methods" className="btn-secondary">Payment methods</Link>
        <Link href="/account/coupons" className="btn-secondary">Coupons</Link>
        <Link href="/account/addresses" className="btn-secondary">Addresses</Link>
      </div>

      <ReferralCard
        code={referralCode}
        pointsBalance={currentUser?.pointsBalance ?? 0}
        referralCount={referralCount}
        siteUrl={process.env.NEXT_PUBLIC_APP_URL ?? "https://www.streekmart.online"}
      />

      <DailyCheckIn />

      <section className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Recent orders</h2>
          <Link href="/account/orders" className="text-sm text-violet-700 hover:underline">
            View all
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">No purchases yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-100">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{o.product.name}</p>
                  <p className="text-xs text-ink-500">{timeAgo(o.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium"><Price amount={o.totalPrice} /></p>
                  <span className="badge bg-ink-50 text-ink-700">{o.status}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pro accounts (Buyer + Seller + Designer) get quick links to both dashboards. */}
      {user.isSeller && user.isDesigner && (
        <section className="card p-6">
          <h2 className="font-display text-lg font-semibold">Your other dashboards</h2>
          <p className="mt-1 text-sm text-ink-500">
            Switch into the seller or designer surface to manage products and posts.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/seller" className="btn-primary">Open seller dashboard</Link>
            <Link href="/designer" className="btn-secondary">Open designer dashboard</Link>
          </div>
        </section>
      )}
    </div>
  );
}

function KpiLink({ href, label, value }: { href: string; label: string; value: number | string }) {
  return (
    <Link href={href} className="card p-4 hover:border-violet-400">
      <p className="text-xs uppercase tracking-wider text-ink-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </Link>
  );
}
