import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import {
  ADMIN_PERMISSIONS,
  sanitisePermissions,
} from "@/lib/staffPermissions";

// PATCH  /api/admin/staff/[id] { permissions[] } → replace the staffer's
//                                                  permission set
// DELETE /api/admin/staff/[id]                  → demote back to a regular
//                                                  user (clears isStaff +
//                                                  perm list)
//
// Both routes are gated on `manage-staff`. They explicitly refuse to touch
// `isAdmin: true` accounts — super-admins are not editable via the staff
// UI; managing them is a manual DB operation on purpose.

const PatchBody = z.object({
  permissions: z.array(z.string()),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_STAFF);
  if ("error" in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, isAdmin: true, isStaff: true },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.isAdmin) {
    return NextResponse.json(
      { error: "Super-admin perms aren't editable here." },
      { status: 400 },
    );
  }
  if (!target.isStaff) {
    return NextResponse.json(
      { error: "That user isn't on staff. Add them via POST /api/admin/staff first." },
      { status: 400 },
    );
  }

  const clean = sanitisePermissions(parsed.data.permissions);
  await prisma.user.update({
    where: { id: target.id },
    data: { staffPermissionsJson: JSON.stringify(clean) },
  });
  return NextResponse.json({ ok: true, granted: clean });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_STAFF);
  if ("error" in guard) return guard.error;

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, isAdmin: true },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.isAdmin) {
    return NextResponse.json(
      { error: "Super-admins can't be demoted here." },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { isStaff: false, staffPermissionsJson: "[]" },
  });
  return NextResponse.json({ ok: true });
}
