"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Admin moderation actions for a product row. Hits:
//   PATCH /api/admin/products/[id]   { status: "ACTIVE" | "ARCHIVED" }
//   DELETE /api/admin/products/[id]?confirm=<id>
//
// Archive is reversible — flipping back to ACTIVE restores the listing
// to every storefront surface. Remove is a cascade delete; the operator
// has to retype the product id as confirmation.
export function ProductModerationButtons({
  productId,
  productName,
  status,
}: {
  productId: string;
  productName: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const isArchived = status === "ARCHIVED";

  async function setStatus(next: "ACTIVE" | "ARCHIVED") {
    setBusy("status");
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Status change failed.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    const typed = window.prompt(
      `PERMANENTLY DELETE "${productName}"?\n\nThis cascades — reviews, favorites, likes, promotions, and cart entries referencing it are erased. Orders survive but lose their product link. There is no undo.\n\nType the product id to confirm:\n${productId}`,
      "",
    );
    if (!typed) return;
    if (typed.trim() !== productId) {
      alert("Product id did not match. Nothing was deleted.");
      return;
    }
    setBusy("delete");
    try {
      const res = await fetch(
        `/api/admin/products/${productId}?confirm=${encodeURIComponent(typed)}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Delete failed.");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {isArchived ? (
        <button
          type="button"
          className="text-xs font-medium text-emerald-700 hover:underline"
          onClick={() => setStatus("ACTIVE")}
          disabled={busy !== null}
        >
          Restore
        </button>
      ) : (
        <button
          type="button"
          className="text-xs font-medium text-amber-700 hover:underline"
          onClick={() => setStatus("ARCHIVED")}
          disabled={busy !== null}
        >
          Disable
        </button>
      )}
      <button
        type="button"
        className="text-xs font-medium text-red-600 hover:underline"
        onClick={remove}
        disabled={busy !== null}
      >
        Remove
      </button>
    </div>
  );
}
