import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { sendEmail, tierChangeEmail } from "@/lib/email";
import { sendPush } from "@/lib/notifications";

// PATCH /api/admin/users/[id]/tier { kind, tier }
//
// Direct admin override of a user's seller / designer tier. Unlike the
// verify endpoint (which flips the boolean and lets the recompute helper
// land on 1 or 2), this is an explicit set — the path for granting Tier 3
// (gold) without a pending verification request, or for resetting a
// misbehaving user back to Tier 1.
//
// Tier ≥ 2 implies verified, so the matching `*Verified` flag is brought in
// line. Tier 1 clears it. We skip the recompute helper on purpose — the
// admin's choice is the source of truth here, and the helper would otherwise
// knock a freshly-granted Tier 2 seller back to 1 if they happen not to have
// a default pickup address yet.

const Body = z.object({
  kind: z.enum(["SELLER", "DESIGNER"]),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin();
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      isSeller: true,
      isDesigner: true,
      sellerTier: true,
      designerTier: true,
    },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { kind, tier } = parsed.data;
  if (kind === "SELLER" && !target.isSeller) {
    return NextResponse.json({ error: "User isn't a seller." }, { status: 400 });
  }
  if (kind === "DESIGNER" && !target.isDesigner) {
    return NextResponse.json({ error: "User isn't a designer." }, { status: 400 });
  }

  const previousTier = kind === "SELLER" ? target.sellerTier : target.designerTier;
  if (previousTier === tier) {
    return NextResponse.json({ ok: true, unchanged: true, tier });
  }

  const verifiedFlag = tier >= 2;
  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      ...(kind === "SELLER"
        ? { sellerTier: tier, sellerVerified: verifiedFlag }
        : { designerTier: tier, designerVerified: verifiedFlag }),
      verifiedAt: verifiedFlag ? new Date() : null,
      verifiedBy: verifiedFlag ? guard.user.id : null,
    },
    select: { id: true, sellerTier: true, designerTier: true },
  });

  // Notify the user out-of-band — gold grants in particular are worth a
  // heads-up so the recipient knows their cap moved from 30 → 100 listings
  // and their withdrawal fee dropped to 1.5%.
  const tpl = tierChangeEmail({
    name: target.name,
    kind,
    tier,
    previousTier: previousTier ?? 1,
  });
  void sendEmail({ to: target.email, ...tpl })
    .then((r) => {
      if (!r.ok) console.error("[email:tier-change] failed", { to: target.email, error: r.error });
    })
    .catch((err) => console.error("[email:tier-change] threw", { to: target.email, err }));

  const role: "seller" | "designer" = kind === "SELLER" ? "seller" : "designer";
  const tierLabel = tier === 3 ? "Gold ★" : tier === 2 ? "Blue ✓" : "Tier 1";
  void sendPush({
    userId: target.id,
    title: tier > (previousTier ?? 1) ? `Upgraded to ${tierLabel}` : "Tier changed",
    body: `Your ${role} account is now ${tierLabel}. Tap to open the dashboard.`,
    link: `/${role}`,
    data: { type: "tier-change", kind, tier },
  }).catch((err) => console.error("[push:tier-change] threw", { userId: target.id, err }));

  return NextResponse.json({ ok: true, user: updated });
}
