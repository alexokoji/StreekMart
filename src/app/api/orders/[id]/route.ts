import { NextResponse } from "next/server";
import { z } from "zod";
import { OrderStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { hasManagerPermission } from "@/lib/managers";
import {
  creditRefundToWallet,
  releaseHeldFundsForOrder,
  reverseHeldFundsForOrder,
} from "@/lib/wallet";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      product: true,
      buyer: { select: { id: true, name: true, email: true } },
      seller: { select: { id: true, name: true, email: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only buyer or seller on the order can view it.
  if (order.buyerId !== guard.session.sub && order.sellerId !== guard.session.sub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ order });
}

const PatchBody = z.object({ status: z.nativeEnum(OrderStatus) });

// Sellers update status (PAID → SHIPPED → COMPLETED). Buyers can CANCEL while PENDING.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const next = parsed.data.status;
  // Sellers act on their own orders. Managers with `manage_orders` on the
  // seller can act on the seller's behalf.
  const sellerOrManager = await hasManagerPermission(
    guard.session.sub,
    order.sellerId,
    "manage_orders",
  );
  const isBuyer = order.buyerId === guard.session.sub;

  const sellerCanSet: OrderStatus[] = [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.COMPLETED, OrderStatus.CANCELLED];
  const buyerCanSet: OrderStatus[] = [OrderStatus.CANCELLED];

  if (sellerOrManager && !sellerCanSet.includes(next)) {
    return NextResponse.json({ error: "Invalid transition" }, { status: 400 });
  }
  if (!sellerOrManager && isBuyer && !buyerCanSet.includes(next)) {
    return NextResponse.json({ error: "Invalid transition" }, { status: 400 });
  }
  if (!sellerOrManager && !isBuyer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Buyer cancellation rules:
  //  - PENDING (not yet paid) → free to cancel.
  //  - PAID / SHIPPED → only after the delivery window has elapsed. Protects
  //    the buyer from a seller who took payment and never shipped, while
  //    preventing instant chargeback abuse.
  //  - COMPLETED → never; that's a dispute, not a cancel.
  if (!sellerOrManager && isBuyer && next === OrderStatus.CANCELLED) {
    if (order.status === OrderStatus.COMPLETED) {
      return NextResponse.json(
        { error: "This order was marked delivered. Open a dispute instead." },
        { status: 400 },
      );
    }
    if (order.status === OrderStatus.PAID || order.status === OrderStatus.SHIPPED) {
      const deadline = order.expectedDeliveryBy?.getTime() ?? 0;
      if (deadline === 0 || Date.now() < deadline) {
        const remainingDays = Math.max(
          0,
          Math.ceil((deadline - Date.now()) / (24 * 60 * 60 * 1000)),
        );
        return NextResponse.json(
          {
            error:
              `You can self-cancel this order after the delivery window` +
              (remainingDays ? ` (≈${remainingDays} day${remainingDays === 1 ? "" : "s"} left).` : `.`),
          },
          { status: 400 },
        );
      }
    }
  }

  // Seller withdrawal protection: sellers cannot mark their own order as
  // COMPLETED — only the buyer can. This is the trigger that releases held
  // funds, so allowing the seller would defeat the escrow guarantee.
  if (sellerOrManager && !isBuyer && next === OrderStatus.COMPLETED) {
    return NextResponse.json(
      { error: "Only the buyer can confirm delivery." },
      { status: 403 },
    );
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: next },
  });

  // Side-effects after the status flip lands in the DB.
  try {
    if (next === OrderStatus.COMPLETED) {
      // Buyer confirmed delivery → release the seller's held funds.
      await releaseHeldFundsForOrder(order.id);
    } else if (
      next === OrderStatus.CANCELLED &&
      (order.status === OrderStatus.PAID || order.status === OrderStatus.SHIPPED)
    ) {
      // Cancellation of a paid order → claw back the seller's held credit
      // AND credit the buyer's wallet with the refund. The buyer can spend
      // that credit on a new purchase or withdraw it to their bank.
      await reverseHeldFundsForOrder(order.id);
      await creditRefundToWallet({
        buyerId: order.buyerId,
        amountCents: Math.round(order.totalPrice * 100),
        description: `Refund — cancelled order #${order.id.slice(0, 8)}`,
        orderId: order.id,
      });
    }
  } catch (err) {
    // Side-effect failed but the status flip already happened. Surface it
    // so support can manually reconcile; don't re-flip the order.
    console.error("[orders PATCH] post-status hook failed", { orderId: order.id, err });
  }

  return NextResponse.json({ order: updated });
}
