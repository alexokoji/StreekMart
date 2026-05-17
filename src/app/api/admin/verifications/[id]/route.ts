import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { sendEmail, verificationDecisionEmail } from "@/lib/email";

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
  const guard = await requireApiAdmin();
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
      await tx.user.update({
        where: { id: reqRow.userId },
        data: {
          ...(reqRow.kind === "SELLER" ? { sellerVerified: true } : {}),
          ...(reqRow.kind === "DESIGNER" ? { designerVerified: true } : {}),
          verifiedAt: new Date(),
          verifiedBy: guard.user.id,
        },
      });
    }
  });

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
    void sendEmail({ to: requester.email, ...tpl }).catch(() => {});
  }

  return NextResponse.json({ ok: true, status: decided });
}
