// Server-side product rows ship images two ways depending on the route:
//   - Already-parsed `images: string[]` from list endpoints
//   - Raw `imagesJson: string` (JSON-stringified array) from detail rows
//   - Pre-flattened `image: string | null` on order / cart projections
//
// These helpers normalise all three shapes so screens can render
// thumbnails without sniffing the response shape themselves.

type AnyProductLike = {
  image?: string | null;
  images?: string[] | null;
  imagesJson?: string | null;
};

export function imagesFor(p: AnyProductLike | null | undefined): string[] {
  if (!p) return [];
  if (p.images && p.images.length > 0) return p.images.filter((s): s is string => typeof s === "string");
  if (p.imagesJson) {
    try {
      const arr = JSON.parse(p.imagesJson);
      if (Array.isArray(arr)) return arr.filter((s): s is string => typeof s === "string");
    } catch {
      /* fall through */
    }
  }
  if (typeof p.image === "string" && p.image.length > 0) return [p.image];
  return [];
}

export function firstImage(p: AnyProductLike | null | undefined): string | null {
  return imagesFor(p)[0] ?? null;
}
