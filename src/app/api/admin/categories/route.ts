import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { invalidateCategoryCache } from "@/lib/categories";
import { invalidateAiPromptCaches } from "@/lib/ai";

const CreateBody = z.object({
  name: z.string().trim().min(2).max(40),
  groupName: z.string().trim().min(2).max(40),
  kind: z.enum(["MATERIAL", "PRODUCT"]).default("PRODUCT"),
  displayOrder: z.number().int().min(0).max(10_000).optional(),
});

// GET /api/admin/categories — list all (incl. disabled) for the admin UI.
export async function GET() {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_SETTINGS);
  if ("error" in guard) return guard.error;
  const rows = await prisma.category.findMany({
    orderBy: [{ groupName: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ categories: rows });
}

// POST /api/admin/categories — add a new category.
export async function POST(req: Request) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_SETTINGS);
  if ("error" in guard) return guard.error;

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { name, groupName, kind, displayOrder } = parsed.data;

  const exists = await prisma.category.findUnique({ where: { name } });
  if (exists) {
    return NextResponse.json(
      { error: "A category with that name already exists." },
      { status: 409 },
    );
  }

  // If no displayOrder supplied, append to the end of its group.
  const fallbackOrder =
    displayOrder ??
    ((await prisma.category.aggregate({
      where: { groupName },
      _max: { displayOrder: true },
    }))._max.displayOrder ?? 0) + 10;

  const row = await prisma.category.create({
    data: { name, groupName, kind, displayOrder: fallbackOrder },
  });
  invalidateCategoryCache();
  invalidateAiPromptCaches();
  return NextResponse.json({ category: row });
}
