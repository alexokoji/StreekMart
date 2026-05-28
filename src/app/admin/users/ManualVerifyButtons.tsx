"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Per-user moderation controls for the admin user list. Hits:
//   PATCH /api/admin/users/[id]/verify   (verify/unverify role)
//   PATCH /api/admin/users/[id]/suspend  (soft suspend/reinstate)
//   DELETE /api/admin/users/[id]         (hard cascade delete)
//
// Suspend prompts for an optional reason (sent in the notification email).
// Delete requires the operator to retype the target's email — the server
// rejects the request without it.
export function ManualVerifyButtons({
  userId,
  email,
  name,
  isSeller,
  isDesigner,
  isAdmin,
  sellerVerified,
  designerVerified,
  suspendedAt,
}: {
  userId: string;
  email: string;
  name: string;
  isSeller: boolean;
  isDesigner: boolean;
  isAdmin: boolean;
  sellerVerified: boolean;
  designerVerified: boolean;
  suspendedAt: Date | string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const suspended = !!suspendedAt;

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

  async function suspend() {
    const reason = window.prompt(
      `Suspend ${name} (${email})?\n\nOptional reason (sent in the suspension email):`,
      "",
    );
    if (reason === null) return; // cancelled
    setBusy("suspend");
    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspend: true, reason: reason || undefined }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Suspend failed.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function reinstate() {
    if (!window.confirm(`Reinstate ${name} (${email})?`)) return;
    setBusy("reinstate");
    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspend: false }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Reinstate failed.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    const confirmEmail = window.prompt(
      `PERMANENTLY DELETE ${name}?\n\nThis cascades — all their products, posts, orders, messages, wallet, and reviews are erased. There is no undo.\n\nType the user's email to confirm: ${email}`,
      "",
    );
    if (!confirmEmail) return;
    if (confirmEmail.trim().toLowerCase() !== email.toLowerCase()) {
      alert("Email did not match. Nothing was deleted.");
      return;
    }
    setBusy("delete");
    try {
      const res = await fetch(
        `/api/admin/users/${userId}?confirm=${encodeURIComponent(confirmEmail)}`,
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
    <div className="flex flex-wrap items-center gap-2">
      {suspended && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
          Suspended
        </span>
      )}
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
      {/* Suspension is reversible; deletion isn't. Both hidden for admins
          so a misclick can't lock out the platform's own admin row. */}
      {!isAdmin && (
        suspended ? (
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={reinstate}
            disabled={busy !== null}
          >
            Reinstate
          </button>
        ) : (
          <button
            type="button"
            className="btn-secondary text-xs text-amber-700 hover:bg-amber-50"
            onClick={suspend}
            disabled={busy !== null}
          >
            Suspend
          </button>
        )
      )}
      {!isAdmin && (
        <button
          type="button"
          className="text-xs font-medium text-red-600 hover:underline"
          onClick={remove}
          disabled={busy !== null}
        >
          Remove
        </button>
      )}
    </div>
  );
}
