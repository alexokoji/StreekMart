import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { invalidateCategoryCache } from "@/lib/categories";
import { invalidateAiPromptCaches } from "@/lib/ai";

const PatchBody = z.object({
  name: z.string().trim().min(2).max(40).optional(),
  groupName: z.string().trim().min(2).max(40).optional(),
  kind: z.enum(["MATERIAL", "PRODUCT"]).optional(),
  enabled: z.boolean().optional(),
  displayOrder: z.number().int().min(0).max(10_000).optional(),
});

// PATCH /api/admin/categories/[id] — edit a category. Renaming cascades by
// rewriting every Product.category that pointed at the old name so the
// homepage rails + filters keep working.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_SETTINGS);
  if ("error" in guard) return guard.error;

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const existing = await prisma.category.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Renaming: enforce uniqueness on the new name, then rewrite products.
  if (parsed.data.name && parsed.data.name !== existing.name) {
    const clash = await prisma.category.findUnique({ where: { name: parsed.data.name } });
    if (clash) {
      return NextResponse.json(
        { error: "Another category already uses that name." },
        { status: 409 },
      );
    }
    await prisma.$transaction([
      prisma.category.update({
        where: { id: params.id },
        data: parsed.data,
      }),
      prisma.product.updateMany({
        where: { category: existing.name },
        data: { category: parsed.data.name },
      }),
    ]);
  } else {
    await prisma.category.update({ where: { id: params.id }, data: parsed.data });
  }
  invalidateCategoryCache();
  invalidateAiPromptCaches();
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/categories/[id] — only allowed when no products reference
// it. Otherwise admins should DISABLE (PATCH enabled:false) so historical
// listings keep their category string.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_SETTINGS);
  if ("error" in guard) return guard.error;

  const cat = await prisma.category.findUnique({ where: { id: params.id } });
  if (!cat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const usage = await prisma.product.count({ where: { category: cat.name } });
  if (usage > 0) {
    return NextResponse.json(
      {
        error: `Can't delete — ${usage} product${usage === 1 ? " uses" : "s use"} this category. Disable it instead.`,
      },
      { status: 409 },
    );
  }
  await prisma.category.delete({ where: { id: params.id } });
  invalidateCategoryCache();
  invalidateAiPromptCaches();
  return NextResponse.json({ ok: true });
}
