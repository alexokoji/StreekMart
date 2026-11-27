import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { sendPush } from "@/lib/notifications";

// PATCH /api/admin/users/[id]/direct-pay { enabled, feeBps? }
//
// The direct-pay privilege is granted ONLY here, by an admin. When enabled
// (and once the seller has added bank details) the seller's products skip the
// logistics provider and escrow, and paid orders go straight to their bank.
// `feeBps` is the platform's cut on that seller's sales in basis points
// (100 = 1%); null/omitted keeps the platform default.
//
// Turning it OFF stops new direct orders immediately. Orders already placed
// as direct-pay stay direct-pay (they were paid out on payment).

const Body = z.object({
  enabled: z.boolean(),
  feeBps: z.number().int().min(0).max(5000).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_USERS);
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, isSeller: true, directPayEnabled: true },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!target.isSeller) {
    return NextResponse.json({ error: "Only sellers can have direct payments." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: target.id },
    data: {
      directPayEnabled: parsed.data.enabled,
      ...(parsed.data.feeBps !== undefined ? { directFeeBps: parsed.data.feeBps } : {}),
    },
  });

  if (parsed.data.enabled && !target.directPayEnabled) {
    void sendPush({
      userId: target.id,
      title: "Direct payments unlocked",
      body: "Add your bank details in Seller settings to start getting paid straight to your account.",
      link: "/seller/settings",
      data: { type: "direct-pay-enabled" },
    }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
