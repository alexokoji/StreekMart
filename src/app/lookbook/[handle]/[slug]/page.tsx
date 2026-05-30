import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { displaySellerName } from "@/lib/businessName";
import { parseJsonArray } from "@/lib/utils";
import { buildWatermarkedUrl } from "@/lib/cloudinaryUrl";
import { Price } from "@/components/Price";
import { TierBadge } from "@/components/TierBadge";
import { CollectionStatus } from "@/lib/collections";

// Public look-book page: /lookbook/[handle]/[slug]
//
// `handle` is the designer's slug (or id), `slug` is the collection slug
// unique within that designer's namespace. Renders the curated post +
// product items in their authored order. DRAFT collections 404 unless
// requested by the owner — for V1 we just hide them and let the owner
// preview from their studio.

export const dynamic = "force-dynamic";

export default async function PublicLookbookPage({
  params,
}: {
  params: { handle: string; slug: string };
}) {
  // Designer lookup: try slug first, fall back to id (lets the route work
  // for legacy users without a slug set).
  const owner = await prisma.user.findFirst({
    where: {
      OR: [{ slug: params.handle }, { id: params.handle }],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      businessName: true,
      bio: true,
      avatarUrl: true,
      designerTier: true,
      designerVerified: true,
      isDesigner: true,
    },
  });
  if (!owner) notFound();

  const collection = await prisma.collection.findFirst({
    where: { ownerId: owner.id, slug: params.slug, status: CollectionStatus.PUBLIC },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: {
          post: { select: { id: true, title: true, imagesJson: true } },
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              salePrice: true,
              imagesJson: true,
            },
          },
        },
      },
    },
  });
  if (!collection) notFound();

  const handle = owner.slug ?? owner.id;
  const fallbackCover =
    collection.coverUrl ??
    collection.items.find((it) => it.post)?.post?.imagesJson?.replace(/\[|\]|"/g, "") ??
    collection.items.find((it) => it.product)?.product?.imagesJson?.replace(/\[|\]|"/g, "") ??
    null;
  // Strip-the-JSON above is approximate — we need the first parsed entry.
  const coverFromItems =
    parseJsonArray(collection.items.find((it) => it.post)?.post?.imagesJson ?? "[]")[0] ??
    parseJsonArray(
      collection.items.find((it) => it.product)?.product?.imagesJson ?? "[]",
    )[0] ??
    null;
  const cover = collection.coverUrl ?? coverFromItems ?? fallbackCover ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-6">
      {/* Hero */}
      <header className="card overflow-hidden">
        <div className="relative aspect-[2.5/1] w-full bg-gradient-to-br from-violet-100 via-white to-fuchsia-100">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={buildWatermarkedUrl(cover)}
              alt={collection.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white">
            <p className="text-xs uppercase tracking-[0.18em] opacity-80">Look-book</p>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">{collection.title}</h1>
            <p className="mt-1 text-sm opacity-90">
              by{" "}
              <Link
                href={`/u/${handle}`}
                className="font-semibold underline-offset-2 hover:underline"
              >
                {displaySellerName(owner)}
              </Link>
              <TierBadge
                tier={owner.designerTier ?? (owner.designerVerified ? 2 : 1)}
                className="ml-1 -translate-y-0.5"
              />
            </p>
          </div>
        </div>
        {collection.description && (
          <p className="border-t border-ink-100 p-6 text-sm text-ink-700">
            {collection.description}
          </p>
        )}
      </header>

      {collection.items.length === 0 ? (
        <p className="card p-10 text-center text-sm text-ink-500">
          This look-book doesn&rsquo;t have any items yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collection.items.map((item) => {
            if (item.post) {
              const img = parseJsonArray(item.post.imagesJson)[0] ?? null;
              return (
                <Link
                  key={item.id}
                  href={`/posts/${item.post.id}`}
                  className="group relative block aspect-square overflow-hidden rounded-xl bg-ink-100"
                >
                  {img && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={buildWatermarkedUrl(img)}
                      alt={item.post.title}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent p-3">
                    <p className="line-clamp-2 text-sm font-semibold text-white">
                      {item.post.title}
                    </p>
                  </div>
                </Link>
              );
            }
            if (item.product) {
              const img = parseJsonArray(item.product.imagesJson)[0] ?? null;
              return (
                <Link
                  key={item.id}
                  href={`/products/${item.product.id}`}
                  className="group block overflow-hidden rounded-xl border border-ink-100 bg-white"
                >
                  <div className="aspect-square overflow-hidden bg-ink-100">
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={item.product.name}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-1 text-sm font-medium">{item.product.name}</p>
                    <p className="mt-1 text-sm font-semibold">
                      <Price amount={item.product.salePrice ?? item.product.price} />
                    </p>
                  </div>
                </Link>
              );
            }
            return null;
          })}
        </div>
      )}

      <div className="text-center text-xs text-ink-500">
        <Link href={`/u/${handle}`} className="hover:underline">
          ← More from {displaySellerName(owner)}
        </Link>
      </div>
    </div>
  );
}
