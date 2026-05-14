"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Props = {
  user: {
    id: string;
    name: string;
    isSeller: boolean;
    isDesigner: boolean;
    isAdmin?: boolean;
  };
};

// Avatar chip in the desktop top nav. Behavior:
//  - Single-role (or buyer-only) users: chip is a direct link to their
//    role dashboard (/seller, /designer, or /account).
//  - Both Seller AND Designer: the chip opens a small dropdown so the
//    user can pick which dashboard to enter; covers the "I want to switch
//    contexts" case without exposing a second top-level nav link.
export function AccountChip({ user }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const initial = user.name.slice(0, 1).toUpperCase();
  const firstName = user.name.split(" ")[0];

  // Single-role / no-role users without admin: plain link.
  if (!user.isAdmin && !(user.isSeller && user.isDesigner)) {
    const href = user.isSeller ? "/seller" : user.isDesigner ? "/designer" : "/account";
    return (
      <Link
        href={href}
        className="hidden items-center gap-2 rounded-full border border-ink-200 px-2.5 py-1 text-sm hover:border-violet-400 sm:flex"
      >
        <Avatar initial={initial} />
        <span className="hidden text-ink-700 lg:inline">{firstName}</span>
      </Link>
    );
  }

  // Pro account — dropdown.
  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-ink-200 px-2.5 py-1 text-sm hover:border-violet-400"
      >
        <Avatar initial={initial} />
        <span className="hidden text-ink-700 lg:inline">{firstName}</span>
        <svg viewBox="0 0 24 24" className="hidden h-3 w-3 text-ink-400 lg:inline" fill="currentColor">
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-ink-100 bg-white shadow-soft"
        >
          <div className="border-b border-ink-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-ink-500">
            {firstName}&apos;s dashboards
          </div>
          {user.isSeller && (
            <MenuLink href="/seller" label="Seller dashboard" hint="Manage products & orders" />
          )}
          {user.isDesigner && (
            <MenuLink href="/designer" label="Designer dashboard" hint="Posts, sketches, products" />
          )}
          <MenuLink href="/account" label="Buyer view" hint="Cart, wishlist, history" />
          {user.isAdmin && (
            <MenuLink href="/admin" label="Admin · Control room" hint="Verifications, users, fees" />
          )}
        </div>
      )}
    </div>
  );
}

function Avatar({ initial }: { initial: string }) {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white">
      {initial}
    </span>
  );
}

function MenuLink({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 text-sm text-ink-800 hover:bg-violet-50 hover:text-violet-700"
    >
      <span className="block font-medium">{label}</span>
      <span className="block text-[11px] text-ink-500">{hint}</span>
    </Link>
  );
}
