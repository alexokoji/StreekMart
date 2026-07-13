// Server-only preorder payment helpers. Imported by:
//   - /api/preorders/route.ts            (stub-confirm path inside POST)
//   - /api/preorders/[id]/pay-delivery   (stub-confirm path inside POST)
//   - /api/monnify/webhook               (real payment confirmations)
//   - /api/monnify/stub-confirm          (dev replay endpoint)
//
// Kept out of src/lib/preorders.ts because that module is imported by
// client components (PreorderDetail, PreorderList) — putting prisma /
// email / push imports there would pull server code into the client
// bundle.

import { prisma } from "@/lib/db";
import { PreorderStatus, shouldSkipDesignerHold } from "@/lib/preorders";
import { recordSale } from "@/lib/wallet";
import { sendEmail } from "@/lib/email";
import { sendPush } from "@/lib/notifications";

// The fulfilling-party dashboard link differs by source: a Post-backed
// preorder belongs to a Designer, a Product-backed one to a Seller.
function fulfillerPreorderLink(p: { id: string; productId: string | null }): string {
  return p.productId ? `/seller/preorders/${p.id}` : `/designer/preorders/${p.id}`;
}

// Flip a preorder from PENDING_PAYMENT → AWAITING_READY once the buyer's
// design payment confirms. Idempotent — webhook retries are safe.
export async function markDesignPaid(
  preorderId: string,
  paymentRef: string,
  txnRef: string,
): Promise<void> {
  const p = await prisma.preorder.findUnique({
    where: { id: preorderId },
    include: {
      designer: { select: { designerVerified: true, designerTier: true, name: true, email: true } },
      post: { select: { title: true } },
      product: { select: { name: true } },
      buyer: { select: { name: true, email: true } },
    },
  });
  if (!p) return;
  if (p.status !== PreorderStatus.PENDING_PAYMENT) return;

  const itemTitle = p.post?.title ?? p.product?.name ?? "your piece";
  const now = new Date();
  const eta = new Date(now.getTime() + p.leadDays * 24 * 60 * 60 * 1000);

  await prisma.preorder.update({
    where: { id: p.id },
    data: {
      status: PreorderStatus.AWAITING_READY,
      designPaymentRef: paymentRef,
      designPaymentTxnRef: txnRef,
      designPaidAt: now,
      estimatedReadyAt: eta,
    },
  });

  // Verified Tier 2/3 → straight to withdrawable balance so they can buy
  // materials. Tier 1 (unverified) → held until completion to protect
  // the buyer from a designer who disappears with the funds.
  const skipHold = shouldSkipDesignerHold({
    designerVerified: p.designer.designerVerified,
    designerTier: p.designer.designerTier,
  });
  await recordSale({
    sellerId: p.designerId,
    grossCents: p.priceCents,
    productName: `Preorder · ${itemTitle}`,
    orderId: p.id,
    skipHold,
  });

  void sendPush({
    userId: p.designerId,
    title: "Preorder paid",
    body: `${p.buyer.name} paid ₦${(p.priceCents / 100).toLocaleString("en-NG")} for "${itemTitle}". Get started!`,
    link: fulfillerPreorderLink(p),
    data: { type: "preorder-paid", preorderId: p.id },
  }).catch(() => {});
  void sendPush({
    userId: p.buyerId,
    title: "Preorder confirmed",
    body: `Estimated ready: ${eta.toLocaleDateString("en-NG", { month: "short", day: "numeric" })}. You'll be notified when it's done.`,
    link: `/account/preorders/${p.id}`,
    data: { type: "preorder-paid", preorderId: p.id },
  }).catch(() => {});
  void sendEmail({
    to: p.designer.email,
    subject: `Preorder paid — ${itemTitle}`,
    html: `<p>Hi ${p.designer.name},</p><p>${p.buyer.name} paid ₦${(p.priceCents / 100).toLocaleString("en-NG")} for a preorder. Open your dashboard to get started.</p>`,
    text: `${p.buyer.name} paid for a preorder.`,
  }).catch(() => {});
  void sendEmail({
    to: p.buyer.email,
    subject: "Your preorder is confirmed",
    html: `<p>Hi ${p.buyer.name},</p><p>Your preorder is in production. Estimated ready: <strong>${eta.toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" })}</strong>. We'll let you know when it's available.</p>`,
    text: `Estimated ready: ${eta.toLocaleDateString("en-NG")}.`,
  }).catch(() => {});
}

// Flip a preorder from READY → AWAITING_SHIPMENT once the buyer's
// delivery payment confirms. Idempotent.
export async function markDeliveryPaid(
  preorderId: string,
  paymentRef: string,
  txnRef: string,
): Promise<void> {
  const p = await prisma.preorder.findUnique({
    where: { id: preorderId },
    include: {
      designer: { select: { id: true, name: true, email: true } },
      buyer: { select: { id: true, name: true, email: true } },
      post: { select: { title: true } },
      product: { select: { name: true } },
    },
  });
  if (!p) return;
  if (p.status !== PreorderStatus.READY) return;

  const itemTitle = p.post?.title ?? p.product?.name ?? "the design";

  await prisma.preorder.update({
    where: { id: p.id },
    data: {
      status: PreorderStatus.AWAITING_SHIPMENT,
      deliveryPaymentRef: paymentRef,
      deliveryPaymentTxnRef: txnRef,
      deliveryPaidAt: new Date(),
    },
  });

  void sendPush({
    userId: p.designerId,
    title: "Delivery paid — ship the piece",
    body: `${p.buyer.name}'s preorder of "${itemTitle}" is ready to ship.`,
    link: fulfillerPreorderLink(p),
    data: { type: "preorder-delivery-paid", preorderId: p.id },
  }).catch(() => {});
  void sendEmail({
    to: p.designer.email,
    subject: "Preorder delivery paid — time to ship",
    html: `<p>Hi ${p.designer.name},</p><p>The buyer paid delivery for the preorder. Open your dashboard, add a tracking code, and we'll send the delivery code to the buyer.</p>`,
    text: "Delivery paid. Ship the piece.",
  }).catch(() => {});
}
