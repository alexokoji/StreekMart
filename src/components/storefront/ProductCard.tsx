import Link from "next/link";
import { Price } from "@/components/Price";
import { WishlistToggle } from "./WishlistToggle";

export type ProductCardData = {
  id: string;
  name: string;
  price: number;
  salePrice: number | null;
  category: string;
  image: string | null;
  sellerName: string;
  sellerVerified: boolean;
  promoted?: boolean;
  rating?: number;
  ratingCount?: number;
};

export function ProductCard({ p, saved }: { p: ProductCardData; saved: boolean }) {
  const effective = p.salePrice ?? p.price;
  const onSale = p.salePrice !== null && p.salePrice < p.price;
  const discount = onSale ? Math.round(((p.price - effective) / p.price) * 100) : 0;

  return (
    <article className="product-card group relative">
      <Link href={`/products/${p.id}`} className="block">
        <div className="relative aspect-square bg-ink-50">
          {p.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.image}
              alt={p.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-ink-300">
              No image
            </div>
          )}

          {onSale && (
            <span className="absolute left-2 top-2 rounded-md bg-burgundy-700 px-2 py-1 text-xs font-bold text-white">
              −{discount}%
            </span>
          )}
          {p.promoted && (
            <span className="absolute right-2 top-2 rounded-md bg-gold-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              Promoted
            </span>
          )}
        </div>
      </Link>

      {/* Wishlist toggle — overlaid in the corner */}
      <div className="absolute right-2 bottom-[5.5rem]">
        <WishlistToggle productId={p.id} initialSaved={saved} />
      </div>

      <div className="p-3">
        <p className="text-[11px] uppercase tracking-wider text-ink-400">{p.category}</p>
        <Link href={`/products/${p.id}`} className="line-clamp-1 font-medium text-ink-900 hover:underline">
          {p.name}
        </Link>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-base font-semibold text-ink-900"><Price amount={effective} /></span>
          {onSale && (
            <span className="text-xs text-ink-300 line-through"><Price amount={p.price} /></span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">
          {p.sellerName}
          {p.sellerVerified && <span className="ml-1 text-emerald-accent">✓</span>}
        </p>
      </div>
    </article>
  );
}
