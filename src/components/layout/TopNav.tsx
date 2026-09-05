import Link from "next/link";
import { prisma } from "@/lib/db";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "./LogoutButton";
import { CartIcon } from "./CartIcon";
import { AccountChip } from "./AccountChip";
import { ThemeToggle } from "./ThemeToggle";
import { NavCategoryRow } from "./NavCategoryRow";
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

// Two-row storefront header.
//
// Row 1: brand · pill search (desktop) · labelled action cluster
//        (Account / Wishlist / Cart) — the icon+label pattern shoppers
//        expect on a marketplace, replacing the older bare-icon row.
// Row 2: category navigation (desktop only) with an active underline.
//
// Mobile keeps row 1 compact — a search icon stands in for the search bar
// and primary navigation lives in the BottomNav, so the header never
// competes with content on a phone.
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
    <header className="sticky top-0 z-20 overflow-x-clip border-b border-ink-100 bg-white/90 backdrop-blur-xl dark:border-ink-700 dark:bg-ink-900/90">
      {/* ---------------- Row 1 ---------------- */}
      <div className="mx-auto flex w-full max-w-[1800px] items-center gap-3 px-3 py-3 sm:gap-5 sm:px-6 lg:px-10">
        {/* Brand — icon-only below sm, full wordmark from sm up. */}
        <Link href="/" aria-label="StreekMart home" className="flex shrink-0 items-center gap-2">
          <span className="sm:hidden">
            <Logo size={28} showWordmark={false} />
          </span>
          <span className="hidden sm:inline-flex">
            <Logo size={30} />
          </span>
        </Link>

        {/* Desktop search — pill field with a solid submit button, centred. */}
        <form action="/search" method="get" className="hidden max-w-2xl flex-1 md:block">
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              name="q"
              placeholder="Search fabrics, clothing, designers…"
              className="w-full rounded-full border border-ink-200 bg-ink-50 py-2.5 pl-11 pr-28 text-sm transition-all focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-200/60 dark:border-ink-600 dark:bg-ink-800 dark:text-white dark:placeholder:text-ink-400 dark:focus:bg-ink-700"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-violet-600 px-5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700"
            >
              Search
            </button>
          </div>
        </form>

        {/* Action cluster — pushed to the end. min-w-0 lets children shrink
            instead of forcing horizontal overflow. */}
        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2 md:gap-4">
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

          <ThemeToggle />

          {user ? (
            <>
              <NavAction href="/wishlist" label="Wishlist" className="hidden lg:flex">
                <HeartGlyph />
              </NavAction>
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
                className="rounded-full px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50 hover:text-violet-700 dark:text-ink-200 dark:hover:bg-ink-700 dark:hover:text-violet-300 sm:text-sm"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 sm:text-sm"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Row 2: category nav (desktop) ---------------- */}
      <NavCategoryRow signedIn={!!user} />
    </header>
  );
}

function NavAction({
  href,
  label,
  children,
  className = "",
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-medium text-ink-600 transition-colors hover:text-violet-700 dark:text-ink-300 dark:hover:text-violet-300 ${className}`}
    >
      {children}
      <span>{label}</span>
    </Link>
  );
}

function HeartGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20s-7-4.4-7-9.3A4 4 0 0112 8a4 4 0 017 2.7c0 4.9-7 9.3-7 9.3z" />
    </svg>
  );
}
