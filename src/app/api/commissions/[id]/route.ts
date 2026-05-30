import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { sendEmail, commissionStateChangeEmail } from "@/lib/email";
import { sendPush } from "@/lib/notifications";
import {
  CommissionStatus,
  type CommissionActor,
  type CommissionStatusValue,
  canTransition,
  generateCommissionDeliveryCode,
} from "@/lib/commissions";

// GET /api/commissions/[id] → full detail (either party can read)
// PATCH /api/commissions/[id] → quote / transition / cancel
//
// PATCH body shapes:
//   { kind: "QUOTE", quoteCents, quoteNote?, estimatedDays? }   // designer
//   { kind: "TRANSITION", to: "ACCEPTED" | "DECLINED" | ... }   // either side
//   { kind: "DELIVER" }                                          // designer
//   { kind: "CONFIRM", code }                                    // buyer

const QuoteBody = z.object({
  kind: z.literal("QUOTE"),
  quoteCents: z.number().int().positive().max(1_000_000_000),
  quoteNote: z.string().trim().max(1000).optional(),
  estimatedDays: z.number().int().positive().max(365).optional(),
});

const TransitionBody = z.object({
  kind: z.literal("TRANSITION"),
  to: z.enum([
    CommissionStatus.ACCEPTED,
    CommissionStatus.IN_PROGRESS,
    CommissionStatus.DECLINED,
    CommissionStatus.CANCELLED,
  ]),
  note: z.string().trim().max(500).optional(),
});

const DeliverBody = z.object({
  kind: z.literal("DELIVER"),
});

const ConfirmBody = z.object({
  kind: z.literal("CONFIRM"),
  code: z.string().trim().length(6),
});

const PatchBody = z.discriminatedUnion("kind", [
  QuoteBody,
  TransitionBody,
  DeliverBody,
  ConfirmBody,
]);

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const commission = await prisma.commissionRequest.findUnique({
    where: { id: params.id },
    include: {
      buyer: { select: { id: true, name: true, email: true } },
      designer: { select: { id: true, name: true, email: true } },
    },
  });
  if (!commission) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const me = guard.session.sub;
  if (commission.buyerId !== me && commission.designerId !== me) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ commission });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const commission = await prisma.commissionRequest.findUnique({
    where: { id: params.id },
  });
  if (!commission) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const me = guard.session.sub;
  const actor: CommissionActor =
    commission.buyerId === me ? "buyer" : commission.designerId === me ? "designer" : (() => {
      throw new Error("forbidden");
    })();
  if (commission.buyerId !== me && commission.designerId !== me) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // QUOTE — designer-only, only from REQUESTED. Sets the quote fields and
  // moves the state to QUOTED.
  if (parsed.data.kind === "QUOTE") {
    if (actor !== "designer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (commission.status !== CommissionStatus.REQUESTED) {
      return NextResponse.json({ error: "Quote already sent." }, { status: 400 });
    }
    const updated = await prisma.commissionRequest.update({
      where: { id: commission.id },
      data: {
        quoteCents: parsed.data.quoteCents,
        quoteNote: parsed.data.quoteNote,
        estimatedDays: parsed.data.estimatedDays,
        quotedAt: new Date(),
        status: CommissionStatus.QUOTED,
      },
    });
    await notify(updated, "buyer", "Quote received", `₦${(parsed.data.quoteCents / 100).toLocaleString("en-NG")} · tap to review.`);
    return NextResponse.json({ commission: updated });
  }

  // DELIVER — designer-only, only from IN_PROGRESS. Generates a code that
  // the buyer must hand back on the next call to confirm receipt.
  if (parsed.data.kind === "DELIVER") {
    if (actor !== "designer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (commission.status !== CommissionStatus.IN_PROGRESS) {
      return NextResponse.json({ error: "Mark as in-progress first." }, { status: 400 });
    }
    const code = generateCommissionDeliveryCode();
    const updated = await prisma.commissionRequest.update({
      where: { id: commission.id },
      data: {
        deliveryCode: code,
        deliveredAt: new Date(),
        status: CommissionStatus.DELIVERED,
      },
    });
    await notify(
      updated,
      "buyer",
      "Commission delivered",
      `Confirm delivery with code ${code} to release payment.`,
    );
    return NextResponse.json({ commission: updated });
  }

  // CONFIRM — buyer-only, only from DELIVERED. Verifies the code and moves
  // to COMPLETED.
  if (parsed.data.kind === "CONFIRM") {
    if (actor !== "buyer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (commission.status !== CommissionStatus.DELIVERED) {
      return NextResponse.json({ error: "Nothing to confirm yet." }, { status: 400 });
    }
    if (!commission.deliveryCode || commission.deliveryCode !== parsed.data.code) {
      return NextResponse.json({ error: "That code doesn't match." }, { status: 400 });
    }
    const updated = await prisma.commissionRequest.update({
      where: { id: commission.id },
      data: { status: CommissionStatus.COMPLETED, completedAt: new Date() },
    });
    await notify(updated, "designer", "Commission completed", "The buyer confirmed delivery. Nicely done.");
    return NextResponse.json({ commission: updated });
  }

  // TRANSITION — generic move; the status machine enforces who can do
  // what from where.
  const next = parsed.data.to as CommissionStatusValue;
  if (!canTransition(commission.status, actor, next)) {
    return NextResponse.json(
      { error: `Can't move from ${commission.status} to ${next} as ${actor}.` },
      { status: 400 },
    );
  }
  const updated = await prisma.commissionRequest.update({
    where: { id: commission.id },
    data: {
      status: next,
      ...(next === CommissionStatus.CANCELLED || next === CommissionStatus.DECLINED
        ? { cancellationReason: parsed.data.note }
        : {}),
      ...(next === CommissionStatus.COMPLETED ? { completedAt: new Date() } : {}),
    },
  });
  await notify(
    updated,
    actor === "buyer" ? "designer" : "buyer",
    `Commission ${next.toLowerCase()}`,
    parsed.data.note ?? "Tap to view.",
  );
  return NextResponse.json({ commission: updated });
}

// Fan out a state-change notification to the OTHER party (so the actor
// doesn't get pinged about their own change).
async function notify(
  commission: { id: string; buyerId: string; designerId: string; status: string; title: string },
  to: CommissionActor,
  title: string,
  body: string,
) {
  const recipientId = to === "buyer" ? commission.buyerId : commission.designerId;
  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { email: true, name: true },
  });
  if (!recipient?.email) return;

  const link =
    to === "buyer"
      ? `/account/commissions/${commission.id}`
      : `/designer/commissions/${commission.id}`;

  const tpl = commissionStateChangeEmail({
    name: recipient.name,
    title,
    body,
    commissionTitle: commission.title,
    link,
  });
  void sendEmail({ to: recipient.email, ...tpl }).catch((err) =>
    console.error("[email:commission-state] threw", { commissionId: commission.id, err }),
  );
  void sendPush({
    userId: recipientId,
    title,
    body: `${commission.title} · ${body}`,
    link,
    data: { type: "commission-state", commissionId: commission.id, status: commission.status },
  }).catch((err) =>
    console.error("[push:commission-state] threw", { commissionId: commission.id, err }),
  );
}
