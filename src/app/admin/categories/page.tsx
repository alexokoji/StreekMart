import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { CategoriesEditor } from "./CategoriesEditor";

// /admin/categories — admin CRUD for the live product category list.
// Adds / renames / disables / deletes propagate through readCategories()
// which is cached for 60s and invalidated on every write.
export default async function AdminCategoriesPage() {
  await requireAdmin(ADMIN_PERMISSIONS.MANAGE_SETTINGS);
  const categories = await prisma.category.findMany({
    orderBy: [{ groupName: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
  });

  // Show how many products use each category so admins know which ones
  // are load-bearing before they rename/disable.
  const counts = await prisma.product.groupBy({
    by: ["category"],
    _count: { _all: true },
  });
  const usageByName = new Map(counts.map((c) => [c.category, c._count._all]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Categories</h1>
        <p className="text-sm text-ink-600">
          Add, rename, or retire categories. Renames cascade to every product that used the old name.
          Categories with active listings can&rsquo;t be deleted &mdash; disable them instead so the historical
          values still resolve.
        </p>
      </div>

      <CategoriesEditor
        initial={categories.map((c) => ({
          id: c.id,
          name: c.name,
          groupName: c.groupName,
          kind: c.kind === "MATERIAL" ? "MATERIAL" : "PRODUCT",
          displayOrder: c.displayOrder,
          enabled: c.enabled,
          usage: usageByName.get(c.name) ?? 0,
        }))}
      />
    </div>
  );
}
