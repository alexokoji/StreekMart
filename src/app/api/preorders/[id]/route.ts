import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import {
  PreorderStatus,
  type PreorderActor,
  type PreorderStatusValue,
  canTransition,
  generatePreorderDeliveryCode,
} from "@/lib/preorders";
import { releaseHeldFundsForOrder } from "@/lib/wallet";
import { sendEmail } from "@/lib/email";
import { sendPush } from "@/lib/notifications";

// GET  /api/preorders/[id] → full detail (either party can read)
// PATCH /api/preorders/[id] → transition / mark ready / ship / confirm
//
// PATCH body shapes:
//   { kind: "TRANSITION", to: "CANCELLED", note? }      // either party
//   { kind: "READY" }                                     // designer
//   { kind: "SHIP",      trackingCode, provider? }        // designer
//   { kind: "CONFIRM",   code }                           // buyer

const ReadyBody = z.object({ kind: z.literal("READY") });
const ShipBody = z.object({
  kind: z.literal("SHIP"),
  trackingCode: z.string().trim().min(1).max(80),
  provider: z.string().trim().max(60).optional(),
});
const ConfirmBody = z.object({
  kind: z.literal("CONFIRM"),
  code: z.string().trim().length(6),
});
const TransitionBody = z.object({
  kind: z.literal("TRANSITION"),
  to: z.enum([PreorderStatus.CANCELLED]),
  note: z.string().trim().max(500).optional(),
});

const PatchBody = z.discriminatedUnion("kind", [
  ReadyBody,
  ShipBody,
  ConfirmBody,
  TransitionBody,
]);

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const preorder = await prisma.preorder.findUnique({
    where: { id: params.id },
    include: {
      buyer: { select: { id: true, name: true, email: true } },
      designer: { select: { id: true, name: true, email: true } },
      post: { select: { id: true, title: true, imagesJson: true } },
    },
  });
  if (!preorder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const me = guard.session.sub;
  if (preorder.buyerId !== me && preorder.designerId !== me) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ preorder });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const preorder = await prisma.preorder.findUnique({ where: { id: params.id } });
  if (!preorder) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const me = guard.session.sub;
  if (preorder.buyerId !== me && preorder.designerId !== me) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const actor: PreorderActor = preorder.buyerId === me ? "buyer" : "designer";

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // READY — designer-only, only from AWAITING_READY.
  if (parsed.data.kind === "READY") {
    if (actor !== "designer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (preorder.status !== PreorderStatus.AWAITING_READY) {
      return NextResponse.json(
        { error: "Mark-ready only available while in production." },
        { status: 400 },
      );
    }
    const updated = await prisma.preorder.update({
      where: { id: preorder.id },
      data: { status: PreorderStatus.READY, readyAt: new Date() },
    });
    await notifyCounterparty(updated, "buyer", "Your preorder is ready 🎉", "Pay delivery to ship it out.");
    return NextResponse.json({ preorder: updated });
  }

  // SHIP — designer-only, only from AWAITING_SHIPMENT. Generates the
  // delivery code the buyer hands back when receiving.
  if (parsed.data.kind === "SHIP") {
    if (actor !== "designer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (preorder.status !== PreorderStatus.AWAITING_SHIPMENT) {
      return NextResponse.json(
        { error: "Buyer hasn't paid delivery yet." },
        { status: 400 },
      );
    }
    const code = generatePreorderDeliveryCode();
    const updated = await prisma.preorder.update({
      where: { id: preorder.id },
      data: {
        status: PreorderStatus.SHIPPED,
        trackingCode: parsed.data.trackingCode,
        logisticsProvider: parsed.data.provider ?? null,
        deliveryCode: code,
        shippedAt: new Date(),
      },
    });
    await notifyCounterparty(
      updated,
      "buyer",
      "Your preorder shipped 📦",
      `Tracking ${parsed.data.trackingCode}. Delivery code on arrival: ${code}.`,
    );
    return NextResponse.json({ preorder: updated });
  }

  // CONFIRM — buyer-only, only from SHIPPED. Releases held funds if the
  // designer was unverified (Tier 1).
  if (parsed.data.kind === "CONFIRM") {
    if (actor !== "buyer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (preorder.status !== PreorderStatus.SHIPPED) {
      return NextResponse.json({ error: "Nothing to confirm yet." }, { status: 400 });
    }
    if (!preorder.deliveryCode || preorder.deliveryCode !== parsed.data.code) {
      return NextResponse.json({ error: "That code doesn't match." }, { status: 400 });
    }
    const updated = await prisma.preorder.update({
      where: { id: preorder.id },
      data: { status: PreorderStatus.COMPLETED, completedAt: new Date() },
    });
    // Release any held funds for unverified designers. For verified
    // designers `skipHold` was set at design payment so this is a no-op.
    await releaseHeldFundsForOrder(preorder.id).catch(() => {});
    await notifyCounterparty(updated, "designer", "Preorder completed 🎉", "Funds released to your wallet.");
    return NextResponse.json({ preorder: updated });
  }

  // TRANSITION — generic move. Currently only CANCELLED.
  const next = parsed.data.to as PreorderStatusValue;
  if (!canTransition(preorder.status, actor, next)) {
    return NextResponse.json(
      { error: `Can't move from ${preorder.status} to ${next} as ${actor}.` },
      { status: 400 },
    );
  }
  const updated = await prisma.preorder.update({
    where: { id: preorder.id },
    data: {
      status: next,
      cancellationReason: parsed.data.note ?? null,
      cancelledAt: new Date(),
    },
  });
  await notifyCounterparty(
    updated,
    actor === "buyer" ? "designer" : "buyer",
    "Preorder cancelled",
    parsed.data.note ?? "Tap for details.",
  );
  return NextResponse.json({ preorder: updated });
}

async function notifyCounterparty(
  preorder: { id: string; buyerId: string; designerId: string },
  to: PreorderActor,
  title: string,
  body: string,
) {
  const recipientId = to === "buyer" ? preorder.buyerId : preorder.designerId;
  const link =
    to === "buyer"
      ? `/account/preorders/${preorder.id}`
      : `/designer/preorders/${preorder.id}`;
  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { email: true, name: true },
  });
  if (!recipient) return;
  void sendPush({
    userId: recipientId,
    title,
    body,
    link,
    data: { type: "preorder-state", preorderId: preorder.id },
  }).catch(() => {});
  void sendEmail({
    to: recipient.email,
    subject: title,
    html: `<p>Hi ${recipient.name},</p><p><strong>${title}</strong></p><p>${body}</p>`,
    text: `${title}: ${body}`,
  }).catch(() => {});
}
