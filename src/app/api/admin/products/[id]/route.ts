import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { ProductStatus } from "@/lib/enums";

// PATCH /api/admin/products/[id] { status: "ACTIVE" | "ARCHIVED" }
//
// Soft-disable: an admin flips the product's status to ARCHIVED. Every
// storefront surface (home rails, search, feed, cart, checkout) already
// filters `where: { status: ACTIVE }`, so archived products vanish from
// public view immediately — but the row, its reviews, and any historical
// orders that reference it stay intact. Reversible: PATCH back to ACTIVE
// to restore.
//
// DELETE /api/admin/products/[id]?confirm=<product id>
//
// Hard delete. Cascades to Review, Favorite, Like, Promotion, Sketch,
// CartItem, OrderUpdate references, etc. Orders survive (Product.orders
// has no Cascade because we don't want to nuke order history when a
// product is removed). Use ARCHIVE for anything reversible.

const PatchBody = z.object({
  status: z.enum([ProductStatus.ACTIVE, ProductStatus.ARCHIVED]),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_PRODUCTS);
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const target = await prisma.product.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.product.update({
    where: { id: target.id },
    data: { status: parsed.data.status },
    select: { id: true, status: true, name: true },
  });

  return NextResponse.json({ ok: true, product: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_PRODUCTS);
  if ("error" in guard) return guard.error;

  const target = await prisma.product.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Require the product id as a typed confirmation so a misclick can't
  // silently nuke a listing with reviews + history attached.
  const confirm = new URL(req.url).searchParams.get("confirm");
  if (!confirm || confirm !== target.id) {
    return NextResponse.json(
      {
        error:
          "Pass `?confirm=<product id>` to confirm. This cascades and cannot be undone.",
      },
      { status: 400 },
    );
  }

  await prisma.product.delete({ where: { id: target.id } });
  return NextResponse.json({ ok: true });
}
