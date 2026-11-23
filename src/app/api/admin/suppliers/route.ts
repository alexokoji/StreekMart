import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { SupplierBody, slugifyName } from "@/lib/suppliers/schemas";

// POST /api/admin/suppliers — create a supplier.
export async function POST(req: Request) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_SUPPLIERS);
  if ("error" in guard) return guard.error;
  const parsed = SupplierBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;
  if (d.integration === "API" && !d.apiBaseUrl) {
    return NextResponse.json({ error: "API suppliers need an API base URL" }, { status: 400 });
  }
  let slug = slugifyName(d.name);
  if (await prisma.supplier.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
  const s = await prisma.supplier.create({
    data: {
      name: d.name,
      slug,
      integration: d.integration,
      apiBaseUrl: d.integration === "API" ? d.apiBaseUrl ?? null : null,
      apiKey: d.apiKey || null,
      contactName: d.contactName ?? null,
      contactEmail: d.contactEmail ?? null,
      contactPhone: d.contactPhone ?? null,
      notes: d.notes ?? null,
      markupType: d.markupType,
      markupValue: d.markupValue,
      active: d.active ?? true,
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: s.id });
}
