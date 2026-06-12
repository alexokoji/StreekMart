import { NextResponse } from "next/server";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import {
  namedColorsFromHex,
  parseQuery,
  rank,
  type RankableProduct,
  type ViewerSignal,
} from "@/lib/searchBot";
import { parseJsonArray } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import { getCloudinary, isCloudinaryEnabled } from "@/lib/cloudinary";

export const runtime = "nodejs";

// POST /api/search/image-upload  (multipart/form-data, field "file")
//
// Server-side image search for clients that can't extract dominant
// colors locally (mobile). Pipeline:
//   1. Accept the uploaded image bytes.
//   2. Push to Cloudinary with colors: true so the upload response
//      includes a [[hex, percent], ...] palette.
//   3. Feed the top 5 hex codes into the existing /api/search/image
//      bot pipeline (parseQuery + rank with imageMode=true).
//   4. Return the same shape /api/search returns so the mobile client
//      can render with no extra plumbing.
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  if (!isCloudinaryEnabled()) {
    return NextResponse.json(
      { error: "Image search is not configured on this deployment." },
      { status: 503 },
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing image field 'file'" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max 4 MB)." }, { status: 413 });
  }
  const hint = typeof form.get("hint") === "string" ? (form.get("hint") as string) : "";

  const buffer = Buffer.from(await file.arrayBuffer());

  // Upload with colors:true. Cloudinary returns the dominant palette
  // alongside the asset URL; the asset itself we discard since the
  // search pipeline is colour-only.
  const cloudinary = getCloudinary();
  type ColorUploadResult = { secure_url?: string; colors?: Array<[string, number]> };
  const result: ColorUploadResult = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "search-uploads", colors: true, resource_type: "image" },
      (err, res) => {
        if (err || !res) return reject(err ?? new Error("Cloudinary upload failed"));
        resolve(res as unknown as ColorUploadResult);
      },
    );
    stream.end(buffer);
  });

  const palette: Array<[string, number]> = result.colors ?? [];
  const hexColors = palette.slice(0, 6).map(([hex]) => hex.toLowerCase());
  if (hexColors.length === 0) {
    return NextResponse.json({ results: [], parsed: null, error: "Couldn't extract colors from the image." });
  }

  // The rest of the pipeline mirrors /api/search/image.
  const colors = namedColorsFromHex(hexColors);
  const parsed = parseQuery(hint, colors);

  const candidates = await prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      ...(parsed.categories.length > 0 ? { category: { in: parsed.categories } } : {}),
    },
    include: {
      seller: {
        select: {
          id: true,
          name: true,
          businessName: true,
          exposureScore: true,
          sellerVerified: true,
        },
      },
      promotions: { where: { active: true, endsAt: { gt: new Date() } } },
    },
    take: 200,
  });

  const rankable: RankableProduct[] = candidates.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    price: p.price,
    salePrice: p.salePrice,
    kind: p.kind,
    likeCount: p.likeCount,
    saveCount: p.saveCount,
    salesCount: p.salesCount,
    ratingAvg: p.ratingAvg,
    exposureScore: p.seller.exposureScore,
    dominantColors: parseJsonArray(p.dominantColorsJson),
    tags: parseJsonArray(p.tagsJson).map((t) => t.toLowerCase()),
    promoted: p.promotions.length > 0,
    sellerId: p.seller.id,
    sellerVerified: p.seller.sellerVerified,
  }));

  // Build a viewer signal for personalization.
  const viewer = await buildViewerSignal();

  const ranked = rank({
    parsed,
    products: rankable,
    clickHistory: new Map(),
    imageMode: true,
    viewer,
  });

  const productById = new Map(candidates.map((c) => [c.id, c]));
  const results = ranked
    .filter((r) => r.score >= 1)
    .slice(0, 24)
    .map((r) => {
      const c = productById.get(r.product.id)!;
      return {
        id: r.product.id,
        name: r.product.name,
        price: r.product.price,
        salePrice: r.product.salePrice,
        category: r.product.category,
        image: parseJsonArray(c.imagesJson)[0] ?? null,
        sellerName: c.seller.businessName ?? c.seller.name,
        score: Math.round(r.score * 100) / 100,
        reasons: r.reasons,
      };
    });

  return NextResponse.json({
    parsed: {
      categories: parsed.categories,
      colors: parsed.colors,
      hexColors,
    },
    results,
  });
}

async function buildViewerSignal(): Promise<ViewerSignal | undefined> {
  const session = await getSession();
  if (!session) return undefined;
  const [follows, recent] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: session.sub },
      select: { designerId: true },
      take: 200,
    }),
    prisma.like.findMany({
      where: { userId: session.sub, productId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { product: { select: { category: true } } },
    }),
  ]);
  return {
    followedSellerIds: new Set(follows.map((f) => f.designerId)),
    recentLikedCategories: new Set(
      recent.map((l) => l.product?.category).filter((c): c is string => !!c),
    ),
  };
}