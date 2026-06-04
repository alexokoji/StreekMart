import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import {
  accountReinstatedEmail,
  accountSuspendedEmail,
  sendEmail,
} from "@/lib/email";

// PATCH /api/admin/users/[id]/suspend { suspend: boolean, reason?: string }
//
// Soft-suspends an account (reversible). Suspended users can't sign in,
// active sessions are invalidated at the next request via the auth gate,
// and their published products/posts continue to exist but are filtered
// out of every public surface alongside the storefront's ACTIVE-status
// filter (sellers can't list new ones either because the suspension
// blocks the seller routes).
//
// `suspend: true` sets the columns + emails the user. `suspend: false`
// clears them + emails the user.

const Body = z.object({
  suspend: z.boolean(),
  reason: z.string().max(500).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_USERS);
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (target.id === guard.user.id) {
    return NextResponse.json(
      { error: "You can't suspend your own account." },
      { status: 400 },
    );
  }
  if (target.isAdmin) {
    return NextResponse.json(
      { error: "Admins can't be suspended through this endpoint." },
      { status: 400 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: parsed.data.suspend
      ? {
          suspendedAt: new Date(),
          suspendedBy: guard.user.id,
          suspensionReason: parsed.data.reason ?? null,
        }
      : {
          suspendedAt: null,
          suspendedBy: null,
          suspensionReason: null,
        },
    select: { id: true, name: true, email: true, suspendedAt: true },
  });

  // Notify the user. Fire-and-forget; the suspension itself is durable
  // even if email delivery fails. Errors land in [email:send] logs.
  const tpl = parsed.data.suspend
    ? accountSuspendedEmail({ name: updated.name, reason: parsed.data.reason })
    : accountReinstatedEmail(updated.name);
  void sendEmail({ to: updated.email, ...tpl })
    .then((r) => {
      if (!r.ok) console.error("[email:account-status] failed", { to: updated.email, error: r.error });
    })
    .catch((err) => console.error("[email:account-status] threw", { to: updated.email, err }));

  return NextResponse.json({ ok: true, user: updated });
}
