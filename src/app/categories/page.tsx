import Link from "next/link";
import { readCategories } from "@/lib/categories";
import { Band, PageCanvas, PageHead } from "@/components/storefront/Band";

// /categories -- top-level grouping page. Lists each group with its
// active categories (drill-down by parent). Multi-level support uses
// Category.parentId: null parent = top-level entry; non-null = nested
// under that group. Buyers tap a group, see leaf categories underneath.
export default async function CategoriesPage() {
  const all = await readCategories();
  const enabled = all.filter((c) => c.enabled);
  // Group by either groupName (legacy flat tree) OR parentId (multi-level).
  const groups = new Map<string, typeof enabled>();
  for (const c of enabled) {
    const key = c.groupName;
    const arr = groups.get(key) ?? [];
    arr.push(c);
    groups.set(key, arr);
  }
  return (
    <PageCanvas>
      <PageHead
        eyebrow="Directory"
        title="All categories"
        subtitle="Browse the full taxonomy. Tap any category to filter the storefront."
        backHref="/"
        backLabel="Back home"
      />
      <Band tone="base">
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from(groups.entries()).map(([groupName, cats]) => (
          <section key={groupName} className="card p-5">
            <h2 className="font-display text-lg font-semibold">{groupName}</h2>
            <ul className="mt-3 grid grid-cols-2 gap-1">
              {cats.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/?category=${encodeURIComponent(c.name)}`}
                    className="chip"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      </Band>
    </PageCanvas>
  );
}