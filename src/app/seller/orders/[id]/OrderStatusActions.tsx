"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const NEXT: Record<string, { label: string; status: string }[]> = {
  PENDING:   [{ label: "Mark paid", status: "PAID" }, { label: "Cancel", status: "CANCELLED" }],
  PAID:      [{ label: "Mark shipped", status: "SHIPPED" }, { label: "Cancel", status: "CANCELLED" }],
  SHIPPED:   [{ label: "Mark completed", status: "COMPLETED" }],
  COMPLETED: [],
  CANCELLED: [],
};

export function OrderStatusActions({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const actions = NEXT[status] ?? [];

  async function set(next: string) {
    setBusy(true);
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (actions.length === 0) {
    return <p className="mt-3 text-xs text-gray-500">No further actions.</p>;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((a) => (
        <button
          key={a.status}
          type="button"
          onClick={() => set(a.status)}
          disabled={busy}
          className={a.status === "CANCELLED" ? "btn-danger text-xs" : "btn-primary text-xs"}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
