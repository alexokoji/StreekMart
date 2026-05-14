import { NextResponse } from "next/server";
import { z } from "zod";
import { Permission, ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { hasManagerPermission } from "@/lib/managers";

// PATCH /api/products/[id]/status { status }
//
// Quick toggle for sellers/designers to take a listing on/off the storefront
// without going through the full edit form. Owners can do this themselves;
// managers need the "edit_products" permission.

const Body = z.object({
  status: z.nativeEnum(ProductStatus),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser([Permission.SELLER, Permission.DESIGNER]);
  if ("error" in guard) return guard.error;

  const product = await prisma.product.findUnique({ where: { id: params.id } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Owner OR a manager with edit_products on the owner's account can toggle.
  const ok = await hasManagerPermission(guard.session.sub, product.sellerId, "edit_products");
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const updated = await prisma.product.update({
    where: { id: params.id },
    data: { status: parsed.data.status },
    select: { id: true, status: true },
  });
  return NextResponse.json({ product: updated });
}
