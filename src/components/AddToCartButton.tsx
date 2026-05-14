"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddToCartButton({
  productId,
  disabled,
  compact,
}: {
  productId: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);

  async function add() {
    setBusy(true);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      if (res.status === 401) {
        router.push("/login?redirect=" + encodeURIComponent(window.location.pathname));
        return;
      }
      if (res.ok) {
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
        // Trigger nav-bar count refresh.
        window.dispatchEvent(new CustomEvent("upclo:cart-changed"));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Couldn't add to cart");
      }
    } finally {
      setBusy(false);
    }
  }

  if (disabled) {
    return (
      <button disabled className={`btn-secondary ${compact ? "text-xs" : ""} opacity-60`}>
        Your listing
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`btn-primary w-full ${compact ? "text-xs" : ""}`}
      disabled={busy}
      onClick={add}
    >
      {busy ? "Adding…" : added ? "✓ Added" : "Add to cart"}
    </button>
  );
}
