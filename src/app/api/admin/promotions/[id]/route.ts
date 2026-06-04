import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import {
  PROMOTION_DURATION_DAYS,
  PromotionStatus,
} from "@/lib/enums";
import { recordTransaction } from "@/lib/wallet";
import { sendPush } from "@/lib/notifications";

// PATCH /api/admin/promotions/[id] { decision, note? }
//
// Admin moves a paid product promotion through its review state machine.
//
// APPROVE:  status = APPROVED, startsAt = now, endsAt = now + 3d, active = true.
//           The promotion immediately appears in the homepage slider and
//           rank-boost picks it up on the next request.
//
// REJECT:   status = REJECTED, active = false. The seller's wallet is
//           credited the ₦500 fee via a REFUND ledger entry so the money
//           returns to a withdrawable balance without admin payout work.

const Body = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().max(500).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_PROMOTIONS);
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const promo = await prisma.promotion.findUnique({ where: { id: params.id } });
  if (!promo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (promo.status !== PromotionStatus.PENDING_REVIEW) {
    return NextResponse.json({ error: "Already decided." }, { status: 400 });
  }

  if (parsed.data.decision === "APPROVE") {
    const startsAt = new Date();
    const endsAt = new Date(
      startsAt.getTime() + PROMOTION_DURATION_DAYS * 24 * 60 * 60 * 1000,
    );
    await prisma.promotion.update({
      where: { id: promo.id },
      data: {
        status: PromotionStatus.APPROVED,
        reviewerId: guard.user.id,
        reviewedAt: new Date(),
        decisionNote: parsed.data.note,
        startsAt,
        endsAt,
        active: true,
      },
    });
    void sendPush({
      userId: promo.ownerId,
      title: "✓ Promotion approved",
      body: `Your promotion is live for the next ${PROMOTION_DURATION_DAYS} days.`,
      link: "/seller/promotions",
      data: { type: "promotion-decision", promotionId: promo.id, decision: "APPROVED" },
    }).catch((err) =>
      console.error("[push:promotion-decision] threw", { promotionId: promo.id, err }),
    );
    return NextResponse.json({ ok: true, status: PromotionStatus.APPROVED });
  }

  // REJECT — refund the fee to the seller's wallet. If the fee was zero
  // (legacy free post promotion that somehow ended up here) skip the
  // ledger write to avoid a noisy 0-amount transaction.
  await prisma.$transaction(async (tx) => {
    await tx.promotion.update({
      where: { id: promo.id },
      data: {
        status: PromotionStatus.REJECTED,
        reviewerId: guard.user.id,
        reviewedAt: new Date(),
        decisionNote: parsed.data.note,
        active: false,
      },
    });
    if (promo.priceCents > 0) {
      await recordTransaction({
        tx,
        userId: promo.ownerId,
        amountCents: promo.priceCents,
        type: "REFUND",
        description: `Promotion rejected — fee refund (₦${(promo.priceCents / 100).toFixed(0)})`,
        refType: "promotion",
        refId: promo.id,
      });
    }
  });

  void sendPush({
    userId: promo.ownerId,
    title: "Promotion rejected",
    body:
      promo.priceCents > 0
        ? `Your ₦${(promo.priceCents / 100).toLocaleString("en-NG")} fee has been refunded to your wallet.`
        : parsed.data.note ?? "Tap for details.",
    link: "/seller/promotions",
    data: { type: "promotion-decision", promotionId: promo.id, decision: "REJECTED" },
  }).catch((err) =>
    console.error("[push:promotion-decision] threw", { promotionId: promo.id, err }),
  );

  return NextResponse.json({ ok: true, status: PromotionStatus.REJECTED });
}
