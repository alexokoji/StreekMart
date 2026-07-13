import Link from "next/link";
import { prisma } from "@/lib/db";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "./LogoutButton";
import { CartIcon } from "./CartIcon";
import { AccountChip } from "./AccountChip";
import { ThemeToggle } from "./ThemeToggle";
// CurrencySelector hidden for the Nigeria-only launch; re-enable when
// multi-currency display returns.
// import { CurrencySelector } from "./CurrencySelector";

type NavUser = {
  id: string;
  name: string;
  email: string;
  isSeller: boolean;
  isDesigner: boolean;
  isAdmin?: boolean;
} | null;

// Top nav adapts to viewport:
// - Mobile: brand wordmark + search-icon link + cart icon. Primary navigation
//   lives in the BottomNav. Keeps the header tiny so it doesn't compete.
// - Desktop: brand + full search bar + Feed/Wishlist/Messages + cart + account chip.
//   The avatar/name routes to the user's role dashboard (Seller / Designer /
//   Account) — no separate Seller or Designer nav links.
export async function TopNav({ user }: { user: NavUser }) {
  let cartCount = 0;
  if (user) {
    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: { items: { select: { quantity: true } } },
    });
    cartCount = cart?.items.reduce((n, it) => n + it.quantity, 0) ?? 0;
  }

  return (
    // `overflow-x-clip` keeps any wide child (account name, currency chip)
    // from making the whole page horizontally scrollable on small phones.
    <header className="sticky top-0 z-20 overflow-x-clip border-b border-ink-100 bg-white/85 backdrop-blur-xl dark:border-ink-700 dark:bg-ink-900/85">
      <div className="mx-auto flex w-full max-w-[1800px] items-center gap-2 px-3 py-3 sm:gap-3 sm:px-6 lg:px-10">
        {/* Brand — icon-only below sm, full wordmark from sm up. */}
        <Link
          href="/"
          aria-label="StreekMart home"
          className="flex shrink-0 items-center gap-2"
        >
          <span className="sm:hidden">
            <Logo size={28} showWordmark={false} />
          </span>
          <span className="hidden sm:inline-flex">
            <Logo size={28} />
          </span>
          <span className="hidden text-[11px] font-medium uppercase tracking-[0.3em] text-ink-400 lg:inline">
            · fashion
          </span>
        </Link>

        {/* Desktop search — full-width center. */}
        <form action="/search" method="get" className="hidden max-w-2xl flex-1 md:block">
          <div className="relative">
            <input
              name="q"
              placeholder="Search fabrics, clothing, designers…"
              className="input w-full pl-10"
            />
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </div>
        </form>

        {/* Right cluster — pushed to the end on mobile, secondary nav on desktop.
            min-w-0 lets the inner items shrink instead of forcing horizontal
            overflow. shrink-0 on each child below opts back IN where needed. */}
        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2 md:gap-3">
          {/* Mobile-only search icon */}
          <Link
            href="/search"
            className="rounded-lg p-2 text-ink-600 hover:bg-ink-50 hover:text-violet-700 dark:text-ink-300 dark:hover:bg-ink-700 dark:hover:text-violet-300 md:hidden"
            aria-label="Search"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </Link>

          {/* Desktop secondary nav: Feed / Wishlist / Messages — no role dashboards
              (those live behind the avatar). */}
          <nav className="hidden items-center gap-1 text-sm lg:flex">
            <Link href="/feed" className="btn-ghost px-2.5 py-1.5 text-sm">Feed</Link>
            {user && (
              <>
                <Link href="/wishlist" className="btn-ghost px-2.5 py-1.5 text-sm">Wishlist</Link>
                <Link href="/messages" className="btn-ghost px-2.5 py-1.5 text-sm">Messages</Link>
              </>
            )}
          </nav>

          {/* Currency selector hidden while NGN is the only display currency.
              Re-enable when multi-currency display is reintroduced. */}
          {/* <CurrencySelector /> */}

          <ThemeToggle />

          {user ? (
            <>
              <div className="hidden sm:block">
                <CartIcon initialCount={cartCount} />
              </div>
              {/*
                Avatar chip routes to the user's role dashboard:
                  - Seller (or Seller+Designer) → /seller
                  - Designer only → /designer
                  - Buyer only → /account
                If a user has both Seller and Designer permissions, the chip
                opens a dropdown so they can pick which dashboard.
              */}
              <AccountChip user={user} />
              <span className="hidden lg:inline">
                <LogoutButton />
              </span>
            </>
          ) : (
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <Link
                href="/login"
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50 hover:text-violet-700 dark:text-ink-200 dark:hover:bg-ink-700 dark:hover:text-violet-300 sm:px-3 sm:text-sm"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 sm:px-3 sm:text-sm"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
