import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseJsonArray, timeAgo } from "@/lib/utils";
import { Price } from "@/components/Price";

export default async function FavoritesPage() {
  const user = await requireUser("BUYER");
  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    include: {
      product: { include: { seller: { select: { id: true, name: true, businessName: true } } } },
      post: { include: { author: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (favorites.length === 0) {
    return (
      <div className="card p-10 text-center text-gray-500">
        You haven&apos;t saved anything yet. Browse the <Link href="/feed" className="text-brand-700 hover:underline">feed</Link> to start collecting.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Your favorites</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {favorites.map((f) => {
          if (f.product) {
            const images = parseJsonArray(f.product.imagesJson);
            return (
              <article key={f.id} className="card overflow-hidden">
                <Link href={`/products/${f.product.id}`} className="block">
                  <div className="aspect-square bg-gray-100">
                    {images[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={images[0]} alt={f.product.name} className="h-full w-full object-cover" />
                    )}
                  </div>
                </Link>
                <div className="p-4">
                  <Link href={`/products/${f.product.id}`} className="font-medium hover:underline">{f.product.name}</Link>
                  <p className="text-sm text-gray-600"><Price amount={f.product.price} /></p>
                  <p className="mt-1 text-xs text-gray-500">Saved {timeAgo(f.createdAt)}</p>
                </div>
              </article>
            );
          }
          if (f.post) {
            const images = parseJsonArray(f.post.imagesJson);
            return (
              <article key={f.id} className="card overflow-hidden">
                <Link href={`/posts/${f.post.id}`} className="block">
                  <div className="aspect-square bg-gray-100">
                    {images[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={images[0]} alt={f.post.title} className="h-full w-full object-cover" />
                    )}
                  </div>
                </Link>
                <div className="p-4">
                  <Link href={`/posts/${f.post.id}`} className="font-medium hover:underline">{f.post.title}</Link>
                  <p className="line-clamp-2 text-sm text-gray-600">{f.post.body}</p>
                  <p className="mt-1 text-xs text-gray-500">Saved {timeAgo(f.createdAt)}</p>
                </div>
              </article>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
