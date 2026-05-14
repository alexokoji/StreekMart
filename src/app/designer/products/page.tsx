import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseJsonArray, timeAgo } from "@/lib/utils";
import { Price } from "@/components/Price";
import { ProductStatusToggle } from "@/components/ProductStatusToggle";

export default async function DesignerProductsPage() {
  const user = await requireUser("DESIGNER");
  const products = await prisma.product.findMany({
    where: { sellerId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My products</h1>
          <p className="text-sm text-gray-600">List your own designs and clothes for sale.</p>
        </div>
        <Link href="/designer/products/new" className="btn-primary">+ New product</Link>
      </div>

      {products.length === 0 ? (
        <div className="card p-10 text-center text-gray-500">
          You haven&apos;t listed any products yet. <Link href="/designer/products/new" className="text-brand-700 hover:underline">List your first piece</Link>.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const images = parseJsonArray(p.imagesJson);
            return (
              <div key={p.id} className="card overflow-hidden">
                <div className="aspect-square bg-gray-100">
                  {images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={images[0]} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-gray-400">no image</div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/designer/products/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    <ProductStatusToggle productId={p.id} initialStatus={p.status} />
                  </div>
                  <p className="mt-1 text-sm text-gray-600"><Price amount={p.price} /></p>
                  <p className="mt-2 text-xs text-gray-500">{timeAgo(p.createdAt)} · {p.likeCount} likes · {p.salesCount} sales</p>
                  <div className="mt-3 flex gap-2">
                    <Link href={`/designer/products/${p.id}`} className="btn-secondary text-xs">View</Link>
                    <Link href={`/designer/products/${p.id}/edit`} className="btn-secondary text-xs">Edit</Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
