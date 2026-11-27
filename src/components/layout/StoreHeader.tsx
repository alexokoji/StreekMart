import Link from "next/link";
import { prisma } from "@/lib/db";
import type { StoreLock } from "@/lib/storefrontServer";
import { CartIcon } from "./CartIcon";

// Header shown instead of the marketplace navigation while a visitor is
// locked to one seller's storefront. It carries the seller's name, a cart for
// that seller's items, and sign-in / account. There is deliberately no link
// to the wider marketplace.
export async function StoreHeader({
  lock,
  user,
}: {
  lock: StoreLock;
  user: { id: string; name: string } | null;
}) {
  const cartCount = user
    ? await prisma.cartItem.count({
        where: { cart: { userId: user.id }, product: { sellerId: lock.sellerId } },
      })
    : 0;
  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/90 backdrop-blur dark:border-ink-800 dark:bg-ink-900/90">
      <div className="mx-auto flex h-14 w-full max-w-[1800px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
        <Link href={`/shop/${lock.handle}`} className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-sm font-bold text-white">
            {lock.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lock.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              lock.name.slice(0, 1).toUpperCase()
            )}
          </span>
          <span className="truncate font-display text-base font-semibold">{lock.name}</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <Link href="/account/orders" className="text-ink-700 hover:text-ink-900 dark:text-ink-200">
              My orders
            </Link>
          ) : (
            <>
              <Link href="/login?redirect=/cart" className="text-ink-700 hover:text-ink-900 dark:text-ink-200">
                Sign in
              </Link>
              <Link href="/register?redirect=/cart" className="btn-primary px-4 py-1.5 text-sm">
                Create account
              </Link>
            </>
          )}
          <CartIcon initialCount={cartCount} />
        </nav>
      </div>
    </header>
  );
}
