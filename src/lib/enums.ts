// SQLite has no native enum support, so the schema stores these as String columns.
// We mirror the API of generated Prisma enums here so the rest of the codebase
// can `import { ProductStatus, OrderStatus, Permission, CATEGORIES }`.

// User permissions — every account is implicitly a BUYER; additional permissions
// gate seller and designer capabilities (see User.isSeller / User.isDesigner).
export const Permission = {
  BUYER: "BUYER",
  SELLER: "SELLER",
  DESIGNER: "DESIGNER",
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

export const ProductStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  SOLD_OUT: "SOLD_OUT",
  ARCHIVED: "ARCHIVED",
} as const;
export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus];

export const OrderStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  SHIPPED: "SHIPPED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

// Paid product-promotion lifecycle. See prisma/schema.prisma's Promotion
// model for the state-machine description.
export const PromotionStatus = {
  PENDING_PAYMENT: "PENDING_PAYMENT",
  PENDING_REVIEW: "PENDING_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;
export type PromotionStatus = (typeof PromotionStatus)[keyof typeof PromotionStatus];

// Paid promotion price + duration. Stored as Monnify-compatible kobo
// (50000 = ₦500). The duration is hardcoded at 3 days from the moment an
// admin approves the request.
export const PROMOTION_FEE_KOBO = 50_000;
export const PROMOTION_FEE_NGN = 500;
export const PROMOTION_DURATION_DAYS = 3;
// Approved paid promotions also rank above unpaid ones in the featured
// grid — set higher than the legacy free-promo default of 1.5.
export const PROMOTION_PAID_BOOST = 2.5;

// Product kind — separates raw materials from finished products on the storefront.
export const ProductKind = {
  MATERIAL: "MATERIAL",
  PRODUCT: "PRODUCT",
} as const;
export type ProductKind = (typeof ProductKind)[keyof typeof ProductKind];

// Sketch garment hints, for the (eventually) 3D mockup pipeline.
export const Garments = [
  "shirt",
  "gown",
  "hoodie",
  "trousers",
  "skirt",
  "agbada",
  "dress",
  "native",
  "other",
] as const;
export type Garment = (typeof Garments)[number];

// Fashion-only allowlist. Anything not in here is rejected at listing time.
// Grouped for storefront rails — order here drives the homepage category grid.
export const CATEGORY_GROUPS = {
  Materials: [
    "Ankara",
    "Lace",
    "Linen",
    "Cotton",
    "Silk",
    "Denim",
    "Chiffon",
    "Velvet",
    "Satin",
    "Sewing Supplies",
    "Tailoring Tools",
  ],
  Clothing: [
    "Tops",
    "Bottoms",
    "Dresses",
    "Outerwear",
    "Native Wear",
    "Activewear",
    "Loungewear",
  ],
  Accessories: [
    "Shoes",
    "Bags",
    "Jewelry",
    "Watches",
    "Sunglasses",
    "Hats",
    "Belts",
    "Scarves",
  ],
  Beauty: ["Beauty"],
} as const;

// Flat list used for validators + dropdowns.
// Typed as a non-empty tuple so it can be passed directly to z.enum().
export const CATEGORIES = Object.values(CATEGORY_GROUPS).flat() as unknown as [string, ...string[]];

// Helper: which kind does a category belong to (drives Product.kind on create).
export function kindForCategory(category: string): ProductKind {
  return (CATEGORY_GROUPS.Materials as readonly string[]).includes(category)
    ? ProductKind.MATERIAL
    : ProductKind.PRODUCT;
}
