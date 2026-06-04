import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { sendEmail, verificationDecisionEmail } from "@/lib/email";
import { sendPush } from "@/lib/notifications";
import { recomputeSellerTier, recomputeDesignerTier } from "@/lib/tiers";

// PATCH /api/admin/verifications/[id] { decision, note? }
//
// Admin approves or rejects a verification request. On approval the matching
// flag (sellerVerified / designerVerified) flips to true on the User row,
// `verifiedAt` is set, and `verifiedBy` records which admin signed off.

const Body = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().max(500).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_VERIFICATIONS);
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const reqRow = await prisma.verificationRequest.findUnique({ where: { id: params.id } });
  if (!reqRow) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (reqRow.status !== "PENDING") {
    return NextResponse.json({ error: "Already decided." }, { status: 400 });
  }

  const decided = parsed.data.decision === "APPROVE" ? "APPROVED" : "REJECTED";

  await prisma.$transaction(async (tx) => {
    await tx.verificationRequest.update({
      where: { id: reqRow.id },
      data: {
        status: decided,
        reviewerId: guard.user.id,
        reviewedAt: new Date(),
        decisionNote: parsed.data.note,
      },
    });

    if (decided === "APPROVED") {
      const isSeller = reqRow.kind === "SELLER";
      const grantTier3 = reqRow.tier === 3;
      // Tier 2 approval flips the boolean (recompute then maps it to tier 2).
      // Tier 3 approval is an explicit set — gold is sticky in the helper, so
      // the only way it ever shows up on a user row is via this branch.
      await tx.user.update({
        where: { id: reqRow.userId },
        data: {
          ...(isSeller ? { sellerVerified: true } : {}),
          ...(!isSeller ? { designerVerified: true } : {}),
          ...(grantTier3 && isSeller ? { sellerTier: 3 } : {}),
          ...(grantTier3 && !isSeller ? { designerTier: 3 } : {}),
          verifiedAt: new Date(),
          verifiedBy: guard.user.id,
        },
      });
    }
  });

  // Recompute the matching tier after the verification flag flips. For
  // Tier 2 approvals this brings the user from 1 → 2 (helper requires
  // sellers to also have a default pickup address). For Tier 3 approvals
  // we've already set the tier in the transaction; recompute is a no-op
  // there because the helper treats 3 as sticky.
  if (decided === "APPROVED") {
    if (reqRow.kind === "SELLER") await recomputeSellerTier(reqRow.userId);
    if (reqRow.kind === "DESIGNER") await recomputeDesignerTier(reqRow.userId);
  }

  // Notify the requester. Fire-and-forget — failure is logged elsewhere
  // (see lib/email.ts) and doesn't roll back the decision.
  const requester = await prisma.user.findUnique({
    where: { id: reqRow.userId },
    select: { name: true, email: true },
  });
  if (requester) {
    const tpl = verificationDecisionEmail({
      name: requester.name,
      kind: reqRow.kind as "SELLER" | "DESIGNER",
      approved: decided === "APPROVED",
      note: parsed.data.note,
    });
    void sendEmail({ to: requester.email, ...tpl })
      .then((r) => {
        if (!r.ok) console.error("[email:verification-decision] failed", { to: requester.email, error: r.error });
      })
      .catch((err) => console.error("[email:verification-decision] threw", { to: requester.email, err }));

    // Mirror the decision as a push — taps deep-link into the role
    // dashboard so the user can immediately see their new badge state.
    const role: "seller" | "designer" = reqRow.kind === "SELLER" ? "seller" : "designer";
    void sendPush({
      userId: reqRow.userId,
      title: decided === "APPROVED"
        ? `You're a verified ${role} ✓`
        : `${role} verification update`,
      body: decided === "APPROVED"
        ? "Tap to open your dashboard — your badge is live."
        : parsed.data.note ?? "Tap to resubmit with updated info.",
      link: `/${role}`,
      data: { type: "verification-decision", kind: reqRow.kind, decided },
    }).catch((err) => console.error("[push:verification-decision] threw", { userId: reqRow.userId, err }));
  }

  return NextResponse.json({ ok: true, status: decided });
}
