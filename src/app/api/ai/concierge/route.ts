import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import {
  CONCIERGE_SYSTEM,
  CONCIERGE_TOOLS,
  MODEL,
  getClient,
  isAiEnabled,
} from "@/lib/ai";
import { parseJsonArray } from "@/lib/utils";

// Light shape for product cards we surface to the UI alongside the reply.
type ProductCard = {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl: string | null;
  sellerName: string;
  href: string;
};

// We accept an array of {role, content} from the client (string content is fine
// for plain user messages; the server folds in tool_use/tool_result blocks
// during the loop).
const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .min(1)
    .max(40),
});

const MAX_LOOP_ITERATIONS = 6;

export async function POST(req: Request) {
  if (!isAiEnabled()) {
    return NextResponse.json(
      { error: "AI features are disabled. Set ANTHROPIC_API_KEY in .env." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const client = getClient();
  const messages: Anthropic.MessageParam[] = parsed.data.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const collectedCards = new Map<string, ProductCard>();

  for (let i = 0; i < MAX_LOOP_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      // The system prompt is large and stable across requests — cache the prefix.
      system: [
        {
          type: "text",
          text: CONCIERGE_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: CONCIERGE_TOOLS,
      messages,
    });

    // If Claude is done, extract the text and return.
    if (response.stop_reason === "end_turn" || response.stop_reason === "stop_sequence") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

      return NextResponse.json({
        reply: text || "I'm not sure how to help with that — try asking again?",
        products: Array.from(collectedCards.values()),
      });
    }

    if (response.stop_reason !== "tool_use") {
      // Refusal, max_tokens, or anything unexpected — return what we have.
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return NextResponse.json({
        reply: text || "Sorry, I couldn't finish that thought. Try rephrasing?",
        products: Array.from(collectedCards.values()),
      });
    }

    // Tool use: append the assistant turn verbatim, then execute every tool_use
    // block and reply with matching tool_result blocks in a single user turn.
    messages.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const tu of toolUses) {
      try {
        const result = await runConciergeTool(tu.name, tu.input, collectedCards);
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        });
      } catch (err) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          is_error: true,
          content: err instanceof Error ? err.message : "Tool execution failed",
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  return NextResponse.json({
    reply: "I went a few rounds and didn't reach a clean answer — try a more specific question?",
    products: Array.from(collectedCards.values()),
  });
}

// ---------------------------------------------------------------------------
// Tool implementations — these run server-side against Prisma.
// ---------------------------------------------------------------------------

async function runConciergeTool(
  name: string,
  rawInput: unknown,
  cards: Map<string, ProductCard>,
): Promise<unknown> {
  const input = (rawInput ?? {}) as Record<string, unknown>;

  if (name === "search_products") {
    const query = typeof input.query === "string" ? input.query : undefined;
    const category = typeof input.category === "string" ? input.category : undefined;
    const maxPrice = typeof input.max_price === "number" ? input.max_price : undefined;
    const limit = clampInt(input.limit, 6, 1, 12);

    const products = await prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        ...(category ? { category } : {}),
        ...(maxPrice !== undefined ? { price: { lte: maxPrice } } : {}),
        ...(query
          ? {
              OR: [
                { name: { contains: query } },
                { description: { contains: query } },
              ],
            }
          : {}),
      },
      include: { seller: { select: { id: true, name: true } } },
      orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    // Capture product cards so the UI can render them next to the reply.
    for (const p of products) {
      const images = parseJsonArray(p.imagesJson);
      cards.set(p.id, {
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category,
        imageUrl: images[0] ?? null,
        sellerName: p.seller.name,
        href: `/products/${p.id}`,
      });
    }

    // Return a slim, model-friendly view (no images, no JSON noise).
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      category: p.category,
      seller: p.seller.name,
      likes: p.likeCount,
      description: p.description.slice(0, 160),
    }));
  }

  if (name === "get_categories") {
    const grouped = await prisma.product.groupBy({
      by: ["category"],
      where: { status: ProductStatus.ACTIVE },
      _count: { _all: true },
    });
    return grouped.map((g) => ({ category: g.category, productCount: g._count._all }));
  }

  if (name === "get_trending_designers") {
    const limit = clampInt(input.limit, 5, 1, 10);
    const designers = await prisma.user.findMany({
      where: { isDesigner: true },
      orderBy: { exposureScore: "desc" },
      take: limit,
      select: { id: true, name: true, bio: true, exposureScore: true, designerVerified: true },
    });
    return designers;
  }

  throw new Error(`Unknown tool: ${name}`);
}

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : fallback;
  return Math.max(min, Math.min(max, n));
}
