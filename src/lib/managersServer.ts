// Server-only manager / rider helpers.
//
// All of these touch prisma, so they MUST NOT be imported from a client
// component. Client code imports the pure types + labels from
// src/lib/managers.ts; server code (API routes, server components)
// imports the data-access helpers from here.

import { prisma } from "./db";
import { parsePermissions, type PermissionKey } from "./managers";

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
    role: r.role,
    permissions: parsePermissions(r.permissionsJson),
  }));
}

// Returns just the owner IDs a user is a rider for. Empty list means the
// user isn't a delivery rider anywhere — used by /rider to gate the page.
export async function listRiderOwnerIds(managerId: string): Promise<string[]> {
  const rows = await prisma.manager.findMany({
    where: { managerId, role: "rider" },
    select: { ownerId: true },
  });
  return rows.map((r) => r.ownerId);
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
