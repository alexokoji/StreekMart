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
import { recordSale, recordTransaction } from "@/lib/wallet";
import { generateDeliveryCode } from "@/lib/deliveryCode";
import { orderPlacedEmail, sendEmail } from "@/lib/email";
import { sendPush } from "@/lib/notifications";
import {
  formatAttributeSelection,
  parseAttributeSelection,
} from "@/lib/productAttributes";
import { platformDeliveryCutBps } from "@/lib/locationServer";

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
  // deadline to compare against. Each order also gets a unique 4-char
  // delivery code the buyer will share with the dispatch rider.
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
          // Only assign if missing — preserves any code already set on a
          // re-fired webhook (idempotent finalisation).
          deliveryCode: o.deliveryCode ?? generateDeliveryCode(),
        },
      }),
    ),
  );

  // Per-line side effects (sales counters, exposure, wallet credit). The
  // product's *current* status is irrelevant here — the buyer already paid,
  // so the seller must be credited even if the listing was archived in the
  // meantime.
  //
  // Delivery fee split (introduced when the platform took over fees):
  //   - PLATFORM fulfiller → fee stays with platform; seller gets only the
  //     product portion credited.
  //   - SELLER fulfiller   → seller's wallet gets (fee − platform cut)
  //     credited as a separate DELIVERY entry.
  const cutBps = await platformDeliveryCutBps();

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

    // Product-only credit (subtract delivery from the total so we don't
    // double-count it; `recordSale` applies the product-side PLATFORM_FEE_BPS).
    const totalCents = Math.round(o.totalPrice * 100);
    const productCents = totalCents - o.deliveryFeeCents;
    await recordSale({
      sellerId: o.sellerId,
      grossCents: productCents,
      productName: o.product.name,
      orderId: o.id,
    });

    // Delivery credit — only when the seller is the fulfiller. Held
    // alongside the product credit; releases together when buyer/rider
    // confirms delivery.
    if (o.deliveryFeeCents > 0 && o.deliveryFulfiller === "SELLER") {
      const cut = Math.round((o.deliveryFeeCents * cutBps) / 10000);
      const netDelivery = o.deliveryFeeCents - cut;
      await recordTransaction({
        userId: o.sellerId,
        amountCents: netDelivery,
        type: "SALE_CREDIT",
        description: `Delivery fee (net of platform cut) for order #${o.id.slice(0, 8)}`,
        refType: "order",
        refId: o.id,
      });
      if (cut > 0) {
        await recordTransaction({
          userId: o.sellerId,
          amountCents: -cut,
          type: "PLATFORM_FEE",
          description: `Delivery platform cut (${(cutBps / 100).toFixed(2)}%)`,
          refType: "order",
          refId: o.id,
        });
      }
      // Add the delivery net to held funds — released when delivery confirms.
      await prisma.wallet.update({
        where: { userId: o.sellerId },
        data: { heldCents: { increment: netDelivery } },
      });
    }
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

  // Send the buyer one confirmation email per order in this checkout group.
  // Each order has its own delivery code; sending separately keeps the code
  // visually obvious in the inbox. Fire-and-forget — email failure mustn't
  // roll back the payment.
  const buyer = await prisma.user.findUnique({
    where: { id: buyerId },
    select: { email: true, name: true },
  });
  if (buyer?.email) {
    const fresh = await prisma.order.findMany({
      where: { id: { in: pending.map((o) => o.id) } },
      include: { product: { select: { name: true } } },
    });
    for (const o of fresh) {
      const variantSummary = formatAttributeSelection(
        parseAttributeSelection(o.selectedAttributesJson),
      );
      const tpl = orderPlacedEmail({
        name: buyer.name,
        orderId: o.id,
        productName: o.product.name,
        deliveryCode: o.deliveryCode,
        totalDisplay: `₦${o.totalPrice.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        variantSummary: variantSummary || undefined,
      });
      void sendEmail({ to: buyer.email, ...tpl })
        .then((r) => {
          if (!r.ok) console.error("[email:order-placed] failed", { orderId: o.id, to: buyer.email, error: r.error });
        })
        .catch((err) => console.error("[email:order-placed] threw", { orderId: o.id, to: buyer.email, err }));

      // Native push alongside the email — taps deep-link straight to the
      // order tracking page so the buyer can see the delivery code without
      // hunting through the app.
      void sendPush({
        userId: buyerId,
        title: "Order confirmed",
        body:
          `${o.product.name}` +
          (variantSummary ? ` · ${variantSummary}` : "") +
          ` · code ${o.deliveryCode ?? "ready"}`,
        link: `/account/orders/${o.id}`,
        data: { type: "order-placed", orderId: o.id },
      }).catch((err) => console.error("[push:order-placed] threw", { orderId: o.id, err }));
    }
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

// Get shipment details for an order with full tracking info.
export async function getOrderShipment(orderId: string) {
  const shipment = await prisma.shipment.findUnique({
    where: { orderId },
  });
  return shipment;
}

// Check if an order has a shipment created.
export async function orderHasShipment(orderId: string): Promise<boolean> {
  const shipment = await prisma.shipment.findUnique({
    where: { orderId },
  });
  return !!shipment;
}

