// Account / shop manager permission system.
//
// Sellers and designers can grant a separate User account ("the manager") a
// scoped set of capabilities on their store/portfolio. The manager logs in
// with their own credentials; whenever they act, route handlers check
// `effectiveOwner(user)` to figure out *whose* data they're touching, and
// `hasManagerPermission(user, owner, key)` to confirm they're allowed.

import { prisma } from "./db";

// The full vocabulary of permissions. Add to this list to expand what
// managers can do; UI checkboxes generate from PERMISSION_KEYS.
export const PERMISSION_KEYS = [
  // Seller-side
  "edit_products",
  "manage_orders",
  "manage_promotions",
  // Designer-side
  "post",
  "edit_post",
  "use_sketch_studio",
  // Shared
  "reply_messages",
  "view_wallet",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  edit_products: "Add / edit products",
  manage_orders: "Manage orders",
  manage_promotions: "Run promotions",
  post: "Publish portfolio posts",
  edit_post: "Edit / delete posts",
  use_sketch_studio: "Use the Sketch Studio",
  reply_messages: "Reply to messages",
  view_wallet: "View the wallet (read-only)",
};

// Parse the JSON column on Manager.permissionsJson into a typed array.
export function parsePermissions(json: string): PermissionKey[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k): k is PermissionKey =>
      (PERMISSION_KEYS as readonly string[]).includes(k),
    );
  } catch {
    return [];
  }
}

// Returns every (owner, permissions[]) pair the given user can act on as
// a manager. Cheap query — Manager rows are sparse.
export async function listManagedAccounts(managerId: string) {
  const rows = await prisma.manager.findMany({
    where: { managerId },
    include: {
      owner: {
        select: { id: true, name: true, isSeller: true, isDesigner: true },
      },
    },
  });
  return rows.map((r) => ({
    ownerId: r.ownerId,
    owner: r.owner,
    permissions: parsePermissions(r.permissionsJson),
  }));
}

// Convenience: does `actorId` have permission `key` on `ownerId`'s store?
// Owners always pass for their own data.
export async function hasManagerPermission(
  actorId: string,
  ownerId: string,
  key: PermissionKey,
): Promise<boolean> {
  if (actorId === ownerId) return true;
  const link = await prisma.manager.findUnique({
    where: { ownerId_managerId: { ownerId, managerId: actorId } },
  });
  if (!link) return false;
  return parsePermissions(link.permissionsJson).includes(key);
}

// Resolve the *acting owner* for a write request. The actor either:
//   - omits `actAsOwnerId` (or sets it to themselves) → they're the owner.
//   - passes a different `actAsOwnerId` → they're acting as a manager and
//     must hold `key` on that owner.
// Returns the resolved owner ID on success, or null if the actor is not
// authorised. Callers should 403 on null.
export async function resolveActingOwner(
  actorId: string,
  actAsOwnerId: string | undefined,
  key: PermissionKey,
): Promise<string | null> {
  const ownerId = actAsOwnerId ?? actorId;
  if (ownerId === actorId) return actorId;
  const ok = await hasManagerPermission(actorId, ownerId, key);
  return ok ? ownerId : null;
}
