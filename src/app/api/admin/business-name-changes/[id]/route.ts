import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { isBusinessNameTaken } from "@/lib/businessNameServer";
import { sendPush } from "@/lib/notifications";

// PATCH /api/admin/business-name-changes/[id] { decision, note? }
//
// Admin approves or rejects a business-name change request. APPROVE writes
// the new businessName + businessNameLower onto the user in the same
// transaction that flips the request to APPROVED. REJECT is non-destructive
// — the user's current name stays as-is and they may submit a fresh request.

const Body = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().max(500).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_BUSINESS_NAMES);
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const reqRow = await prisma.businessNameChangeRequest.findUnique({
    where: { id: params.id },
  });
  if (!reqRow) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (reqRow.status !== "PENDING") {
    return NextResponse.json({ error: "Already decided." }, { status: 400 });
  }

  if (parsed.data.decision === "APPROVE") {
    // Re-check uniqueness right before committing — someone else may have
    // claimed the name in the time since the request was created.
    if (await isBusinessNameTaken(reqRow.requestedLower, reqRow.userId)) {
      return NextResponse.json(
        { error: "That business name was claimed by another user in the meantime." },
        { status: 409 },
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.businessNameChangeRequest.update({
        where: { id: reqRow.id },
        data: {
          status: "APPROVED",
          reviewerId: guard.user.id,
          reviewedAt: new Date(),
          decisionNote: parsed.data.note,
        },
      });
      await tx.user.update({
        where: { id: reqRow.userId },
        data: {
          businessName: reqRow.requestedName,
          businessNameLower: reqRow.requestedLower,
        },
      });
    });
    void sendPush({
      userId: reqRow.userId,
      title: "✓ Business name approved",
      body: `Your business name is now "${reqRow.requestedName}".`,
      link: "/account",
      data: { type: "business-name-decision", decision: "APPROVED" },
    }).catch((err) =>
      console.error("[push:business-name-decision] threw", { userId: reqRow.userId, err }),
    );
    return NextResponse.json({ ok: true, status: "APPROVED" });
  }

  // REJECT — leave the user row alone.
  await prisma.businessNameChangeRequest.update({
    where: { id: reqRow.id },
    data: {
      status: "REJECTED",
      reviewerId: guard.user.id,
      reviewedAt: new Date(),
      decisionNote: parsed.data.note,
    },
  });
  void sendPush({
    userId: reqRow.userId,
    title: "Business name change declined",
    body: parsed.data.note ?? "Tap to view the decision note.",
    link: "/account",
    data: { type: "business-name-decision", decision: "REJECTED" },
  }).catch((err) =>
    console.error("[push:business-name-decision] threw", { userId: reqRow.userId, err }),
  );

  return NextResponse.json({ ok: true, status: "REJECTED" });
}
