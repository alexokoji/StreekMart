"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Cart icon with a live count badge. Listens for `upclo:cart-changed` events
// dispatched by AddToCartButton / CartClient so the badge updates without a
// full page reload.
export function CartIcon({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    async function refresh() {
      try {
        const res = await fetch("/api/cart");
        if (!res.ok) return;
        const data = await res.json();
        setCount(typeof data.itemCount === "number" ? data.itemCount : 0);
      } catch {
        /* ignore */
      }
    }
    const handler = () => refresh();
    window.addEventListener("upclo:cart-changed", handler);
    return () => window.removeEventListener("upclo:cart-changed", handler);
  }, []);

  return (
    <Link href="/cart" className="relative flex items-center" aria-label={`Cart (${count} items)`}>
      <svg className="h-6 w-6 text-gray-700 hover:text-brand-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.5-5M7 13l-2 7m12-7l2 7M9 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
