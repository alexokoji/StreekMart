import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { validateQuantity } from "@/lib/units";

// Float quantity — see CartItem.quantity in schema.prisma. The unit's step
// rule is enforced after we look up the product (we need product.unit).
const PatchBody = z.object({ quantity: z.number().positive().max(1000) });

// PATCH /api/cart/items/[id] — set quantity for a cart line item.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const item = await prisma.cartItem.findUnique({
    where: { id: params.id },
    include: { cart: true, product: true },
  });
  if (!item || item.cart.userId !== guard.session.sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stepError = validateQuantity(parsed.data.quantity, item.product.unit);
  if (stepError) return NextResponse.json({ error: stepError }, { status: 400 });

  const qty = Math.min(item.product.stock, parsed.data.quantity);
  const updated = await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: qty } });
  return NextResponse.json({ item: updated });
}

// DELETE /api/cart/items/[id] — remove a single line item.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const item = await prisma.cartItem.findUnique({
    where: { id: params.id },
    include: { cart: true },
  });
  if (!item || item.cart.userId !== guard.session.sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.cartItem.delete({ where: { id: item.id } });
  return NextResponse.json({ ok: true });
}
