import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { Price } from "@/components/Price";
import { timeAgo, parseJsonArray } from "@/lib/utils";
import { ProductModerationButtons } from "./ProductModerationButtons";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  await requireAdmin(ADMIN_PERMISSIONS.MANAGE_PRODUCTS);
  const q = (searchParams.q ?? "").trim();
  const status = searchParams.status?.toUpperCase();
  const products = await prisma.product.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q } }, { description: { contains: q } }] } : {}),
      ...(status ? { status } : {}),
    },
    include: { seller: { select: { id: true, name: true, sellerVerified: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Products</h1>
          <p className="text-sm text-ink-600">{products.length} matched</p>
        </div>
        <form action="/admin/products" method="get" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search…"
            className="input text-sm"
          />
          <select name="status" defaultValue={status ?? ""} className="input text-sm">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="SOLD_OUT">Sold out</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <button type="submit" className="btn-secondary text-sm">Filter</button>
        </form>
      </div>

      <ul className="card divide-y divide-ink-100">
        {products.map((p) => {
          const img = parseJsonArray(p.imagesJson)[0];
          return (
            <li key={p.id} className="flex items-center gap-3 p-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-ink-50">
                {img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={p.name} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/products/${p.id}`} className="line-clamp-1 font-medium hover:underline">
                  {p.name}
                </Link>
                <p className="text-xs text-ink-500">
                  by{" "}
                  <Link href={`/u/${p.seller.id}`} className="hover:underline">
                    {p.seller.name}
                  </Link>{" · "}
                  {timeAgo(p.createdAt)}{" · "}
                  {p.salesCount} sales
                </p>
              </div>
              <span
                className={
                  p.status === "ARCHIVED"
                    ? "badge bg-amber-50 text-amber-700"
                    : p.status === "ACTIVE"
                    ? "badge bg-emerald-50 text-emerald-700"
                    : "badge bg-ink-50 text-ink-700"
                }
              >
                {p.status}
              </span>
              <p className="w-20 text-right text-sm font-semibold">
                <Price amount={p.salePrice ?? p.price} />
              </p>
              <ProductModerationButtons
                productId={p.id}
                productName={p.name}
                status={p.status}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
