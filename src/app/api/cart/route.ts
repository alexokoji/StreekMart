import { NextResponse } from "next/server";
import { z } from "zod";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";

// Get-or-create the current user's cart (lazy provisioning).
async function getOrCreateCart(userId: string) {
  return prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

// GET /api/cart → returns the items in the current user's cart.
export async function GET() {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const cart = await getOrCreateCart(guard.session.sub);
  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    include: { product: { include: { seller: { select: { id: true, name: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  const shaped = items.map((it) => {
    const effectivePrice = it.product.salePrice ?? it.product.price;
    return {
      id: it.id,
      quantity: it.quantity,
      product: {
        id: it.product.id,
        name: it.product.name,
        price: it.product.price,
        salePrice: it.product.salePrice,
        effectivePrice,
        category: it.product.category,
        image: parseJsonArray(it.product.imagesJson)[0] ?? null,
        seller: it.product.seller,
        stock: it.product.stock,
        status: it.product.status,
      },
      lineTotal: effectivePrice * it.quantity,
    };
  });

  const subtotal = shaped.reduce((sum, it) => sum + it.lineTotal, 0);

  return NextResponse.json({
    items: shaped,
    subtotal,
    itemCount: shaped.reduce((n, it) => n + it.quantity, 0),
  });
}

// POST /api/cart { productId, quantity? } → add to cart (or increment quantity).
const AddBody = z.object({
  productId: z.string(),
  quantity: z.number().int().positive().max(20).optional(),
});

export async function POST(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = AddBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const product = await prisma.product.findUnique({ where: { id: parsed.data.productId } });
  if (!product || product.status !== ProductStatus.ACTIVE) {
    return NextResponse.json({ error: "Product not available" }, { status: 404 });
  }
  if (product.sellerId === guard.session.sub) {
    return NextResponse.json({ error: "You can't add your own listing to your cart." }, { status: 400 });
  }

  const cart = await getOrCreateCart(guard.session.sub);
  const qty = parsed.data.quantity ?? 1;

  // Upsert keeps add-twice from creating duplicate rows; existing rows get the
  // requested quantity added on top.
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId: product.id } },
  });

  const newQty = Math.min(product.stock, (existing?.quantity ?? 0) + qty);

  const item = await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId: product.id } },
    create: { cartId: cart.id, productId: product.id, quantity: newQty },
    update: { quantity: newQty },
  });

  return NextResponse.json({ item, addedQuantity: newQty - (existing?.quantity ?? 0) });
}

// DELETE /api/cart → clear the entire cart.
export async function DELETE() {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const cart = await getOrCreateCart(guard.session.sub);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return NextResponse.json({ ok: true });
}
