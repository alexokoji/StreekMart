"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type NavUser = {
  id: string;
  name: string;
  email: string;
  isSeller: boolean;
  isDesigner: boolean;
} | null;

// App-style mobile bottom nav with a notched center FAB.
//
// Layout:
//   [ Shop ]  [ Feed ]   ◯   [ Cart ]  [ Me ]
//                       ↑ FAB sits in the notch above the bar
//
// The notch is a circular cutout at the top-center of the nav, made via a
// CSS `mask` so we don't have to ship an SVG. The FAB is a separate fixed
// element that overlaps the notch and dispatches a window event the
// SmartSearch component listens for.
export function BottomNav({ user }: { user: NavUser }) {
  const pathname = usePathname() ?? "/";
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch("/api/cart");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setCartCount(typeof data.itemCount === "number" ? data.itemCount : 0);
      } catch {
        /* ignore */
      }
    }
    refresh();
    const handler = () => refresh();
    window.addEventListener("upclo:cart-changed", handler);
    return () => {
      cancelled = true;
      window.removeEventListener("upclo:cart-changed", handler);
    };
  }, [user]);

  const left: Tab[] = [
    { href: "/", label: "Shop", icon: ShopIcon, match: (p) => p === "/" },
    { href: "/feed", label: "Feed", icon: FeedIcon, match: (p) => p.startsWith("/feed") },
  ];

  // The Account tab is smart: routes to the user's role dashboard if they
  // have one, otherwise the unified buyer account page (or login).
  const accountHref = user
    ? user.isSeller
      ? "/seller"
      : user.isDesigner
        ? "/designer"
        : "/account"
    : "/login";

  const right: Tab[] = [
    {
      href: user ? "/cart" : "/login",
      label: "Cart",
      icon: CartIcon,
      match: (p) => p.startsWith("/cart"),
      badge: user ? cartCount : 0,
    },
    {
      href: accountHref,
      label: user ? "Me" : "Sign in",
      icon: AccountIcon,
      match: (p) =>
        p.startsWith("/account") ||
        p.startsWith("/seller") ||
        p.startsWith("/designer") ||
        p.startsWith("/login") ||
        p.startsWith("/register"),
    },
  ];

  function openSearch() {
    window.dispatchEvent(new CustomEvent("upclo:open-search"));
  }

  return (
    <>
      {/* The bar itself — masked to carve out the notch */}
      <nav
        role="navigation"
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white pb-safe shadow-[0_-8px_30px_-12px_rgba(76,29,149,0.18)] dark:border-ink-700 dark:bg-ink-800 md:hidden"
        // The mask creates a 30px-radius circular cutout centered at the top.
        // Anything inside the cutout area is transparent — the FAB shows through.
        style={{
          WebkitMaskImage:
            "radial-gradient(circle 30px at 50% 0px, transparent 30px, black 31px)",
          maskImage:
            "radial-gradient(circle 30px at 50% 0px, transparent 30px, black 31px)",
        }}
      >
        <ul className="mx-auto grid max-w-md grid-cols-5 items-stretch">
          {left.map((t) => (
            <NavItem key={t.label} tab={t} pathname={pathname} />
          ))}
          {/* Empty slot at index 2 — the FAB sits over this column. */}
          <li aria-hidden="true" />
          {right.map((t) => (
            <NavItem key={t.label} tab={t} pathname={pathname} />
          ))}
        </ul>
      </nav>

      {/* Center FAB — sits in the notch above the bar. Opens SmartSearch.
          `clip-path: circle(50%)` makes the hit area an actual circle so
          the invisible corners of the bounding box don't intercept taps
          on adjacent nav columns on narrow screens. */}
      <button
        type="button"
        onClick={openSearch}
        aria-label="Open smart search"
        style={{ clipPath: "circle(50%)" }}
        className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] left-1/2 z-40 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-500 to-gold-400 text-white shadow-glow transition-transform active:scale-95 md:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </button>
    </>
  );
}

type Tab = {
  href: string;
  label: string;
  icon: (props: { active: boolean }) => JSX.Element;
  match: (pathname: string) => boolean;
  badge?: number;
};

function NavItem({ tab, pathname }: { tab: Tab; pathname: string }) {
  const Icon = tab.icon;
  const active = tab.match(pathname);
  // `flex` on the li + `w-full` on the Link makes the whole column a
  // single tap target — otherwise the Link only sizes to its icon+label
  // content (~60px wide) and the surrounding ~15px on each side does
  // nothing on tap. `relative z-10` puts the link above the masked nav
  // background so the cutout never eats clicks.
  return (
    <li className="relative z-10 flex">
      <Link
        href={tab.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex w-full flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
          active
            ? "text-violet-700 dark:text-violet-300"
            : "text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100",
        )}
      >
        <span className="relative">
          <Icon active={active} />
          {tab.badge !== undefined && tab.badge > 0 && (
            <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 px-1 text-[9px] font-bold text-white">
              {tab.badge > 99 ? "99+" : tab.badge}
            </span>
          )}
        </span>
        <span>{tab.label}</span>
        {active && (
          <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500" />
        )}
      </Link>
    </li>
  );
}

function ShopIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V21a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1V9.5z" fill={active ? "currentColor" : "none"} opacity={active ? 0.12 : 1} />
      <path d="M3 9.5L12 3l9 6.5V21a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1V9.5z" />
    </svg>
  );
}

function FeedIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="3" fill={active ? "currentColor" : "none"} opacity={active ? 0.12 : 1} />
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M7 9h10M7 13h10M7 17h6" />
    </svg>
  );
}

function CartIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h2l2.4 12.3a2 2 0 002 1.7H18a2 2 0 002-1.6L21.5 8H6" fill={active ? "currentColor" : "none"} opacity={active ? 0.12 : 1} />
      <path d="M3 4h2l2.4 12.3a2 2 0 002 1.7H18a2 2 0 002-1.6L21.5 8H6" />
      <circle cx="10" cy="21" r="1" />
      <circle cx="18" cy="21" r="1" />
    </svg>
  );
}

function AccountIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" fill={active ? "currentColor" : "none"} opacity={active ? 0.12 : 1} />
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4.5 5-7 8-7s6.5 2.5 8 7" />
    </svg>
  );
}
