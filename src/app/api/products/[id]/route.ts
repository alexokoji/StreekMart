import { NextResponse } from "next/server";
import { z } from "zod";
import { CATEGORIES, Permission, ProductStatus, kindForCategory } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { hasManagerPermission } from "@/lib/managersServer";
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

  // NGN is the canonical storage + display currency. Send the stored value
  // verbatim — the client renders it via <Price>.
  return NextResponse.json({
    product: {
      ...product,
      displayPrice: product.price,
      displaySalePrice: product.salePrice,
      currency: "NGN",
      exchangeRate: 1,
    },
  });
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
  // Stocked sizes — empty array clears the list. Omit the field to leave
  // it untouched.
  sizes: z.array(z.string().min(1).max(20)).max(40).optional(),
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

  // Sale price sanity (against the next effective price). The seller may
  // have only changed one of the two fields, in which case nextPrice is the
  // existing stored value — and that's the common cause of confusing
  // rejections after currency migrations (the regular price still shows the
  // legacy figure). Surface both numbers in the message so the seller can
  // see what tripped the check.
  const nextPrice = parsed.data.price ?? product.price;
  if (
    parsed.data.salePrice !== undefined &&
    parsed.data.salePrice !== null &&
    parsed.data.salePrice >= nextPrice
  ) {
    const formatN = (n: number) => `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return NextResponse.json(
      {
        error:
          `Sale price ${formatN(parsed.data.salePrice)} must be less than the regular price ${formatN(nextPrice)}. ` +
          `Tip: update the regular price first if it still shows an old value.`,
      },
      { status: 400 },
    );
  }

  const { images, sizes, currency, price, salePrice, ...rest } = parsed.data;
  // `currency` is accepted but ignored — NGN is the canonical storage
  // currency. Multi-currency entry is a future feature.
  void currency;

  const updated = await prisma.product.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(typeof price === "number" ? { price } : {}),
      // `salePrice` distinguishes "not in payload" (undefined) from
      // "explicitly cleared" (null) — only write the field when the caller
      // actually sent it.
      ...(salePrice !== undefined ? { salePrice: salePrice ?? null } : {}),
      ...(rest.category ? { kind: kindForCategory(rest.category) } : {}),
      ...(images ? { imagesJson: JSON.stringify(images) } : {}),
      ...(sizes !== undefined ? { sizesJson: JSON.stringify(sizes) } : {}),
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
