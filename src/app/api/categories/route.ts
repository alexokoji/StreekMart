import { NextResponse } from "next/server";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { readCategories, readCategoryGroups } from "@/lib/categories";

// GET /api/categories — read-only public list used by buyer dropdowns,
// the product create form, and the mobile app. Cached in-process via
// readCategories(); the admin-write endpoints invalidate the cache.
//
// ?counts=1 also returns a `productCount` per category (count of ACTIVE
// products on the catalog) so callers like the mobile home rail can
// sort by popularity instead of admin displayOrder.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const grouped = url.searchParams.get("grouped") === "1";
  if (grouped) {
    return NextResponse.json({ groups: await readCategoryGroups() });
  }
  const wantCounts = url.searchParams.get("counts") === "1";
  const all = await readCategories();
  const enabled = all.filter((c) => c.enabled);

  let countByCategory: Map<string, number> | null = null;
  if (wantCounts) {
    const rows = await prisma.product.groupBy({
      by: ["category"],
      where: { status: ProductStatus.ACTIVE },
      _count: { _all: true },
    });
    countByCategory = new Map(rows.map((r) => [r.category, r._count._all]));
  }

  return NextResponse.json({
    categories: enabled.map(({ name, groupName, kind, displayOrder }) => ({
      name,
      groupName,
      kind,
      displayOrder,
      ...(countByCategory ? { productCount: countByCategory.get(name) ?? 0 } : {}),
    })),
  });
}
