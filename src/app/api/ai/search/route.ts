import { NextResponse } from "next/server";
import { z } from "zod";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { CATEGORIES, SMART_SEARCH_SYSTEM, chat, isAiEnabled } from "@/lib/ai";
import { parseJsonArray } from "@/lib/utils";

// Structured output schema — Claude returns JSON matching this shape.
const SearchPlan = z.object({
  categories: z.array(z.enum(CATEGORIES)).max(3),
  keyword_phrase: z.string().max(60),
  max_price: z.number().positive().nullable(),
  rationale: z.string().max(200),
});

const Body = z.object({ query: z.string().min(2).max(300) });

export async function POST(req: Request) {
  if (!isAiEnabled()) {
    return NextResponse.json(
      { error: "AI features are disabled. Set GEMINI_API_KEY in .env." },
      { status: 503 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { text } = await chat({
    system: SMART_SEARCH_SYSTEM,
    maxTokens: 512,
    messages: [{ role: "user", content: parsed.data.query }],
    responseJsonSchema: {
      type: "object",
      properties: {
        categories: {
          type: "array",
          items: { type: "string", enum: [...CATEGORIES] },
        },
        keyword_phrase: { type: "string" },
        max_price: { type: ["number", "null"] },
        rationale: { type: "string" },
      },
      required: ["categories", "keyword_phrase", "max_price", "rationale"],
    },
  });

  let plan: z.infer<typeof SearchPlan>;
  try {
    plan = SearchPlan.parse(JSON.parse(text));
  } catch {
    return NextResponse.json(
      { error: "Couldn't interpret that query. Try rephrasing?" },
      { status: 422 },
    );
  }

  const where = {
    status: ProductStatus.ACTIVE,
    ...(plan.categories.length > 0 ? { category: { in: plan.categories } } : {}),
    ...(plan.max_price !== null ? { price: { lte: plan.max_price } } : {}),
    ...(plan.keyword_phrase
      ? {
          OR: [
            { name: { contains: plan.keyword_phrase } },
            { description: { contains: plan.keyword_phrase } },
          ],
        }
      : {}),
  };

  const products = await prisma.product.findMany({
    where,
    include: { seller: { select: { id: true, name: true } } },
    orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
    take: 24,
  });

  const items = products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    category: p.category,
    description: p.description,
    image: parseJsonArray(p.imagesJson)[0] ?? null,
    seller: p.seller,
    likeCount: p.likeCount,
  }));

  return NextResponse.json({ plan, items });
}
