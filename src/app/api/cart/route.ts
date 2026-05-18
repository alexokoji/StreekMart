import { NextResponse } from "next/server";
import { z } from "zod";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";
import { unitConfig, validateQuantity } from "@/lib/units";

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
        unit: it.product.unit,
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
    // Distinct line items, not summed quantity — for "yard" / "meter" units a
    // sum-of-quantities badge would be misleading ("3.5 items in cart").
    itemCount: shaped.length,
  });
}

// POST /api/cart { productId, quantity? } → add to cart (or increment quantity).
const AddBody = z.object({
  productId: z.string(),
  // Float so fabric units (yard/meter/etc.) accept fractions. The unit's
  // step rule is enforced below against the product's `unit` field.
  quantity: z.number().positive().max(1000).optional(),
  // Required when the product has stocked sizes; ignored otherwise. We
  // validate against the product's actual size list below.
  size: z.string().min(1).max(20).optional(),
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
  const qty = parsed.data.quantity ?? unitConfig(product.unit).step;
  // Per-unit step + positivity check.
  const stepError = validateQuantity(qty, product.unit);
  if (stepError) {
    return NextResponse.json({ error: stepError }, { status: 400 });
  }

  // Size validation. The product's stocked sizes live in `sizesJson`. If
  // any sizes are listed, the buyer must pick one; the picked size must be
  // in the list. Unsized products ignore the field entirely.
  const stockedSizes = parseJsonArray(product.sizesJson);
  let size: string | null = null;
  if (stockedSizes.length > 0) {
    if (!parsed.data.size) {
      return NextResponse.json(
        { error: "Pick a size before adding this to your cart." },
        { status: 400 },
      );
    }
    if (!stockedSizes.includes(parsed.data.size)) {
      return NextResponse.json(
        { error: `Size "${parsed.data.size}" isn't available for this item.` },
        { status: 400 },
      );
    }
    size = parsed.data.size;
  }

  // Upsert keeps add-twice from creating duplicate rows; existing rows get the
  // requested quantity added on top. Changing the size on an existing row
  // overwrites — the buyer ends up with the most recently picked size.
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId: product.id } },
  });

  const newQty = Math.min(product.stock, (existing?.quantity ?? 0) + qty);

  const item = await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId: product.id } },
    create: { cartId: cart.id, productId: product.id, quantity: newQty, size },
    update: { quantity: newQty, size: size ?? existing?.size ?? null },
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
