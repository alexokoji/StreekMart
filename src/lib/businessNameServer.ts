// Server-only counterpart to lib/businessName.ts. Anything that needs to
// touch the DB lives here so the client bundle never imports prisma
// (which would drag the libsql adapter — and its non-JS README/LICENSE
// files — into webpack).

import { prisma } from "./db";

// Returns true if someone other than `selfId` already owns this name.
// Self-collision (the same user re-saving the same value) returns false.
export async function isBusinessNameTaken(
  lower: string,
  selfId?: string,
): Promise<boolean> {
  const owner = await prisma.user.findUnique({
    where: { businessNameLower: lower },
    select: { id: true },
  });
  if (!owner) return false;
  return owner.id !== selfId;
}
