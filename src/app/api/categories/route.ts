import { NextResponse } from "next/server";
import { readCategories, readCategoryGroups } from "@/lib/categories";

// GET /api/categories — read-only public list used by buyer dropdowns,
// the product create form, and the mobile app. Cached in-process via
// readCategories(); the admin-write endpoints invalidate the cache.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const grouped = url.searchParams.get("grouped") === "1";
  if (grouped) {
    return NextResponse.json({ groups: await readCategoryGroups() });
  }
  const all = await readCategories();
  return NextResponse.json({
    categories: all
      .filter((c) => c.enabled)
      .map(({ name, groupName, kind, displayOrder }) => ({
        name,
        groupName,
        kind,
        displayOrder,
      })),
  });
}
