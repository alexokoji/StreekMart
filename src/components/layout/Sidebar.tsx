"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type SidebarItem = {
  href: string;
  label: string;
  matchExact?: boolean;
  // When set, the item renders as a non-clickable row with the badge
  // (e.g. "Coming soon") shown to the right. Used to advertise upcoming
  // features without breaking the sidebar layout.
  disabled?: boolean;
  badge?: string;
};

// Dashboard sidebar.
//
// Desktop (md+): inline column, always visible — same as before.
// Mobile: a slide-in drawer triggered by a sticky bar at the top of the
// dashboard area. The drawer auto-closes on navigation (pathname change),
// is dismissable by tapping the backdrop or the close button, and locks
// background scroll while open so the drawer feels like a native sheet.
export function Sidebar({ items, title }: { items: SidebarItem[]; title: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer on navigation. Without this, tapping a nav link would
  // route to the new page but leave the overlay covering the content.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open so the page underneath
  // doesn't scroll when you swipe inside the drawer.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Compute the active item's label for the mobile trigger badge.
  const activeLabel =
    items.find((it) =>
      it.matchExact ? pathname === it.href : pathname.startsWith(it.href),
    )?.label ?? title;

  return (
    <>
      {/* Mobile trigger — sticky bar that sits just below the TopNav and
          contains the hamburger + the current page name as a breadcrumb hint. */}
      <div className="sticky top-[3.4rem] z-20 -mx-4 mb-3 flex items-center justify-between border-b border-ink-100 bg-white/90 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Open ${title} menu`}
          aria-expanded={open}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-ink-800 hover:bg-ink-50"
        >
          <HamburgerIcon className="h-4 w-4" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-500">
            {title}
          </span>
        </button>
        <span className="line-clamp-1 text-xs text-ink-500">{activeLabel}</span>
      </div>

      {/* Backdrop (mobile only) */}
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink-900/50 backdrop-blur-sm md:hidden"
        />
      )}

      {/* The sidebar itself.
          Mobile: fixed slide-in drawer (transformed off-screen by default).
          Desktop: regular inline column inside the layout's flex row. */}
      <aside
        className={cn(
          "shrink-0 transition-transform duration-200 ease-out",
          // mobile drawer
          "fixed left-0 top-0 z-50 h-full w-72 bg-white shadow-soft",
          open ? "translate-x-0" : "-translate-x-full",
          // desktop inline
          "md:static md:z-auto md:h-auto md:w-56 md:translate-x-0 md:bg-transparent md:shadow-none",
        )}
        aria-hidden={!open ? undefined : false}
      >
        <div className="card h-full overflow-y-auto p-4 md:h-auto md:overflow-visible">
          <div className="mb-3 flex items-center justify-between px-2">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-500">
              {title}
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="-mr-1 rounded-md p-1.5 text-ink-500 hover:bg-ink-50 md:hidden"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
          <nav className="flex flex-col gap-1">
            {items.map((it) => {
              if (it.disabled) {
                return (
                  <div
                    key={it.href}
                    aria-disabled="true"
                    title={it.badge ?? "Coming soon"}
                    className="flex cursor-not-allowed items-center justify-between gap-2 rounded-md bg-gold-50/50 px-3 py-2 text-sm text-ink-600"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <ClockIcon className="h-3.5 w-3.5 shrink-0 text-gold-600" />
                      <span className="truncate">{it.label}</span>
                    </span>
                    {it.badge && (
                      <span className="shrink-0 text-[10px] font-medium italic text-gold-700">
                        {it.badge}
                      </span>
                    )}
                  </div>
                );
              }
              const active = it.matchExact
                ? pathname === it.href
                : pathname.startsWith(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-violet-50 font-medium text-violet-700"
                      : "text-ink-700 hover:bg-ink-50",
                  )}
                >
                  {it.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}

function HamburgerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M6 18L18 6" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
