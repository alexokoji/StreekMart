import { NextResponse } from "next/server";
import { z } from "zod";
import { OrderStatus, ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { exposureDelta } from "@/lib/ranking";

// GET /api/orders?scope=seller|buyer&status=ACTIVE|COMPLETED
// "ACTIVE"  → PENDING|PAID|SHIPPED
// "COMPLETED" → COMPLETED|CANCELLED
export async function GET(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const url = new URL(req.url);
  // Default scope: sellers see their seller-side orders, everyone else sees their buyer-side.
  const scope = url.searchParams.get("scope") ?? (guard.session.isSeller ? "seller" : "buyer");
  const statusFilter = url.searchParams.get("status");

  let statuses: OrderStatus[] | undefined;
  if (statusFilter === "ACTIVE") statuses = [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.SHIPPED];
  else if (statusFilter === "COMPLETED") statuses = [OrderStatus.COMPLETED, OrderStatus.CANCELLED];

  const where = scope === "seller"
    ? { sellerId: guard.session.sub }
    : { buyerId: guard.session.sub };

  const orders = await prisma.order.findMany({
    where: { ...where, ...(statuses ? { status: { in: statuses } } : {}) },
    include: {
      product: true,
      buyer: { select: { id: true, name: true, email: true } },
      seller: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ orders });
}

const CreateBody = z.object({
  productId: z.string(),
  quantity: z.number().int().positive().default(1),
  shippingAddress: z.string().optional(),
  notes: z.string().optional(),
});

// POST /api/orders — any logged-in user (Buyer permission is implicit).
// Direct-buy path; the recommended flow is via the cart, but we keep this
// for product detail page "Buy now" compatibility.
export async function POST(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const product = await prisma.product.findUnique({ where: { id: parsed.data.productId } });
  if (!product || product.status !== ProductStatus.ACTIVE) {
    return NextResponse.json({ error: "Product not available" }, { status: 400 });
  }

  const totalPrice = product.price * parsed.data.quantity;
  const order = await prisma.order.create({
    data: {
      productId: product.id,
      buyerId: guard.session.sub,
      sellerId: product.sellerId,
      quantity: parsed.data.quantity,
      totalPrice,
      shippingAddress: parsed.data.shippingAddress,
      notes: parsed.data.notes,
    },
  });

  // Bump seller exposure & product sales counter.
  await prisma.$transaction([
    prisma.product.update({
      where: { id: product.id },
      data: { salesCount: { increment: parsed.data.quantity } },
    }),
    prisma.user.update({
      where: { id: product.sellerId },
      data: { exposureScore: { increment: exposureDelta("sale") * parsed.data.quantity } },
    }),
  ]);

  return NextResponse.json({ order });
}
