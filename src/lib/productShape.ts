import { parseJsonArray } from "./utils";
import { displaySellerName } from "./businessName";
import { rankScore } from "./ranking";
import type { ProductCardData } from "@/components/storefront/ProductCard";

// Subset of a Prisma Product row the card needs. Keep it loose so we don't
// over-couple landing pages to the exact include shape — every consumer must
// already select these fields, but the helper is permissive about extras.
type ProductLike = {
  id: string;
  name: string;
  price: number;
  salePrice: number | null;
  category: string;
  imagesJson: string;
  ratingAvg?: number;
  ratingCount?: number;
  seller: {
    id?: string;
    name: string;
    businessName?: string | null;
    sellerVerified?: boolean;
  };
  promotions?: { boost?: number }[];
};

export function shapeProductForCard(p: ProductLike): ProductCardData {
  const allImages = parseJsonArray(p.imagesJson);
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    salePrice: p.salePrice,
    category: p.category,
    image: allImages[0] ?? null,
    images: allImages,
    sellerName: displaySellerName(p.seller),
    sellerVerified: !!p.seller.sellerVerified,
    promoted: (p.promotions?.length ?? 0) > 0,
    rating: p.ratingAvg,
    ratingCount: p.ratingCount,
  };
}

// Re-export ranking so landing pages share the same definition as the home
// "Featured pieces" rail without duplicating the weights.
export { rankScore };
