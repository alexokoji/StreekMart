import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { refreshSupplierListings } from "@/lib/suppliers/service";
import { SupplierBody } from "@/lib/suppliers/schemas";
import { checkSupplierUrl, validateApiConfig } from "@/lib/suppliers/apiConfig";

// PATCH /api/admin/suppliers/[id] — edit details / markup / pause.
// Changing markup re-prices every published product of this supplier.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_SUPPLIERS);
  if ("error" in guard) return guard.error;
  const parsed = SupplierBody.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const cur = await prisma.supplier.findUnique({ where: { id: params.id } });
  if (!cur) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const d = parsed.data;
  const integration = d.integration ?? cur.integration;
  const apiBaseUrl = d.apiBaseUrl !== undefined ? d.apiBaseUrl : cur.apiBaseUrl;
  if (integration === "API" && !apiBaseUrl) {
    return NextResponse.json({ error: "API suppliers need an API base URL" }, { status: 400 });
  }
  let apiConfigJson: string | undefined;
  if (integration === "API") {
    const urlErr = checkSupplierUrl(apiBaseUrl!, process.env.NODE_ENV !== "production");
    if (urlErr) return NextResponse.json({ error: urlErr }, { status: 400 });
    if (d.apiConfig !== undefined) {
      const v = validateApiConfig(d.apiConfig);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      apiConfigJson = JSON.stringify(v.config);
    }
  }
  await prisma.supplier.update({
    where: { id: cur.id },
    data: {
      ...(apiConfigJson ? { apiConfigJson } : {}),
      ...(d.name !== undefined ? { name: d.name } : {}),
      integration,
      apiBaseUrl: integration === "API" ? apiBaseUrl : null,
      ...(d.apiKey ? { apiKey: d.apiKey } : {}),
      ...(d.contactName !== undefined ? { contactName: d.contactName } : {}),
      ...(d.contactEmail !== undefined ? { contactEmail: d.contactEmail } : {}),
      ...(d.contactPhone !== undefined ? { contactPhone: d.contactPhone } : {}),
      ...(d.notes !== undefined ? { notes: d.notes } : {}),
      ...(d.markupType !== undefined ? { markupType: d.markupType } : {}),
      ...(d.markupValue !== undefined ? { markupValue: d.markupValue } : {}),
      ...(d.active !== undefined ? { active: d.active } : {}),
    },
  });
  if (d.markupType !== undefined || d.markupValue !== undefined) {
    await refreshSupplierListings(cur.id);
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/suppliers/[id]?confirm=<id> — only when it has no orders.
// Its published listings are archived first so nothing dangling stays live.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_SUPPLIERS);
  if ("error" in guard) return guard.error;
  if (new URL(req.url).searchParams.get("confirm") !== params.id) {
    return NextResponse.json({ error: "Pass ?confirm=<supplier id>" }, { status: 400 });
  }
  const orders = await prisma.supplierOrder.count({ where: { supplierId: params.id } });
  if (orders > 0) {
    return NextResponse.json(
      { error: "This supplier has order history — pause it instead of deleting." },
      { status: 409 },
    );
  }
  const linked = await prisma.supplierProduct.findMany({
    where: { supplierId: params.id, productId: { not: null } },
    select: { productId: true },
  });
  await prisma.product.updateMany({
    where: { id: { in: linked.map((l) => l.productId!) } },
    data: { status: "ARCHIVED" },
  });
  await prisma.supplier.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
