import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { OrderStatus, ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { initTransaction, isLiveMode } from "@/lib/monnify";
import { finalizePaidOrders } from "@/lib/orders";
import { availableBalanceCents, chargeWalletForPurchase } from "@/lib/wallet";

// POST /api/cart/checkout — converts cart items into Orders (one per
// seller×product) under a single payment group.
//
// Live Monnify (MONNIFY_LIVE=1):
//   1. Create orders as PENDING with a shared `paymentReference`.
//   2. Call Monnify init-transaction to mint a checkout URL.
//   3. Return { redirectUrl } so the client can hand off to the gateway.
//   4. The webhook (POST /api/monnify/webhook) finalises everything when
//      Monnify confirms the payment.
//
// Stub mode (default for dev):
//   1. Create orders as PENDING.
//   2. Immediately call finalizePaidOrders so the dev/UX flow still ends in
//      PAID without going through a real gateway.

const Body = z.object({
  shippingAddress: z.string().min(5).max(500),
  notes: z.string().max(500).optional(),
  // "DIRECT" — pay upfront via Monnify (default).
  // "ON_DELIVERY" — pay cash on arrival; only allowed for trusted buyers.
  paymentMethod: z.enum(["DIRECT", "ON_DELIVERY"]).default("DIRECT"),
  // Apply the buyer's wallet credit (refunds, etc.) toward this order.
  // The server caps it at the smaller of (available wallet, order total).
  // If the wallet covers the whole order, no gateway call is made.
  useWalletCredit: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Pay-on-delivery is only available to admin-approved trusted buyers
  // (Order.paymentMethod=ON_DELIVERY). Until the trust gate is rolled out,
  // every check fails closed — POD is effectively coming soon.
  if (parsed.data.paymentMethod === "ON_DELIVERY") {
    const me = await prisma.user.findUnique({
      where: { id: guard.session.sub },
      select: { trustedBuyer: true },
    });
    if (!me?.trustedBuyer) {
      return NextResponse.json(
        {
          error:
            "Pay on delivery is currently only available to trusted buyers. " +
            "Complete a few delivered orders first; we'll email you when it's enabled on your account.",
        },
        { status: 403 },
      );
    }
  }

  const cart = await prisma.cart.findUnique({
    where: { userId: guard.session.sub },
    include: { items: { include: { product: true } } },
  });
  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  const live = cart.items.filter((it) => it.product.status === ProductStatus.ACTIVE);
  if (live.length === 0) {
    return NextResponse.json(
      { error: "None of the items in your cart are available right now." },
      { status: 400 },
    );
  }

  // One reference per checkout group. Used by the webhook to find every
  // sibling order and finalise them together.
  const paymentReference = `UPCLO_${randomBytes(8).toString("hex").toUpperCase()}`;

  const orders = await prisma.$transaction(
    live.map((it) => {
      const unitPrice = it.product.salePrice ?? it.product.price;
      return prisma.order.create({
        data: {
          productId: it.product.id,
          buyerId: guard.session.sub,
          sellerId: it.product.sellerId,
          quantity: it.quantity,
          totalPrice: unitPrice * it.quantity,
          status: OrderStatus.PENDING,
          shippingAddress: parsed.data.shippingAddress,
          notes: parsed.data.notes,
          paymentMethod: parsed.data.paymentMethod,
          paymentReference,
        },
      });
    }),
  );

  const totalCents = Math.round(orders.reduce((s, o) => s + o.totalPrice, 0) * 100);

  // Apply wallet credit first if the buyer asked for it. The wallet is
  // debited *now* (with idempotency keyed on paymentReference) so a partial
  // gateway charge can't leave both ledgers half-applied later.
  let walletAppliedCents = 0;
  if (parsed.data.useWalletCredit) {
    const available = await availableBalanceCents(guard.session.sub);
    if (available > 0) {
      walletAppliedCents = await chargeWalletForPurchase({
        userId: guard.session.sub,
        maxApplyCents: totalCents,
        paymentReference,
      });
    }
  }
  const remainingCents = Math.max(0, totalCents - walletAppliedCents);

  // If the wallet fully covers the order, finalise immediately. No gateway
  // hop, no live-mode check — the buyer already paid (with refund credit)
  // and the seller's held-funds flow kicks in just like a card payment.
  if (remainingCents === 0) {
    await finalizePaidOrders({
      paymentReference,
      paymentTxnRef: `WALLET_${paymentReference}`,
    });
    return NextResponse.json({
      ok: true,
      paymentReference,
      walletAppliedCents,
      paidByWallet: true,
      orders: orders.map((o) => ({ id: o.id })),
    });
  }

  if (isLiveMode()) {
    try {
      const txn = await initTransaction({
        amountCents: remainingCents,
        customerEmail: guard.session.email,
        customerName: guard.session.name,
        description:
          walletAppliedCents > 0
            ? `StreekMart order × ${orders.length} (wallet applied)`
            : `StreekMart order × ${orders.length}`,
        paymentReference,
        redirectUrl: buildRedirectUrl(req, paymentReference),
      });
      return NextResponse.json({
        ok: true,
        paymentReference,
        walletAppliedCents,
        redirectUrl: txn.checkoutUrl,
        orders: orders.map((o) => ({ id: o.id })),
      });
    } catch (err) {
      // If the gateway hand-off fails we cancel the freshly created orders
      // so the buyer can retry without ghost PENDING rows piling up. The
      // wallet debit is reversed by an explicit credit so the buyer doesn't
      // lose their credit on a failed attempt.
      await prisma.order.updateMany({
        where: { paymentReference },
        data: { status: OrderStatus.CANCELLED },
      });
      if (walletAppliedCents > 0) {
        // Reverse the wallet debit so the buyer doesn't lose credit on a
        // failed gateway hand-off. Single transaction so the ledger entry
        // and the balance bump always agree.
        await prisma.$transaction(async (tx) => {
          const wallet = await tx.wallet.findUniqueOrThrow({
            where: { userId: guard.session.sub },
          });
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              amountCents: walletAppliedCents,
              type: "REFUND",
              description: `Reversed — checkout ${paymentReference} failed at gateway`,
              refType: "checkout",
              refId: paymentReference,
            },
          });
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balanceCents: { increment: walletAppliedCents } },
          });
        });
      }
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not start payment." },
        { status: 502 },
      );
    }
  }

  // Stub mode: short-circuit straight through to PAID via the same helper
  // the webhook calls. Keeps the post-payment side effects in one place.
  await finalizePaidOrders({ paymentReference, paymentTxnRef: `STUB_${paymentReference}` });
  return NextResponse.json({
    ok: true,
    paymentReference,
    walletAppliedCents,
    orders: orders.map((o) => ({ id: o.id })),
  });
}

function buildRedirectUrl(req: Request, paymentReference: string): string {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;
  return `${origin}/cart/checkout/return?ref=${encodeURIComponent(paymentReference)}`;
}
