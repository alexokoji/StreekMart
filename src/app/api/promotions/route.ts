import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import {
  Permission,
  PROMOTION_DURATION_DAYS,
  PROMOTION_FEE_KOBO,
  PROMOTION_FEE_NGN,
  PROMOTION_PAID_BOOST,
  PromotionStatus,
} from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { hasManagerPermission } from "@/lib/managersServer";
import { getGatewaySelector } from "@/lib/gatewaySelector";

// POST /api/promotions { kind, id }
//
// Product promotions are paid (₦500 / 3 days, admin-approved). The flow:
//   1. Create a Promotion row with status=PENDING_PAYMENT and a fresh
//      paymentReference (`PROMO_<random>`).
//   2. Init a payment gateway transaction for ₦500 using that reference.
//   3. Respond with the checkout URL so the client can redirect.
//   4. /api/*/webhook flips the row to PENDING_REVIEW on success
//      and CANCELLED on failure.
//   5. /api/admin/promotions/[id] flips PENDING_REVIEW → APPROVED, sets
//      startsAt=now / endsAt=now+3d, and writes active=true. Rejection
//      refunds ₦500 to the seller's wallet.
//
// Post promotions stay on the legacy free flow — no payment, immediately
// active. The homepage slider is product-only so a paid post-promote
// would have no surface to recoup on.

const Body = z.object({
  kind: z.enum(["product", "post"]),
  id: z.string(),
  // Only honoured by the post (free) branch. Products are fixed at
  // PROMOTION_DURATION_DAYS.
  days: z.number().int().positive().max(60).default(7),
  boost: z.number().min(1).max(5).optional(),
});

export async function POST(req: Request) {
  const guard = await requireApiUser([Permission.SELLER, Permission.DESIGNER]);
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { kind, id, days, boost } = parsed.data;

  if (kind === "product") {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const ok = await hasManagerPermission(guard.session.sub, product.sellerId, "manage_promotions");
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Guard against a second submission while one is in flight or already
    // approved — keeps the queue clean and stops sellers double-paying.
    const live = await prisma.promotion.findFirst({
      where: {
        productId: id,
        status: {
          in: [
            PromotionStatus.PENDING_PAYMENT,
            PromotionStatus.PENDING_REVIEW,
            PromotionStatus.APPROVED,
          ],
        },
        OR: [
          { status: { not: PromotionStatus.APPROVED } },
          { endsAt: { gt: new Date() } },
        ],
      },
    });
    if (live) {
      return NextResponse.json(
        {
          error:
            live.status === PromotionStatus.APPROVED
              ? "This product is already promoted."
              : "A promotion request is already in progress for this product.",
        },
        { status: 409 },
      );
    }

    const reference = `PROMO_${randomBytes(8).toString("hex").toUpperCase()}`;
    // endsAt is a not-null column, but the real end date is set on admin
    // approval. Stuff a placeholder far enough in the past that no live
    // query ever picks it up.
    const placeholderEndsAt = new Date(0);

    const promotion = await prisma.promotion.create({
      data: {
        ownerId: product.sellerId,
        productId: id,
        boost: PROMOTION_PAID_BOOST,
        status: PromotionStatus.PENDING_PAYMENT,
        priceCents: PROMOTION_FEE_KOBO,
        paymentReference: reference,
        startsAt: new Date(),
        endsAt: placeholderEndsAt,
        active: false,
      },
    });

    // Init payment gateway. The user is the seller, paying the platform for
    // visibility — we send their email/name so the receipt matches.
    const me = await prisma.user.findUnique({
      where: { id: guard.session.sub },
      select: { email: true, name: true },
    });
    if (!me) {
      // Shouldn't happen — guarded above — but bail cleanly.
      await prisma.promotion.delete({ where: { id: promotion.id } });
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    try {
      const gateway = getGatewaySelector();
      const init = await gateway.initCheckout({
        amountCents: PROMOTION_FEE_KOBO,
        customerEmail: me.email,
        customerName: me.name,
        description: `Product promotion · ${product.name.slice(0, 50)} (${PROMOTION_DURATION_DAYS} days)`,
        paymentReference: reference,
        redirectUrl: buildRedirectUrl(req, product.id),
      });

      // Stub mode has no real payment surface — auto-mark the row as
      // PENDING_REVIEW so the admin queue can see it. Send the seller
      // straight back to the product page instead of through the gateway's
      // synthetic checkout URL (which assumes an active cart).
      if (gateway.isStubMode()) {
        await prisma.promotion.update({
          where: { id: promotion.id },
          data: {
            status: PromotionStatus.PENDING_REVIEW,
            paidAt: new Date(),
            paymentTxnRef: `STUB_${reference}`,
          },
        });
        return NextResponse.json({
          promotion,
          checkoutUrl: buildRedirectUrl(req, product.id),
          feeNgn: PROMOTION_FEE_NGN,
          durationDays: PROMOTION_DURATION_DAYS,
          stub: true,
        });
      }

      return NextResponse.json({
        promotion,
        checkoutUrl: init.checkoutUrl,
        feeNgn: PROMOTION_FEE_NGN,
        durationDays: PROMOTION_DURATION_DAYS,
      });
    } catch (err) {
      // Roll back the placeholder row so the seller can retry. The
      // Monnify init is the only side-effecting call, so a clean delete
      // here is safe.
      await prisma.promotion.delete({ where: { id: promotion.id } });
      console.error("[promotions] Monnify init failed:", err);
      return NextResponse.json(
        {
          error:
            err instanceof Error && err.message
              ? `Couldn't start the payment: ${err.message}`
              : "Couldn't start the payment. Try again in a moment.",
        },
        { status: 502 },
      );
    }
  }

  // ---- Post (legacy free flow) ----
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const okPost = await hasManagerPermission(guard.session.sub, post.authorId, "manage_promotions");
  if (!okPost) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const endsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const promotion = await prisma.promotion.create({
    data: {
      ownerId: post.authorId,
      postId: id,
      boost: boost ?? 1.5,
      status: PromotionStatus.APPROVED,
      startsAt: now,
      endsAt,
      active: true,
    },
  });
  return NextResponse.json({ promotion });
}

// Where Monnify bounces the seller after the checkout. We send them
// back to the product page with a flag so the UI can render a "thanks,
// pending review" toast — see PromoteButton's post-redirect handling.
function buildRedirectUrl(req: Request, productId: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    new URL(req.url).origin;
  return `${base}/seller/products/${productId}?promo=pending`;
}
