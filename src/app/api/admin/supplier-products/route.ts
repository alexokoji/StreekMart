import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { upsertCatalog } from "@/lib/suppliers/service";

const Item = z.object({
  externalId: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  images: z.array(z.string().trim().url()).max(10).optional(),
  category: z.string().trim().max(80).optional(),
  costPrice: z.number().positive().max(1e9),
  stock: z.number().int().min(0).max(1_000_000).optional(),
});
const Body = z.object({
  supplierId: z.string().min(1),
  items: z.array(Item).min(1).max(500),
});

// POST /api/admin/supplier-products — add one or many items by hand / CSV.
// Items without an externalId get a stable one derived from the name so
// re-importing the same sheet updates rather than duplicates.
export async function POST(req: Request) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_SUPPLIERS);
  if ("error" in guard) return guard.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const supplier = await prisma.supplier.findUnique({ where: { id: parsed.data.supplierId } });
  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  const r = await upsertCatalog(
    supplier.id,
    parsed.data.items.map((i) => ({
      ...i,
      externalId: i.externalId ?? `manual:${i.name.toLowerCase().replace(/\s+/g, " ")}`,
    })),
  );
  return NextResponse.json({ ok: true, ...r });
}
