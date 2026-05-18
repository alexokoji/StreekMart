import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseJsonArray, timeAgo } from "@/lib/utils";
import { Price } from "@/components/Price";
import { isAiEnabled } from "@/lib/ai";
import { AddToCartButton } from "@/components/AddToCartButton";
import { OutfitPairings } from "@/components/OutfitPairings";
import { SameCitySuggestions } from "@/components/SameCitySuggestions";
import { perUnitLabel } from "@/lib/units";

export default async function PublicProductPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      seller: {
        select: {
          id: true, slug: true, name: true, bio: true, avatarUrl: true,
          isSeller: true, isDesigner: true,
          sellerVerified: true, designerVerified: true,
          exposureScore: true,
          country: true, city: true,
        },
      },
    },
  });
  if (!product) notFound();

  prisma.product.update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  const images = parseJsonArray(product.imagesJson);
  const effective = product.salePrice ?? product.price;
  const onSale = product.salePrice !== null && product.salePrice < product.price;
  const discount = onSale ? Math.round(((product.price - effective) / product.price) * 100) : 0;
  const isOwnListing = !!user && user.id === product.seller.id;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card overflow-hidden">
        <div className="relative aspect-square bg-gray-100">
          {images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images[0]} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400">No image</div>
          )}
          {onSale && (
            <span className="absolute left-3 top-3 rounded-md bg-red-600 px-2 py-1 text-xs font-bold text-white">
              −{discount}%
            </span>
          )}
        </div>
        {images.slice(1).length > 0 && (
          <div className="grid grid-cols-4 gap-2 p-2">
            {images.slice(1).map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" className="aspect-square w-full rounded object-cover" />
            ))}
          </div>
        )}
      </div>

      <div className="card p-6">
        <p className="text-xs uppercase tracking-wider text-gray-500">{product.category}</p>
        <h1 className="mt-1 text-3xl font-bold">{product.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sold by{" "}
          <Link href={`/u/${product.seller.slug ?? product.seller.id}`} className="font-medium text-brand-700 hover:underline">
            {product.seller.name}
          </Link>
          {product.seller.sellerVerified && (
            <span title="Verified by StreekMart" className="ml-1 inline-flex h-4 w-4 -translate-y-0.5 items-center justify-center rounded-full bg-emerald-accent text-[9px] font-bold text-white">✓</span>
          )}
          {" · "}{timeAgo(product.createdAt)}
        </p>

        <div className="mt-4 flex items-end gap-3">
          <p className="text-3xl font-bold"><Price amount={effective} /></p>
          {onSale && (
            <p className="text-lg text-gray-400 line-through"><Price amount={product.price} /></p>
          )}
          {product.unit !== "piece" && (
            <p className="pb-1 text-sm font-medium text-ink-500">{perUnitLabel(product.unit)}</p>
          )}
        </div>

        <p className="mt-4 whitespace-pre-wrap text-gray-700">{product.description}</p>

        {product.stock === 0 && (
          <p className="mt-4 text-sm font-medium text-red-600">Out of stock</p>
        )}

        <div className="mt-6 flex flex-col gap-2">
          {product.stock > 0 && (
            <AddToCartButton
              productId={product.id}
              unit={product.unit}
              stock={product.stock}
              sizes={parseJsonArray(product.sizesJson)}
              disabled={isOwnListing}
            />
          )}
          {user && !isOwnListing && (
            <Link href={`/messages?with=${product.seller.id}`} className="btn-secondary self-start">
              Message seller
            </Link>
          )}
        </div>

        {isAiEnabled() && (
          <div className="mt-6">
            <OutfitPairings productId={product.id} />
          </div>
        )}
      </div>

      {/* Same-city alternatives — only renders when the viewer is in a
          different city / country from the seller. Helps buyers find a
          local match instead of getting blocked at checkout. */}
      <div className="lg:col-span-2">
        <SameCitySuggestions
          buyer={user ? { country: user.country, city: user.city } : null}
          product={product}
        />
      </div>
    </div>
  );
}
