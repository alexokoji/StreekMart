import { prisma } from "@/lib/db";
import { ProductStatus } from "@/lib/enums";
import { readCategoryGroups } from "@/lib/categories";
import { Band, PageCanvas, PageHead } from "./Band";
import { CategoryRail } from "./CategoryRail";
import { LocationFilter } from "./LocationFilter";

// Shared layout for the five product landing pages.
//
// Renders the page header (title, subtitle, "← Back home"), the
// CategoryRail in the desktop sidebar, and a LocationFilter strip across
// the top. `children` is the rail's product grid (an InfiniteProductGrid).
//
// Counts in the CategoryRail are scoped to the current location filter so
// a user in NG only sees how many of each category are available locally —
// matches the home page convention.
export async function FilterableRailLayout({
  title,
  subtitle,
  basePath,
  activeCategory,
  locationFilter,
  children,
}: {
  title: string;
  subtitle: string;
  basePath: string;
  activeCategory: string | null;
  locationFilter: { country?: string; city?: string };
  children: React.ReactNode;
}) {
  // Per-category counts scoped to the current location filter. Mirrors the
  // home page's `groupBy` so the sidebar's number badges stay honest.
  const sellerWhere: Record<string, unknown> = {};
  if (locationFilter.country) sellerWhere.country = locationFilter.country;
  if (locationFilter.city) sellerWhere.city = { equals: locationFilter.city };
  const [grouped, categoryGroups] = await Promise.all([
    prisma.product.groupBy({
      by: ["category"],
      where: {
        status: ProductStatus.ACTIVE,
        ...(Object.keys(sellerWhere).length > 0 ? { seller: sellerWhere } : {}),
      },
      _count: { _all: true },
    }),
    readCategoryGroups(),
  ]);
  const categoryCounts = new Map(grouped.map((g) => [g.category, g._count._all]));

  return (
    <PageCanvas>
      <PageHead
        eyebrow="Browse"
        title={title}
        subtitle={subtitle}
        backHref="/"
        backLabel="Back home"
      />

      <Band tone="base">
        <div className="mb-6 hidden lg:block">
          <LocationFilter />
        </div>

        <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
          <CategoryRail
            counts={categoryCounts}
            groups={categoryGroups}
            basePath={basePath}
            activeCategory={activeCategory}
          />
          <div className="min-w-0">{children}</div>
        </div>
      </Band>
    </PageCanvas>
  );
}
