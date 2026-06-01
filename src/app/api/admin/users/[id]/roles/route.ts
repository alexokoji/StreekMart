import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { sendEmail, roleChangeDecisionEmail } from "@/lib/email";
import { sendPush } from "@/lib/notifications";

// PATCH /api/admin/users/[id]/roles { isSeller, isDesigner }
//
// Admin-direct role mutation. Bypasses the user-initiated
// RoleChangeRequest queue — an admin can flip any user's role flags
// without a corresponding request. The mutated user still gets the same
// "your dashboard is live" email + push as if it had gone through the
// normal approval path.

const Body = z.object({
  isSeller: z.boolean(),
  isDesigner: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin();
  if ("error" in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, email: true, isSeller: true, isDesigner: true, isAdmin: true },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Soft-guard: don't strip a user's admin flag through this endpoint —
  // the admin role uses a separate mechanism. If admin needs to remove
  // another admin, they should do it explicitly through a different path
  // (deliberately not built yet — manual DB edit on purpose).
  if (target.isAdmin) {
    return NextResponse.json(
      { error: "Use a different path to mutate admin roles." },
      { status: 400 },
    );
  }

  if (
    target.isSeller === parsed.data.isSeller &&
    target.isDesigner === parsed.data.isDesigner
  ) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  await prisma.user.update({
    where: { id: target.id },
    data: {
      isSeller: parsed.data.isSeller,
      isDesigner: parsed.data.isDesigner,
    },
  });

  // Notify the target — feels less like a surprise when admin flipped a
  // role for them. Same template as the request-approval path.
  const newRoles = [
    parsed.data.isSeller && "Seller",
    parsed.data.isDesigner && "Designer",
  ].filter(Boolean) as string[];
  const tpl = roleChangeDecisionEmail({
    name: target.name,
    approved: true,
    newRoles,
    note: parsed.data.note,
  });
  void sendEmail({ to: target.email, ...tpl }).catch((err) =>
    console.error("[email:role-set] threw", { userId: target.id, err }),
  );
  void sendPush({
    userId: target.id,
    title: "Your role has been updated",
    body: `You now have access as ${newRoles.length === 0 ? "Buyer" : newRoles.join(" · ")}.`,
    link: newRoles.includes("Seller")
      ? "/seller"
      : newRoles.includes("Designer")
        ? "/designer"
        : "/account",
    data: { type: "role-change-decision", decision: "APPROVED", admin: true },
  }).catch((err) =>
    console.error("[push:role-set] threw", { userId: target.id, err }),
  );

  return NextResponse.json({ ok: true });
}
