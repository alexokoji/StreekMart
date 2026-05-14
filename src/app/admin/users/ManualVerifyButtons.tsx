"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Per-user verify/unverify toggles for the admin user list.
// Hits /api/admin/users/[id]/verify with the appropriate kind+value.
export function ManualVerifyButtons({
  userId,
  isSeller,
  isDesigner,
  sellerVerified,
  designerVerified,
}: {
  userId: string;
  isSeller: boolean;
  isDesigner: boolean;
  sellerVerified: boolean;
  designerVerified: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function flip(kind: "SELLER" | "DESIGNER", value: boolean) {
    setBusy(kind);
    try {
      const res = await fetch(`/api/admin/users/${userId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, value }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {isSeller && (
        <button
          type="button"
          className={sellerVerified ? "btn-secondary text-xs" : "btn-primary text-xs"}
          onClick={() => flip("SELLER", !sellerVerified)}
          disabled={busy !== null}
        >
          {sellerVerified ? "Unverify seller" : "Verify seller"}
        </button>
      )}
      {isDesigner && (
        <button
          type="button"
          className={designerVerified ? "btn-secondary text-xs" : "btn-primary text-xs"}
          onClick={() => flip("DESIGNER", !designerVerified)}
          disabled={busy !== null}
        >
          {designerVerified ? "Unverify designer" : "Verify designer"}
        </button>
      )}
    </div>
  );
}
