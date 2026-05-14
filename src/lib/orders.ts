// Order lifecycle helpers shared between the checkout endpoint and the
// Monnify webhook. Both paths need to:
//   1. Move PENDING orders into PAID,
//   2. Bump product sales counters + seller exposure,
//   3. Credit each seller's wallet net of platform fee,
//   4. Clear the buyer's cart.
//
// Putting it here means the live (webhook-driven) and stub (immediate)
// flows can't drift apart.

import { OrderStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { exposureDelta } from "@/lib/ranking";
import { recordSale } from "@/lib/wallet";

// How many days a buyer has to wait between payment and the option to
// self-cancel an undelivered order. Conservative default — long enough for
// real shipping, short enough that a non-shipping seller can't sit on funds.
export const DELIVERY_WINDOW_DAYS = 14;

export type FinalizeResult = {
  finalisedOrderIds: string[];
  alreadyFinalisedIds: string[];
};

// Idempotent. Safe to call twice for the same paymentReference — the second
// call is a no-op because the orders are no longer in PENDING.
export async function finalizePaidOrders(args: {
  paymentReference: string;
  paymentTxnRef?: string;
}): Promise<FinalizeResult> {
  const orders = await prisma.order.findMany({
    where: { paymentReference: args.paymentReference },
    include: { product: true },
  });

  if (orders.length === 0) {
    return { finalisedOrderIds: [], alreadyFinalisedIds: [] };
  }

  const pending = orders.filter((o) => o.status === OrderStatus.PENDING);
  const already = orders.filter((o) => o.status !== OrderStatus.PENDING);

  if (pending.length === 0) {
    return { finalisedOrderIds: [], alreadyFinalisedIds: already.map((o) => o.id) };
  }

  // Move every pending order in this group into PAID atomically and stamp
  // both `paidAt` and `expectedDeliveryBy` so the buyer-cancel rule has a
  // deadline to compare against.
  const paidAt = new Date();
  const expectedDeliveryBy = new Date(
    paidAt.getTime() + DELIVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  await prisma.$transaction(
    pending.map((o) =>
      prisma.order.update({
        where: { id: o.id },
        data: {
          status: OrderStatus.PAID,
          paymentTxnRef: args.paymentTxnRef ?? o.paymentTxnRef,
          paidAt,
          expectedDeliveryBy,
        },
      }),
    ),
  );

  // Per-line side effects (sales counters, exposure, wallet credit). The
  // product's *current* status is irrelevant here — the buyer already paid,
  // so the seller must be credited even if the listing was archived in the
  // meantime.
  for (const o of pending) {
    await prisma.$transaction([
      prisma.product.update({
        where: { id: o.productId },
        data: { salesCount: { increment: o.quantity } },
      }),
      prisma.user.update({
        where: { id: o.sellerId },
        data: { exposureScore: { increment: exposureDelta("sale") * o.quantity } },
      }),
    ]);
    await recordSale({
      sellerId: o.sellerId,
      grossCents: Math.round(o.totalPrice * 100),
      productName: o.product.name,
      orderId: o.id,
    });
  }

  // Clear the buyer's cart of anything that just got finalised. Same buyer
  // for every order in the group, so we look up the cart once.
  const buyerId = pending[0].buyerId;
  const cart = await prisma.cart.findUnique({ where: { userId: buyerId } });
  if (cart) {
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id, productId: { in: pending.map((o) => o.productId) } },
    });
  }

  return {
    finalisedOrderIds: pending.map((o) => o.id),
    alreadyFinalisedIds: already.map((o) => o.id),
  };
}

// Mark every order in a payment group as CANCELLED. Used when Monnify
// reports a failed transaction. Idempotent like finalizePaidOrders.
export async function cancelPendingOrders(paymentReference: string): Promise<string[]> {
  const orders = await prisma.order.findMany({
    where: { paymentReference, status: OrderStatus.PENDING },
    select: { id: true },
  });
  if (orders.length === 0) return [];
  await prisma.order.updateMany({
    where: { id: { in: orders.map((o) => o.id) } },
    data: { status: OrderStatus.CANCELLED },
  });
  return orders.map((o) => o.id);
}
