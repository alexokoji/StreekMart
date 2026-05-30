import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { sendEmail, commissionRequestEmail } from "@/lib/email";
import { sendPush } from "@/lib/notifications";

// POST /api/commissions
// Body: { designerId, title, description, occasion?, budgetCents?, deadlineAt?, references? }
//
// Buyer-initiated. Creates a new commission in REQUESTED state and pings
// the designer over email + push so they can quote without delay. The
// buyer can list / detail their commissions at /account/commissions.

const Body = z.object({
  designerId: z.string().cuid(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(8).max(2000),
  occasion: z.string().trim().max(60).optional(),
  budgetCents: z.number().int().positive().max(1_000_000_000).optional(),
  deadlineAt: z.string().datetime().optional(),
  // Image URLs the buyer uploaded as visual references (Pinterest screenshots,
  // existing outfits, fabric swatches, etc.). Cap at 6 — the brief stays
  // skim-able.
  references: z.array(z.string().url()).max(6).optional(),
});

export async function POST(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // Designer must exist + must actually be a designer. Cheap guard against
  // a buyer pointing the form at a buyer-only account.
  const designer = await prisma.user.findUnique({
    where: { id: parsed.data.designerId },
    select: { id: true, name: true, email: true, isDesigner: true, suspendedAt: true },
  });
  if (!designer || !designer.isDesigner || designer.suspendedAt) {
    return NextResponse.json({ error: "Designer not available." }, { status: 404 });
  }
  if (designer.id === guard.session.sub) {
    return NextResponse.json({ error: "Can't commission yourself." }, { status: 400 });
  }

  const commission = await prisma.commissionRequest.create({
    data: {
      buyerId: guard.session.sub,
      designerId: designer.id,
      title: parsed.data.title,
      description: parsed.data.description,
      occasion: parsed.data.occasion,
      budgetCents: parsed.data.budgetCents,
      deadlineAt: parsed.data.deadlineAt ? new Date(parsed.data.deadlineAt) : null,
      referencesJson: JSON.stringify(parsed.data.references ?? []),
    },
  });

  // Notify the designer out-of-band. Fire-and-forget, mirrors the existing
  // order/chat patterns — channel failures don't roll back the request.
  const buyer = await prisma.user.findUnique({
    where: { id: guard.session.sub },
    select: { name: true },
  });
  const tpl = commissionRequestEmail({
    designerName: designer.name,
    buyerName: buyer?.name ?? "A buyer",
    title: parsed.data.title,
    commissionId: commission.id,
  });
  void sendEmail({ to: designer.email, ...tpl }).catch((err) =>
    console.error("[email:commission-request] threw", { commissionId: commission.id, err }),
  );
  void sendPush({
    userId: designer.id,
    title: "New commission request",
    body: `${buyer?.name ?? "A buyer"} · ${parsed.data.title}`,
    link: `/designer/commissions/${commission.id}`,
    data: { type: "commission-request", commissionId: commission.id },
  }).catch((err) =>
    console.error("[push:commission-request] threw", { commissionId: commission.id, err }),
  );

  return NextResponse.json({ commission });
}

// GET /api/commissions?role=buyer|designer
// Lists the actor's commissions in the requested role.
export async function GET(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const role = new URL(req.url).searchParams.get("role") ?? "buyer";

  const where =
    role === "designer"
      ? { designerId: guard.session.sub }
      : { buyerId: guard.session.sub };

  const commissions = await prisma.commissionRequest.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      buyer: { select: { id: true, name: true } },
      designer: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ commissions });
}
