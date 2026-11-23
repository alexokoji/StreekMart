import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { publishSupplierProduct, unpublishSupplierProduct } from "@/lib/suppliers/service";

const Body = z.object({
  ids: z.array(z.string()).min(1).max(200),
  action: z.enum(["publish", "unpublish", "delete", "setCategory", "setMarkup"]),
  category: z.string().trim().max(80).optional(),
  // setMarkup: null type clears the override back to the supplier default.
  markupType: z.enum(["PERCENT", "FIXED"]).nullable().optional(),
  markupValue: z.number().min(0).max(1_000_000).nullable().optional(),
});

// POST /api/admin/supplier-products/bulk — act on many products at once.
// Reports per-item failures instead of aborting the whole batch.
export async function POST(req: Request) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_SUPPLIERS);
  if ("error" in guard) return guard.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { ids, action } = parsed.data;
  if (action === "setCategory" && !parsed.data.category) {
    return NextResponse.json({ error: "Choose a category" }, { status: 400 });
  }
  if (action === "setMarkup" && parsed.data.markupType && parsed.data.markupValue == null) {
    return NextResponse.json({ error: "Enter a markup value" }, { status: 400 });
  }

  const rows = await prisma.supplierProduct.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  let ok = 0;
  const failed: { name: string; error: string }[] = [];
  for (const r of rows) {
    try {
      if (action === "publish") await publishSupplierProduct(r.id);
      else if (action === "unpublish") await unpublishSupplierProduct(r.id);
      else if (action === "setCategory") {
        await prisma.supplierProduct.update({ where: { id: r.id }, data: { category: parsed.data.category! } });
      } else if (action === "setMarkup") {
        await prisma.supplierProduct.update({
          where: { id: r.id },
          data: {
            markupType: parsed.data.markupType ?? null,
            markupValue: parsed.data.markupType ? parsed.data.markupValue ?? null : null,
          },
        });
        // Re-price if it's live.
        const { refreshListing } = await import("@/lib/suppliers/service");
        await refreshListing(r.id);
      } else {
        if ((await prisma.supplierOrder.count({ where: { supplierProductId: r.id } })) > 0) {
          throw new Error("has order history — hide it instead");
        }
        await unpublishSupplierProduct(r.id);
        await prisma.supplierProduct.delete({ where: { id: r.id } });
      }
      ok++;
    } catch (e) {
      failed.push({ name: r.name, error: e instanceof Error ? e.message : "Failed" });
    }
  }
  return NextResponse.json({ ok: true, done: ok, failed });
}
