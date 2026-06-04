import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import {
  ADMIN_PERMISSIONS,
  sanitisePermissions,
} from "@/lib/staffPermissions";

// GET  /api/admin/staff           → list current staff + super-admins
// POST /api/admin/staff { email, permissions[] } → flag an existing user
//                                   as staff with the given permissions
//
// Onboarding a new staffer:
//   1. They register on the site as a normal account.
//   2. An admin (or someone with `manage-staff` permission) POSTs here with
//      their email and the perms to grant.
//   3. The user can now reach /admin/* pages they have perms for.
//
// We don't auto-create accounts here — that would let an admin generate
// inboxes the recipient didn't sign up for. The staff member must already
// hold a real account.

const PostBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  permissions: z.array(z.string()).default([]),
});

export async function GET() {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_STAFF);
  if ("error" in guard) return guard.error;

  // Super-admins listed alongside staff so a manager-of-staff sees the
  // full org chart, not just their own scope.
  const staff = await prisma.user.findMany({
    where: { OR: [{ isAdmin: true }, { isStaff: true }] },
    orderBy: [{ isAdmin: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      isAdmin: true,
      isStaff: true,
      staffPermissionsJson: true,
    },
  });
  return NextResponse.json({ staff });
}

export async function POST(req: Request) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_STAFF);
  if ("error" in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = PostBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, name: true, isAdmin: true, isStaff: true, suspendedAt: true },
  });
  if (!user) {
    return NextResponse.json(
      { error: "No account found with that email. Ask the staffer to register first." },
      { status: 404 },
    );
  }
  if (user.suspendedAt) {
    return NextResponse.json(
      { error: "That account is suspended — reinstate before promoting to staff." },
      { status: 400 },
    );
  }
  if (user.isAdmin) {
    return NextResponse.json(
      { error: "That user is already a super-admin." },
      { status: 400 },
    );
  }

  const clean = sanitisePermissions(parsed.data.permissions);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      isStaff: true,
      staffPermissionsJson: JSON.stringify(clean),
    },
  });
  return NextResponse.json({ ok: true, granted: clean });
}
