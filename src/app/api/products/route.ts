import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CATEGORIES, Permission, ProductStatus, kindForCategory } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { resolveActingOwner } from "@/lib/managersServer";
import { convertToUsd } from "@/lib/currencyServer";
import { PRODUCT_UNITS } from "@/lib/units";
import { FASHION_VALIDATOR_SYSTEM, MODEL, getClient, isAiEnabled } from "@/lib/ai";

// GET /api/products?mine=1&category=&q=&kind=MATERIAL|PRODUCT
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mine = url.searchParams.get("mine");
  const category = url.searchParams.get("category") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;
  const kind = url.searchParams.get("kind") ?? undefined;

  if (mine) {
    const guard = await requireApiUser([Permission.SELLER, Permission.DESIGNER]);
    if ("error" in guard) return guard.error;
    const products = await prisma.product.findMany({
      where: { sellerId: guard.session.sub },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ products });
  }

  const products = await prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      ...(category ? { category } : {}),
      ...(kind ? { kind } : {}),
      ...(q
        ? { OR: [{ name: { contains: q } }, { description: { contains: q } }] }
        : {}),
    },
    include: { seller: { select: { id: true, name: true, exposureScore: true, sellerVerified: true, designerVerified: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ products });
}

const CreateBody = z.object({
  name: z.string().min(2),
  description: z.string().min(2),
  price: z.number().positive(),
  salePrice: z.number().positive().nullable().optional(),
  category: z.string().min(1),
  status: z.nativeEnum(ProductStatus).optional(),
  stock: z.number().int().nonnegative().optional(),
  images: z.array(z.string()).default([]),
  // The unit `price` is quoted in. Seller picks "yard" / "meter" for fabric;
  // "piece" for ready-to-wear (default).
  unit: z.enum(PRODUCT_UNITS as [typeof PRODUCT_UNITS[number], ...typeof PRODUCT_UNITS[number][]]).optional(),
  // ISO-4217 code for the currency the seller typed `price`/`salePrice` in.
  // Server converts to USD before storing so all downstream display/maths
  // stays in one canonical unit. Defaults to USD when absent (back-compat).
  currency: z.string().length(3).optional(),
  // When set, the actor must be a manager of this owner with edit_products.
  // Lets a shop manager create listings on the owner's behalf without
  // co-mingling identities (the product still belongs to the owner).
  actAsOwnerId: z.string().optional(),
});

// POST /api/products — sellers and designers can list products.
// Always runs the fashion-only validator BEFORE persisting (category allowlist
// + optional Claude semantic check). Non-fashion listings are rejected with 422.
export async function POST(req: Request) {
  const guard = await requireApiUser([Permission.SELLER, Permission.DESIGNER]);
  if ("error" in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { name, description, price, salePrice, category, status, stock, images, unit, currency, actAsOwnerId } = parsed.data;

  // Owner = the actor unless they're a manager acting on someone else's behalf.
  const ownerId = await resolveActingOwner(guard.session.sub, actAsOwnerId, "edit_products");
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verification gate — only verified sellers OR verified designers can list
  // products. The check runs against the OWNER (so a manager listing on
  // behalf of a verified seller works fine), not the actor.
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { isSeller: true, isDesigner: true, sellerVerified: true, designerVerified: true },
  });
  if (!owner) {
    return NextResponse.json({ error: "Owner not found" }, { status: 404 });
  }
  const allowedToSell =
    (owner.isSeller && owner.sellerVerified) ||
    (owner.isDesigner && owner.designerVerified);
  if (!allowedToSell) {
    return NextResponse.json(
      {
        error:
          "Your account isn't verified yet. Submit a verification request from your dashboard — once approved, you'll be able to list products.",
        needsVerification: true,
      },
      { status: 403 },
    );
  }

  // Sale price sanity check — done BEFORE conversion so the seller's typed
  // numbers are validated as a pair in their own currency. Conversion is
  // monotonic so the relationship survives.
  if (typeof salePrice === "number" && salePrice >= price) {
    return NextResponse.json(
      { error: "Sale price must be less than the regular price." },
      { status: 400 },
    );
  }

  // Convert the seller's local-currency price into USD for storage. Any
  // unsupported currency is reported as a 400 so the form can re-prompt.
  let priceUsd = price;
  let salePriceUsd: number | null = salePrice ?? null;
  if (currency && currency.toUpperCase() !== "USD") {
    try {
      priceUsd = await convertToUsd(price, currency);
      if (typeof salePrice === "number") {
        salePriceUsd = await convertToUsd(salePrice, currency);
      }
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Unsupported currency" },
        { status: 400 },
      );
    }
  }

  // 1. Hard category check (fashion-only allowlist).
  if (!CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: `"${category}" is not an allowed fashion category.`, validation: { allowed: false, reason: `"${category}" is not an allowed fashion category.` } },
      { status: 422 },
    );
  }

  // 2. Semantic AI check (skipped if API key absent).
  const verdict = await validateListing(name, description, category);
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: verdict.reason, validation: verdict },
      { status: 422 },
    );
  }

  const product = await prisma.product.create({
    data: {
      sellerId: ownerId,
      name,
      description,
      price: priceUsd,
      salePrice: salePriceUsd,
      category,
      kind: kindForCategory(category),
      status: status ?? ProductStatus.ACTIVE,
      stock: stock ?? 99,
      unit: unit ?? "piece",
      imagesJson: JSON.stringify(images),
    },
  });
  return NextResponse.json({ product });
}

// Server-side wrapper around the same logic exposed by /api/ai/validate-listing.
// Kept private here so the create/update path is self-contained.
async function validateListing(
  name: string,
  description: string,
  category: string,
): Promise<{ allowed: boolean; reason: string; suggested_category: string | null }> {
  if (!isAiEnabled()) {
    return { allowed: true, reason: "Approved by category check (AI disabled).", suggested_category: category };
  }

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: [
        { type: "text", text: FASHION_VALIDATOR_SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              allowed: { type: "boolean" },
              reason: { type: "string" },
              suggested_category: { type: ["string", "null"] },
            },
            required: ["allowed", "reason", "suggested_category"],
          },
        },
      },
      messages: [
        { role: "user", content: `Name: ${name}\nCategory: ${category}\nDescription: ${description}` },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const parsed = JSON.parse(text);
    return {
      allowed: !!parsed.allowed,
      reason: typeof parsed.reason === "string" ? parsed.reason : "OK",
      suggested_category: typeof parsed.suggested_category === "string" ? parsed.suggested_category : null,
    };
  } catch {
    // If Claude errors out, fall back to the category check rather than blocking the seller.
    return { allowed: true, reason: "Validator unavailable; allowed by category check.", suggested_category: category };
  }
}
