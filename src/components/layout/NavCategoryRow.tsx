"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// Desktop category row under the main header. Mirrors the primary shopping
// paths so a buyer can jump straight to a department instead of going
// through search. Active item gets a violet underline.
//
// Hidden on mobile — the BottomNav owns primary navigation there, and a
// second header row would eat too much of a phone viewport.
const LINKS: Array<{ label: string; href: string; match: (path: string, category: string | null) => boolean }> = [
  { label: "Home", href: "/", match: (p, c) => p === "/" && !c },
  { label: "Shop", href: "/products/featured", match: (p) => p.startsWith("/products/featured") },
  { label: "Clothing", href: "/?category=Tops", match: (_p, c) => c === "Tops" },
  { label: "Fabrics", href: "/products/trending-fabrics", match: (p) => p.startsWith("/products/trending-fabrics") },
  { label: "Accessories", href: "/?category=Fashion%20Accessory", match: (_p, c) => c === "Fashion Accessory" },
  { label: "New in", href: "/products/new-arrivals", match: (p) => p.startsWith("/products/new-arrivals") },
  { label: "Deals", href: "/products/flash-sales", match: (p) => p.startsWith("/products/flash-sales") },
  { label: "Designers", href: "/feed", match: (p) => p.startsWith("/feed") },
];

export function NavCategoryRow({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname() ?? "/";
  const category = useSearchParams()?.get("category") ?? null;

  return (
    <nav
      aria-label="Categories"
      className="hidden border-t border-ink-100 dark:border-ink-700 md:block"
    >
      <div className="mx-auto flex w-full max-w-[1800px] items-center gap-1 px-6 lg:px-10">
        {LINKS.map((l) => {
          const active = l.match(pathname, category);
          return (
            <Link
              key={l.label}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`relative px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "font-semibold text-violet-700 dark:text-violet-300"
                  : "text-ink-600 hover:text-violet-700 dark:text-ink-300 dark:hover:text-violet-300"
              }`}
            >
              {l.label}
              {active && (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-violet-600 dark:bg-violet-400" />
              )}
            </Link>
          );
        })}

        {signedIn && (
          <Link
            href="/messages"
            className="ml-auto px-3 py-2.5 text-sm text-ink-600 transition-colors hover:text-violet-700 dark:text-ink-300 dark:hover:text-violet-300"
          >
            Messages
          </Link>
        )}
      </div>
    </nav>
  );
}
