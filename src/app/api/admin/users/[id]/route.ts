import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";

// DELETE /api/admin/users/[id]?confirm=<email>
//
// Hard-removes an account. Prisma's `onDelete: Cascade` on every relation
// targeting User wipes the user's products, posts, orders, messages,
// reviews, wallet, etc. — see the schema for the full list. There is no
// undo. Use suspend (PATCH /api/admin/users/[id]/suspend) for anything
// recoverable.
//
// To avoid accidental deletes from a misclick we require the caller to
// pass the target's exact email as `confirm`. The admin UI surfaces this
// in a typed confirmation; raw curl callers also have to type it.

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_USERS);
  if ("error" in guard) return guard.error;

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, isAdmin: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (target.id === guard.user.id) {
    return NextResponse.json(
      { error: "You can't delete your own account." },
      { status: 400 },
    );
  }
  if (target.isAdmin) {
    return NextResponse.json(
      { error: "Admins can't be deleted through this endpoint." },
      { status: 400 },
    );
  }

  const confirm = new URL(req.url).searchParams.get("confirm");
  if (!confirm || confirm.trim().toLowerCase() !== target.email.toLowerCase()) {
    return NextResponse.json(
      {
        error:
          "Pass `?confirm=<the user's email>` to confirm. This cascades and cannot be undone.",
      },
      { status: 400 },
    );
  }

  await prisma.user.delete({ where: { id: target.id } });
  return NextResponse.json({ ok: true });
}
