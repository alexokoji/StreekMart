import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { placeSupplierOrder } from "@/lib/suppliers/service";

const Body = z.object({
  status: z.enum(["TO_PLACE", "PLACED", "SHIPPED", "DELIVERED", "FAILED", "CANCELLED"]).optional(),
  externalOrderId: z.string().trim().max(120).nullable().optional(),
  trackingCode: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  // Re-attempt automatic placement via the supplier's API.
  retry: z.boolean().optional(),
});

// PATCH /api/admin/supplier-orders/[id] — record what happened with the
// supplier (manual suppliers) or retry an automatic placement.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_SUPPLIERS);
  if ("error" in guard) return guard.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { retry, ...data } = parsed.data;
  const so = await prisma.supplierOrder.findUnique({ where: { id: params.id } });
  if (!so) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (Object.keys(data).length) {
    await prisma.supplierOrder.update({
      where: { id: so.id },
      data: { ...data, ...(data.status && data.status !== "FAILED" ? { error: null } : {}) },
    });
  }
  if (retry) {
    const r = await placeSupplierOrder(so.id);
    return NextResponse.json({ ok: true, status: r.status, error: r.error ?? null });
  }
  return NextResponse.json({ ok: true });
}
