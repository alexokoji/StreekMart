// Size scales for sized products (clothing, shoes, bags, etc.).
//
// The seller picks ONE scale on the listing form, ticks the sizes they
// stock, and the buyer picks one at add-to-cart time. Materials and
// unsized items (a roll of fabric, a wall hanging) leave `sizesJson` empty.

export type SizeScale = "alpha" | "eu-numeric" | "uk-numeric" | "us-numeric" | "shoe-eu" | "shoe-us" | "bag-volume";

export const SIZE_SCALES: { value: SizeScale; label: string; sizes: string[] }[] = [
  {
    value: "alpha",
    label: "Alpha sizes (XS-XXL)",
    sizes: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
  },
  {
    value: "eu-numeric",
    label: "EU numeric (34-48)",
    sizes: ["34", "36", "38", "40", "42", "44", "46", "48"],
  },
  {
    value: "uk-numeric",
    label: "UK numeric (6-22)",
    sizes: ["6", "8", "10", "12", "14", "16", "18", "20", "22"],
  },
  {
    value: "us-numeric",
    label: "US numeric (0-18)",
    sizes: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18"],
  },
  {
    value: "shoe-eu",
    label: "EU shoe (35-46)",
    sizes: ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"],
  },
  {
    value: "shoe-us",
    label: "US shoe (5-13)",
    sizes: ["5", "6", "7", "8", "9", "10", "11", "12", "13"],
  },
  {
    value: "bag-volume",
    label: "Bag size (S/M/L)",
    sizes: ["Small", "Medium", "Large"],
  },
];

// Categories that benefit from a size selector. Used by the listing form to
// auto-suggest the right scale and to render the size step at all.
// Categories NOT in this list (Ankara, Linen, Buttons, Pins, etc.) leave
// sizesJson empty — buyers add to cart without picking a size.
export const SIZED_CATEGORIES: Record<string, SizeScale> = {
  Tops: "alpha",
  Bottoms: "alpha",
  Dresses: "alpha",
  Outerwear: "alpha",
  Activewear: "alpha",
  Loungewear: "alpha",
  Underwear: "alpha",
  "Native Wear": "alpha",
  Shoes: "shoe-eu",
  Bags: "bag-volume",
};

export function defaultScaleFor(category: string): SizeScale | null {
  return SIZED_CATEGORIES[category] ?? null;
}

export function isSizedCategory(category: string): boolean {
  return category in SIZED_CATEGORIES;
}

export function scaleByValue(value: SizeScale): { label: string; sizes: string[] } {
  return SIZE_SCALES.find((s) => s.value === value) ?? SIZE_SCALES[0];
}
