import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import {
  publishSupplierProduct,
  refreshListing,
  unpublishSupplierProduct,
} from "@/lib/suppliers/service";

const Body = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  images: z.array(z.string().trim().url()).max(10).optional(),
  category: z.string().trim().max(80).optional(),
  costPrice: z.number().positive().max(1e9).optional(),
  stock: z.number().int().min(0).max(1_000_000).optional(),
  // null clears the override (falls back to the supplier default).
  markupType: z.enum(["PERCENT", "FIXED"]).nullable().optional(),
  markupValue: z.number().min(0).max(1_000_000).nullable().optional(),
  action: z.enum(["publish", "unpublish"]).optional(),
});

// PATCH /api/admin/supplier-products/[id] — edit fields and/or publish.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_SUPPLIERS);
  if ("error" in guard) return guard.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const sp = await prisma.supplierProduct.findUnique({ where: { id: params.id } });
  if (!sp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { action, images, ...rest } = parsed.data;
  const hasOverrideType = rest.markupType !== undefined;
  const hasOverrideValue = rest.markupValue !== undefined;
  if (hasOverrideType !== hasOverrideValue) {
    return NextResponse.json({ error: "Set markup type and value together" }, { status: 400 });
  }
  await prisma.supplierProduct.update({
    where: { id: sp.id },
    data: { ...rest, ...(images ? { imagesJson: JSON.stringify(images) } : {}) },
  });
  try {
    if (action === "publish") {
      const r = await publishSupplierProduct(sp.id);
      return NextResponse.json({ ok: true, ...r });
    }
    if (action === "unpublish") {
      await unpublishSupplierProduct(sp.id);
    } else {
      await refreshListing(sp.id);
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE — only items that were never ordered. Archives the listing.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_SUPPLIERS);
  if ("error" in guard) return guard.error;
  const sp = await prisma.supplierProduct.findUnique({ where: { id: params.id } });
  if (!sp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ((await prisma.supplierOrder.count({ where: { supplierProductId: sp.id } })) > 0) {
    return NextResponse.json({ error: "Has order history — hide it instead." }, { status: 409 });
  }
  if (sp.productId) await unpublishSupplierProduct(sp.id);
  await prisma.supplierProduct.delete({ where: { id: sp.id } });
  return NextResponse.json({ ok: true });
}
