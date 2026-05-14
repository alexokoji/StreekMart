import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { PERMISSION_KEYS, type PermissionKey } from "@/lib/managers";

// PATCH /api/managers/[id] { permissions } — update what a manager can do.
// DELETE /api/managers/[id] — revoke the manager link (their User account
//                              survives so they keep their login as a buyer).

const PatchBody = z.object({
  permissions: z.array(
    z.enum(PERMISSION_KEYS as readonly [PermissionKey, ...PermissionKey[]]),
  ),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const link = await prisma.manager.findUnique({ where: { id: params.id } });
  if (!link || link.ownerId !== guard.session.sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const updated = await prisma.manager.update({
    where: { id: link.id },
    data: { permissionsJson: JSON.stringify(parsed.data.permissions) },
  });
  return NextResponse.json({ ok: true, permissions: parsed.data.permissions, id: updated.id });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const link = await prisma.manager.findUnique({ where: { id: params.id } });
  if (!link || link.ownerId !== guard.session.sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.manager.delete({ where: { id: link.id } });
  return NextResponse.json({ ok: true });
}
