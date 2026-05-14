"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BuyNowButton({ productId, authed, canBuy }: { productId: string; authed: boolean; canBuy: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!authed) {
    return (
      <button type="button" className="btn-primary" onClick={() => router.push("/login")}>
        Sign in to buy
      </button>
    );
  }
  if (!canBuy) {
    return <button disabled className="btn-primary opacity-60">Buyers only</button>;
  }

  async function buy() {
    setBusy(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Order placed! View it from the seller's dashboard or your favorites.");
        router.refresh();
      } else {
        alert(data.error ?? "Order failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn-primary" disabled={busy} onClick={buy}>
      {busy ? "Placing order…" : "Buy now"}
    </button>
  );
}
