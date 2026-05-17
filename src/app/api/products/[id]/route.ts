import { NextResponse } from "next/server";
import { z } from "zod";
import { CATEGORIES, Permission, ProductStatus, kindForCategory } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { hasManagerPermission } from "@/lib/managers";
import { convertToUsd } from "@/lib/currencyServer";
import { PRODUCT_UNITS } from "@/lib/units";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      seller: {
        select: { id: true, name: true, bio: true, avatarUrl: true, isSeller: true, isDesigner: true, sellerVerified: true, designerVerified: true },
      },
    },
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  prisma.product
    .update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  return NextResponse.json({ product });
}

const UpdateBody = z.object({
  name: z.string().min(2).optional(),
  description: z.string().min(2).optional(),
  price: z.number().positive().optional(),
  salePrice: z.number().positive().nullable().optional(),
  category: z.string().min(1).optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  stock: z.number().int().nonnegative().optional(),
  images: z.array(z.string()).optional(),
  // Pricing unit — see src/lib/units.ts. Editing this changes how cart
  // quantities are validated for *future* additions; existing cart rows
  // keep whatever quantity they were saved with.
  unit: z.enum(PRODUCT_UNITS as [typeof PRODUCT_UNITS[number], ...typeof PRODUCT_UNITS[number][]]).optional(),
  // ISO-4217 — currency the seller typed `price`/`salePrice` in. When
  // present and not USD, the values are converted to USD before storage.
  currency: z.string().length(3).optional(),
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser([Permission.SELLER, Permission.DESIGNER]);
  if ("error" in guard) return guard.error;

  const product = await prisma.product.findUnique({ where: { id: params.id } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const canEdit = await hasManagerPermission(guard.session.sub, product.sellerId, "edit_products");
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = UpdateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Category change → re-validate against allowlist + recompute kind.
  if (parsed.data.category !== undefined && !CATEGORIES.includes(parsed.data.category)) {
    return NextResponse.json(
      { error: `"${parsed.data.category}" is not an allowed fashion category.` },
      { status: 422 },
    );
  }

  // Sale price sanity (against the next effective price). Validated in the
  // *seller's typed currency* so it matches what they see in the form;
  // conversion to USD happens after this check.
  const nextPrice = parsed.data.price ?? product.price;
  if (
    parsed.data.salePrice !== undefined &&
    parsed.data.salePrice !== null &&
    parsed.data.salePrice >= nextPrice
  ) {
    return NextResponse.json(
      { error: "Sale price must be less than the regular price." },
      { status: 400 },
    );
  }

  const { images, currency, price, salePrice, ...rest } = parsed.data;

  // Convert price/salePrice from the seller's currency → USD if needed.
  let priceUsd = price;
  let salePriceForUpdate = salePrice;
  if (currency && currency.toUpperCase() !== "USD") {
    try {
      if (typeof price === "number") priceUsd = await convertToUsd(price, currency);
      if (typeof salePrice === "number") salePriceForUpdate = await convertToUsd(salePrice, currency);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Unsupported currency" },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.product.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(typeof priceUsd === "number" ? { price: priceUsd } : {}),
      // `salePrice` distinguishes "not in payload" (undefined) from
      // "explicitly cleared" (null) — only write the field when the caller
      // actually sent it.
      ...(salePrice !== undefined ? { salePrice: salePriceForUpdate ?? null } : {}),
      ...(rest.category ? { kind: kindForCategory(rest.category) } : {}),
      ...(images ? { imagesJson: JSON.stringify(images) } : {}),
    },
  });
  return NextResponse.json({ product: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser([Permission.SELLER, Permission.DESIGNER]);
  if ("error" in guard) return guard.error;

  const product = await prisma.product.findUnique({ where: { id: params.id } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const canEdit = await hasManagerPermission(guard.session.sub, product.sellerId, "edit_products");
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.product.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
