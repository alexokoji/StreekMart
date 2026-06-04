import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { sendEmail } from "@/lib/email";
import { sendPush } from "@/lib/notifications";

// PATCH /api/admin/users/[id]/affiliation { affiliated: boolean }
//
// Admin toggles a seller's StreekMart-affiliated status. Affiliated
// sellers:
//   - skip escrow (payment lands as withdrawable immediately on PAID,
//     not held until delivery confirmation) — see lib/orders.ts.
//   - keep their existing self-set delivery fees on the User row, which
//     the cart already honours. No extra flag-change needed for delivery
//     pricing.
//
// Only sellers / designers can be affiliated. A pure buyer toggle is
// rejected so the flag doesn't accidentally end up on accounts that have
// no commerce surface to use it on.

const Body = z.object({
  affiliated: z.boolean(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_USERS);
  if ("error" in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      isSeller: true,
      isDesigner: true,
      streekmartAffiliated: true,
    },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!target.isSeller && !target.isDesigner) {
    return NextResponse.json(
      { error: "Only sellers or designers can be marked as affiliated." },
      { status: 400 },
    );
  }
  if (target.streekmartAffiliated === parsed.data.affiliated) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { streekmartAffiliated: parsed.data.affiliated },
  });

  // Notify the seller — being granted (or revoked) affiliated status is a
  // meaningful change to their wallet behaviour.
  const subject = parsed.data.affiliated
    ? "You're now a StreekMart-affiliated seller"
    : "Affiliated status revoked";
  const body_text = parsed.data.affiliated
    ? `Hi ${target.name}, your account is now StreekMart-affiliated. Payments on new orders will land in your withdrawable wallet balance immediately instead of being held until delivery. You can continue to set your own delivery fees from your dashboard.`
    : `Hi ${target.name}, your StreekMart-affiliated status has been removed. New orders will go through the standard escrow process going forward.`;
  void sendEmail({
    to: target.email,
    subject,
    html: `<p>${body_text.replace(/\n/g, "<br/>")}</p>`,
    text: body_text,
  }).catch((err) =>
    console.error("[email:affiliation] threw", { userId: target.id, err }),
  );
  void sendPush({
    userId: target.id,
    title: subject,
    body: parsed.data.affiliated
      ? "Payments now go straight to your withdrawable balance."
      : "New orders will use standard escrow.",
    link: target.isSeller ? "/seller" : "/designer",
    data: { type: "affiliation", affiliated: parsed.data.affiliated },
  }).catch((err) =>
    console.error("[push:affiliation] threw", { userId: target.id, err }),
  );

  return NextResponse.json({ ok: true });
}
