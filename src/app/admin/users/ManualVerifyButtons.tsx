"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Per-user moderation controls for the admin user list. Hits:
//   PATCH /api/admin/users/[id]/verify       (verify/unverify role)
//   PATCH /api/admin/users/[id]/tier         (set seller/designer tier 1/2/3)
//   PATCH /api/admin/users/[id]/roles        (admin-direct role flip)
//   PATCH /api/admin/users/[id]/affiliation  (streekmart-affiliated toggle)
//   PATCH /api/admin/users/[id]/suspend      (soft suspend/reinstate)
//   DELETE /api/admin/users/[id]             (hard cascade delete)
//
// Suspend prompts for an optional reason (sent in the suspension email).
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
  sellerTier,
  designerTier,
  streekmartAffiliated,
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
  sellerTier: number;
  designerTier: number;
  streekmartAffiliated: boolean;
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

  async function setTier(kind: "SELLER" | "DESIGNER", tier: 1 | 2 | 3) {
    // Confirm downgrades — the perks (product cap, withdrawal fee) drop and
    // a Tier 3 → lower change in particular should be deliberate.
    const current = kind === "SELLER" ? sellerTier : designerTier;
    if (tier < current) {
      const label = kind === "SELLER" ? "seller" : "designer";
      if (!window.confirm(`Downgrade ${name}'s ${label} tier from ${current} to ${tier}? They'll be notified by email.`)) {
        return;
      }
    }
    setBusy(`tier-${kind}`);
    try {
      const res = await fetch(`/api/admin/users/${userId}/tier`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, tier }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Tier change failed.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function setRoles(nextSeller: boolean, nextDesigner: boolean) {
    const label = (nextSeller ? "Seller" : "") + (nextSeller && nextDesigner ? " · " : "") + (nextDesigner ? "Designer" : "");
    if (
      !window.confirm(
        `Set ${name}'s role to ${label || "Buyer only"}? They'll be notified by email.`,
      )
    ) {
      return;
    }
    setBusy("roles");
    try {
      const res = await fetch(`/api/admin/users/${userId}/roles`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSeller: nextSeller, isDesigner: nextDesigner }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Role change failed.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function toggleAffiliation() {
    const next = !streekmartAffiliated;
    const verb = next ? "mark as StreekMart-affiliated" : "remove affiliation from";
    if (!window.confirm(`${verb} ${name}?\n\nAffiliated sellers skip escrow — payments land in their withdrawable wallet immediately on PAID.`)) {
      return;
    }
    setBusy("affiliation");
    try {
      const res = await fetch(`/api/admin/users/${userId}/affiliation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affiliated: next }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Affiliation change failed.");
      }
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
        <>
          <button
            type="button"
            className={sellerVerified ? "btn-secondary text-xs" : "btn-primary text-xs"}
            onClick={() => flip("SELLER", !sellerVerified)}
            disabled={busy !== null}
          >
            {sellerVerified ? "Unverify seller" : "Verify seller"}
          </button>
          <TierSelect
            label="Seller tier"
            kind="SELLER"
            value={sellerTier}
            disabled={busy !== null}
            onChange={(t) => setTier("SELLER", t)}
          />
        </>
      )}
      {isDesigner && (
        <>
          <button
            type="button"
            className={designerVerified ? "btn-secondary text-xs" : "btn-primary text-xs"}
            onClick={() => flip("DESIGNER", !designerVerified)}
            disabled={busy !== null}
          >
            {designerVerified ? "Unverify designer" : "Verify designer"}
          </button>
          <TierSelect
            label="Designer tier"
            kind="DESIGNER"
            value={designerTier}
            disabled={busy !== null}
            onChange={(t) => setTier("DESIGNER", t)}
          />
        </>
      )}
      {/* Admin-direct role flip. Independent of the user-initiated
          /admin/role-changes queue — lets the admin bestow a role without
          a corresponding request. Hidden for the admin row itself. */}
      {!isAdmin && (
        <RoleSelect
          isSeller={isSeller}
          isDesigner={isDesigner}
          disabled={busy !== null}
          onChange={(s, d) => setRoles(s, d)}
        />
      )}
      {/* Affiliation toggle. Only meaningful when the user is a seller /
          designer; the server also enforces this. */}
      {(isSeller || isDesigner) && !isAdmin && (
        <button
          type="button"
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            streekmartAffiliated
              ? "border-gold-500 bg-gold-50 text-gold-800"
              : "border-ink-200 bg-white text-ink-600 hover:border-violet-300"
          }`}
          onClick={toggleAffiliation}
          disabled={busy !== null}
          title="Skip escrow — pay direct to wallet"
        >
          {streekmartAffiliated ? "★ Affiliated" : "Affiliate"}
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

// Admin-direct role selector. Picks any combination of seller / designer
// and fires the PATCH on change. Selecting the same value is a no-op on
// the server (returns `unchanged: true`), so we don't need an Apply button.
function RoleSelect({
  isSeller,
  isDesigner,
  disabled,
  onChange,
}: {
  isSeller: boolean;
  isDesigner: boolean;
  disabled: boolean;
  onChange: (nextSeller: boolean, nextDesigner: boolean) => void;
}) {
  const value =
    isSeller && isDesigner ? "SD" : isSeller ? "S" : isDesigner ? "D" : "B";
  return (
    <label className="inline-flex items-center gap-1 text-[11px] text-ink-500">
      <span className="sr-only">Role</span>
      <select
        aria-label="Role"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "S" || v === "SD", v === "D" || v === "SD");
        }}
        className="rounded-md border border-ink-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-ink-700 disabled:opacity-50"
        title="Set role"
      >
        <option value="B">Buyer only</option>
        <option value="S">Seller</option>
        <option value="D">Designer</option>
        <option value="SD">Seller · Designer</option>
      </select>
    </label>
  );
}

// Compact tier dropdown rendered next to the verify button. Picking the
// same tier that's already set is a no-op on the server (the route returns
// `unchanged: true`) so changing the visible value is the only signal we
// need from the dropdown — no separate Apply button.
function TierSelect({
  label,
  kind,
  value,
  disabled,
  onChange,
}: {
  label: string;
  kind: "SELLER" | "DESIGNER";
  value: number;
  disabled: boolean;
  onChange: (tier: 1 | 2 | 3) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1 text-[11px] text-ink-500">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (next === 1 || next === 2 || next === 3) onChange(next);
        }}
        className="rounded-md border border-ink-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-ink-700 disabled:opacity-50"
        title={`Set ${kind.toLowerCase()} tier`}
      >
        <option value={1}>T1 · Unverified</option>
        <option value={2}>T2 · Blue ✓</option>
        <option value={3}>T3 · Gold ★</option>
      </select>
    </label>
  );
}
