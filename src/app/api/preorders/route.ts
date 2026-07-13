import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { getGatewaySelector } from "@/lib/gatewaySelector";
import { PreorderStatus } from "@/lib/preorders";
import { markDesignPaid } from "@/lib/preorderPayment";
import { sendPush } from "@/lib/notifications";

// POST /api/preorders { postId | productId, notes? }
//
// Buyer requests a preorder of either a designer's post-attached piece or
// a seller's product listing.
//   1. Snapshot the source's current price + lead onto the Preorder row.
//   2. Initialise the payment gateway with reference `PREORDER_DESIGN_<id>`.
//   3. Return the checkout URL — buyer is redirected by the client.
//   4. The Monnify / Korapay webhook flips the status to AWAITING_READY
//      when payment confirms (see /api/monnify/webhook).

function buildRedirectUrl(req: Request, preorderId: string): string {
  const origin = new URL(req.url).origin;
  return `${origin}/account/preorders/${preorderId}`;
}

const Body = z
  .object({
    postId: z.string().min(1).optional(),
    productId: z.string().min(1).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((b) => Boolean(b.postId) !== Boolean(b.productId), {
    message: "Provide exactly one of postId or productId.",
  });

type Source = {
  kind: "post" | "product";
  id: string;
  title: string;
  priceCents: number;
  leadDays: number;
  fulfillerId: string;
  fulfillerSuspended: boolean;
};

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

  // Normalise the two possible sources (a Designer's Post or a Seller's
  // Product) into one shape so the rest of the handler is source-agnostic.
  let source: Source;

  if (parsed.data.postId) {
    const post = await prisma.post.findUnique({
      where: { id: parsed.data.postId },
      include: {
        author: { select: { id: true, suspendedAt: true } },
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
    source = {
      kind: "post",
      id: post.id,
      title: post.title,
      priceCents: post.preorderPriceCents,
      leadDays: post.preorderLeadDays,
      fulfillerId: post.author.id,
      fulfillerSuspended: Boolean(post.author.suspendedAt),
    };
  } else {
    const product = await prisma.product.findUnique({
      where: { id: parsed.data.productId },
      include: {
        seller: { select: { id: true, suspendedAt: true } },
      },
    });
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    if (
      !product.preorderEnabled ||
      typeof product.preorderPriceCents !== "number" ||
      typeof product.preorderLeadDays !== "number"
    ) {
      return NextResponse.json(
        { error: "This product isn't accepting preorders right now." },
        { status: 400 },
      );
    }
    source = {
      kind: "product",
      id: product.id,
      title: product.name,
      priceCents: product.preorderPriceCents,
      leadDays: product.preorderLeadDays,
      fulfillerId: product.seller.id,
      fulfillerSuspended: Boolean(product.seller.suspendedAt),
    };
  }

  if (source.fulfillerSuspended) {
    return NextResponse.json(
      { error: "This seller's account is currently inactive." },
      { status: 400 },
    );
  }
  if (source.fulfillerId === guard.session.sub) {
    return NextResponse.json(
      { error: "You can't preorder your own listing." },
      { status: 400 },
    );
  }

  const me = await prisma.user.findUnique({
    where: { id: guard.session.sub },
    select: { id: true, name: true, email: true },
  });
  if (!me) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const fulfillerBase = source.kind === "post" ? "/designer/preorders" : "/seller/preorders";

  // Create the preorder row first so we have an id for the payment ref.
  const preorder = await prisma.preorder.create({
    data: {
      buyerId: me.id,
      designerId: source.fulfillerId,
      postId: source.kind === "post" ? source.id : undefined,
      productId: source.kind === "product" ? source.id : undefined,
      priceCents: source.priceCents,
      leadDays: source.leadDays,
      notes: parsed.data.notes,
      status: PreorderStatus.PENDING_PAYMENT,
    },
  });

  const ref = `PREORDER_DESIGN_${preorder.id}`;
  await prisma.preorder.update({
    where: { id: preorder.id },
    data: { designPaymentRef: ref },
  });

  // Notify the fulfiller that a new request landed. Push only — they'll
  // see the order details on their preorders dashboard once payment clears.
  void sendPush({
    userId: source.fulfillerId,
    title: "New preorder request",
    body: `${me.name} wants "${source.title}" · ₦${(source.priceCents / 100).toLocaleString("en-NG")}`,
    link: `${fulfillerBase}/${preorder.id}`,
    data: { type: "preorder-request", preorderId: preorder.id },
  }).catch((err) =>
    console.error("[push:preorder-request] threw", { preorderId: preorder.id, err }),
  );

  // Initialise payment.
  const gateway = getGatewaySelector();
  try {
    const init = await gateway.initCheckout({
      amountCents: source.priceCents,
      customerEmail: me.email,
      customerName: me.name,
      description: `Preorder · ${source.title.slice(0, 50)}`,
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
