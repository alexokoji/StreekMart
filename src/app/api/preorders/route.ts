import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { getGatewaySelector } from "@/lib/gatewaySelector";
import {
  PreorderStatus,
  shouldSkipDesignerHold,
} from "@/lib/preorders";
import { recordSale } from "@/lib/wallet";
import { sendEmail } from "@/lib/email";
import { sendPush } from "@/lib/notifications";

// POST /api/preorders { postId, notes? }
//
// Buyer requests a preorder of a designer's post-attached piece.
//   1. Snapshot the post's current price + lead onto the Preorder row.
//   2. Initialise the payment gateway with reference `PREORDER_DESIGN_<id>`.
//   3. Return the checkout URL — buyer is redirected by the client.
//   4. The Monnify / Korapay webhook flips the status to AWAITING_READY
//      when payment confirms (see /api/monnify/webhook).

function buildRedirectUrl(req: Request, preorderId: string): string {
  const origin = new URL(req.url).origin;
  return `${origin}/account/preorders/${preorderId}`;
}

const Body = z.object({
  postId: z.string().min(1),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const post = await prisma.post.findUnique({
    where: { id: parsed.data.postId },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          designerVerified: true,
          designerTier: true,
          suspendedAt: true,
        },
      },
    },
  });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if (
    !post.preorderEnabled ||
    typeof post.preorderPriceCents !== "number" ||
    typeof post.preorderLeadDays !== "number"
  ) {
    return NextResponse.json(
      { error: "This piece isn't accepting preorders right now." },
      { status: 400 },
    );
  }
  if (post.author.suspendedAt) {
    return NextResponse.json(
      { error: "This designer's account is currently inactive." },
      { status: 400 },
    );
  }
  if (post.author.id === guard.session.sub) {
    return NextResponse.json(
      { error: "You can't preorder your own piece." },
      { status: 400 },
    );
  }

  const me = await prisma.user.findUnique({
    where: { id: guard.session.sub },
    select: { id: true, name: true, email: true },
  });
  if (!me) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  // Create the preorder row first so we have an id for the payment ref.
  const preorder = await prisma.preorder.create({
    data: {
      buyerId: me.id,
      designerId: post.author.id,
      postId: post.id,
      priceCents: post.preorderPriceCents,
      leadDays: post.preorderLeadDays,
      notes: parsed.data.notes,
      status: PreorderStatus.PENDING_PAYMENT,
    },
  });

  const ref = `PREORDER_DESIGN_${preorder.id}`;
  await prisma.preorder.update({
    where: { id: preorder.id },
    data: { designPaymentRef: ref },
  });

  // Notify the designer that a new request landed. Push only — they'll
  // see the order details on /designer/preorders once payment clears.
  void sendPush({
    userId: post.author.id,
    title: "New preorder request",
    body: `${me.name} wants "${post.title}" · ₦${(post.preorderPriceCents / 100).toLocaleString("en-NG")}`,
    link: `/designer/preorders/${preorder.id}`,
    data: { type: "preorder-request", preorderId: preorder.id },
  }).catch((err) =>
    console.error("[push:preorder-request] threw", { preorderId: preorder.id, err }),
  );

  // Initialise payment.
  const gateway = getGatewaySelector();
  try {
    const init = await gateway.initCheckout({
      amountCents: post.preorderPriceCents,
      customerEmail: me.email,
      customerName: me.name,
      description: `Preorder · ${post.title.slice(0, 50)}`,
      paymentReference: ref,
      redirectUrl: buildRedirectUrl(req, preorder.id),
    });

    // Stub mode (no real gateway credentials) — auto-confirm so the dev
    // flow stays usable end-to-end without real payments. Mirrors the
    // promotion flow.
    if (gateway.isStubMode()) {
      await markDesignPaid(preorder.id, ref, `STUB_${ref}`);
      return NextResponse.json({
        preorder: { id: preorder.id },
        checkoutUrl: buildRedirectUrl(req, preorder.id),
        stub: true,
      });
    }

    return NextResponse.json({
      preorder: { id: preorder.id },
      checkoutUrl: init.checkoutUrl,
    });
  } catch (err) {
    // Roll back the preorder so the buyer doesn't see a half-broken row.
    await prisma.preorder.delete({ where: { id: preorder.id } }).catch(() => {});
    console.error("[preorder:init] gateway failed", { err });
    return NextResponse.json(
      { error: "Couldn't start payment. Try again in a minute." },
      { status: 502 },
    );
  }
}

// Helper exported via the webhook + stub-confirm routes too.
export async function markDesignPaid(
  preorderId: string,
  paymentRef: string,
  txnRef: string,
): Promise<void> {
  // Fetch with the bits we need to decide skip-hold + ETA.
  const p = await prisma.preorder.findUnique({
    where: { id: preorderId },
    include: {
      designer: { select: { designerVerified: true, designerTier: true, name: true, email: true } },
      post: { select: { title: true } },
      buyer: { select: { name: true, email: true } },
    },
  });
  if (!p) return;
  // Idempotent — if status has already advanced (rare webhook race), skip.
  if (p.status !== PreorderStatus.PENDING_PAYMENT) return;

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

  // Credit the designer's wallet. Verified Tier 2/3 → straight to
  // withdrawable balance so they can buy materials. Tier 1 (unverified)
  // → held until completion to protect the buyer from a designer who
  // disappears with the funds.
  const skipHold = shouldSkipDesignerHold({
    designerVerified: p.designer.designerVerified,
    designerTier: p.designer.designerTier,
  });
  await recordSale({
    sellerId: p.designerId,
    grossCents: p.priceCents,
    productName: `Preorder · ${p.post?.title ?? "design"}`,
    orderId: p.id,
    skipHold,
  });

  // Notifications — designer learns payment cleared, buyer gets ETA.
  void sendPush({
    userId: p.designerId,
    title: "Preorder paid",
    body: `${p.buyer.name} paid ₦${(p.priceCents / 100).toLocaleString("en-NG")} for "${p.post?.title ?? "your piece"}". Get started!`,
    link: `/designer/preorders/${p.id}`,
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
    subject: `Preorder paid — ${p.post?.title ?? "your piece"}`,
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
