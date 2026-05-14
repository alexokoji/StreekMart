"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WishlistToggle({
  productId,
  initialSaved,
}: {
  productId: string;
  initialSaved: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "product", id: productId }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setSaved(!!data.saved);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white shadow-sm transition-colors hover:border-gold-500 ${
        saved ? "text-burgundy-700" : "text-ink-400"
      }`}
      aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
    >
      <svg viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    </button>
  );
}
