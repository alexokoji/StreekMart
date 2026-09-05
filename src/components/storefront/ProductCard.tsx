import Link from "next/link";
import { Price } from "@/components/Price";
import { WishlistToggle } from "./WishlistToggle";
import { ProductImageSlider } from "./ProductImageSlider";
import { TierBadge } from "@/components/TierBadge";

export type ProductCardData = {
  id: string;
  name: string;
  price: number;
  salePrice: number | null;
  category: string;
  // Legacy single-image field — call sites that only need the cover image
  // can keep passing this. New rails should also pass `images` so multi-image
  // products get a swipeable carousel.
  image: string | null;
  images?: string[];
  sellerName: string;
  // Tier: 1 = unverified, 2 = blue check, 3 = gold check. Replaces the
  // older boolean `sellerVerified` (still derivable as tier >= 2).
  sellerTier: number;
  promoted?: boolean;
  rating?: number;
  ratingCount?: number;
};

export function ProductCard({ p, saved }: { p: ProductCardData; saved: boolean }) {
  const effective = p.salePrice ?? p.price;
  const onSale = p.salePrice !== null && p.salePrice < p.price;
  const discount = onSale ? Math.round(((p.price - effective) / p.price) * 100) : 0;

  // Prefer the new `images` array; fall back to the legacy single `image`
  // so call sites that haven't been updated still render correctly.
  const galleryImages: string[] =
    (p.images && p.images.length > 0
      ? p.images
      : p.image
      ? [p.image]
      : []);

  return (
    <article className="product-card group relative">
      <Link href={`/products/${p.id}`} className="block">
        <div className="relative aspect-square bg-ink-50">
          {galleryImages.length > 1 ? (
            <ProductImageSlider
              images={galleryImages}
              alt={p.name}
              objectFit="cover"
              chevronVisibility="hover"
            />
          ) : galleryImages[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={galleryImages[0]}
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
        {typeof p.rating === "number" && p.rating > 0 && (
          <div className="mb-1 flex items-center gap-1 text-[11px] text-ink-500">
            <StarIcon />
            <span className="font-medium text-ink-700 dark:text-ink-200">{p.rating.toFixed(1)}</span>
            {typeof p.ratingCount === "number" && p.ratingCount > 0 && <span>({p.ratingCount})</span>}
          </div>
        )}
        <Link href={`/products/${p.id}`} className="line-clamp-1 font-medium text-ink-900 hover:underline">
          {p.name}
        </Link>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-500">
          {p.sellerName}
          <TierBadge tier={p.sellerTier} className="ml-1" />
        </p>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-base font-semibold text-ink-900"><Price amount={effective} /></span>
          {onSale && (
            <span className="text-xs text-ink-300 line-through"><Price amount={p.price} /></span>
          )}
        </div>
        <Link
          href={`/products/${p.id}`}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink-900 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500"
        >
          <CartIcon />
          Add to Cart
        </Link>
      </div>
    </article>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 fill-gold-400 text-gold-400" aria-hidden="true">
      <path d="M12 2.5l2.9 6.4 6.9.7-5.2 4.7 1.5 6.8L12 17.8 5.9 21.1l1.5-6.8-5.2-4.7 6.9-.7z" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4h2l2.4 12.3a2 2 0 002 1.7H18a2 2 0 002-1.6L21.5 8H6" />
      <circle cx="10" cy="21" r="1" />
      <circle cx="18" cy="21" r="1" />
    </svg>
  );
}
