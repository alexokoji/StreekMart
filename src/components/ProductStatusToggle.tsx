"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Inline iOS-style toggle for sellers/designers to flip a product between
// ACTIVE (live on the storefront) and SOLD_OUT (delisted). For longer-term
// hides ("ARCHIVED") use the full edit form.
export function ProductStatusToggle({
  productId,
  initialStatus,
}: {
  productId: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const live = status === "ACTIVE";

  async function flip() {
    const next = live ? "SOLD_OUT" : "ACTIVE";
    setBusy(true);
    try {
      const res = await fetch(`/api/products/${productId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        setStatus(next);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={flip}
        disabled={busy}
        aria-pressed={live}
        aria-label={live ? "Listing live — tap to delist" : "Delisted — tap to relist"}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          live
            ? "bg-gradient-to-r from-violet-600 to-fuchsia-500"
            : "bg-ink-300"
        } disabled:opacity-50`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
            live ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
        {live ? "Live" : "Delisted"}
      </span>
    </div>
  );
}
