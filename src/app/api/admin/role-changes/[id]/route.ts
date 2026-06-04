import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { sendEmail, roleChangeDecisionEmail } from "@/lib/email";
import { sendPush } from "@/lib/notifications";

// PATCH /api/admin/role-changes/[id] { decision, note? }
//
// Admin approves or rejects a user's role-change request. APPROVE writes
// the requested booleans onto the User row in the same transaction that
// flips the request to APPROVED. REJECT leaves the user as-is.

const Body = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(500).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_VERIFICATIONS);
  if ("error" in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const reqRow = await prisma.roleChangeRequest.findUnique({
    where: { id: params.id },
  });
  if (!reqRow) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (reqRow.status !== "PENDING") {
    return NextResponse.json({ error: "Already decided." }, { status: 400 });
  }

  if (parsed.data.decision === "APPROVE") {
    await prisma.$transaction(async (tx) => {
      await tx.roleChangeRequest.update({
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
          isSeller: reqRow.toIsSeller,
          isDesigner: reqRow.toIsDesigner,
        },
      });
    });
  } else {
    await prisma.roleChangeRequest.update({
      where: { id: reqRow.id },
      data: {
        status: "REJECTED",
        reviewerId: guard.user.id,
        reviewedAt: new Date(),
        decisionNote: parsed.data.note,
      },
    });
  }

  // Notify the requester out-of-band. Approved gets a clear "your dashboard
  // is live"; rejected echoes the admin's note so the user knows why.
  const requester = await prisma.user.findUnique({
    where: { id: reqRow.userId },
    select: { name: true, email: true },
  });
  if (requester) {
    const newRoles = [
      reqRow.toIsSeller && "Seller",
      reqRow.toIsDesigner && "Designer",
    ].filter(Boolean) as string[];
    const approved = parsed.data.decision === "APPROVE";
    const tpl = roleChangeDecisionEmail({
      name: requester.name,
      approved,
      newRoles,
      note: parsed.data.note,
    });
    void sendEmail({ to: requester.email, ...tpl }).catch((err) =>
      console.error("[email:role-change] threw", { userId: reqRow.userId, err }),
    );
    void sendPush({
      userId: reqRow.userId,
      title: approved ? "Role change approved" : "Role change update",
      body: approved
        ? `Tap to open your new ${newRoles.length === 1 ? newRoles[0].toLowerCase() : "dashboard"}.`
        : parsed.data.note ?? "Tap to view the decision note.",
      link: approved
        ? newRoles.includes("Seller")
          ? "/seller"
          : newRoles.includes("Designer")
            ? "/designer"
            : "/account"
        : "/account",
      data: {
        type: "role-change-decision",
        decision: parsed.data.decision,
      },
    }).catch((err) =>
      console.error("[push:role-change] threw", { userId: reqRow.userId, err }),
    );
  }

  return NextResponse.json({
    ok: true,
    status: parsed.data.decision === "APPROVE" ? "APPROVED" : "REJECTED",
  });
}
