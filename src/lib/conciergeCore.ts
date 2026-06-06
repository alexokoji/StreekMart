// Reusable AI concierge tool-loop. Both `/api/ai/concierge` (the on-site
// SmartSearch panel) and `/api/whatsapp/webhook` (the WhatsApp concierge)
// call this so they share the same brain — same system prompt, same
// `search_products` / `get_categories` / `get_trending_designers` tools.

import { ProductStatus } from "./enums";
import { prisma } from "./db";
import { CONCIERGE_SYSTEM, CONCIERGE_TOOLS } from "./ai";
import { chat, type ChatTurn } from "./llm";
import { parseJsonArray } from "./utils";

export type ConciergeProductCard = {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl: string | null;
  sellerName: string;
  href: string;
};

export type ConciergeResult = {
  reply: string;
  products: ConciergeProductCard[];
};

const MAX_LOOP_ITERATIONS = 6;

/**
 * Run the concierge against a conversation history and return the final
 * reply + the product cards the search tool surfaced along the way.
 *
 * `messages` is the running history (user + assistant turns). For a
 * fresh-conversation invocation just pass one user message.
 *
 * `productHref` maps a productId → URL the user can click. Web invocations
 * pass `id => /products/${id}`; WhatsApp passes the absolute https URL so
 * the links preview cleanly in chat.
 */
export async function runConcierge(args: {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  productHref: (productId: string) => string;
}): Promise<ConciergeResult> {
  const turns: ChatTurn[] = args.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const cards = new Map<string, ConciergeProductCard>();

  for (let i = 0; i < MAX_LOOP_ITERATIONS; i++) {
    const result = await chat({
      system: CONCIERGE_SYSTEM,
      tools: CONCIERGE_TOOLS,
      messages: turns,
      maxTokens: 2048,
    });

    if (result.stopReason !== "tool_use" || result.toolCalls.length === 0) {
      return {
        reply: result.text || "I'm not sure how to help with that — try asking again?",
        products: Array.from(cards.values()),
      };
    }

    // Replay the assistant tool-call turn, run every tool, append the
    // results in a single user turn — same shape both providers expect.
    turns.push({
      role: "assistant",
      text: result.text || undefined,
      toolCalls: result.toolCalls,
    });
    const toolResults: Array<{ toolUseId: string; content: string; isError?: boolean }> = [];
    for (const tu of result.toolCalls) {
      try {
        const out = await runConciergeTool(tu.name, tu.input, cards, args.productHref);
        toolResults.push({ toolUseId: tu.id, content: JSON.stringify(out) });
      } catch (err) {
        toolResults.push({
          toolUseId: tu.id,
          isError: true,
          content: err instanceof Error ? err.message : "Tool execution failed",
        });
      }
    }
    turns.push({ role: "user", toolResults });
  }

  return {
    reply: "I went a few rounds and didn't reach a clean answer — try a more specific question?",
    products: Array.from(cards.values()),
  };
}

async function runConciergeTool(
  name: string,
  rawInput: unknown,
  cards: Map<string, ConciergeProductCard>,
  productHref: (productId: string) => string,
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

    for (const p of products) {
      const images = parseJsonArray(p.imagesJson);
      cards.set(p.id, {
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category,
        imageUrl: images[0] ?? null,
        sellerName: p.seller.name,
        href: productHref(p.id),
      });
    }

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
    return prisma.user.findMany({
      where: { isDesigner: true },
      orderBy: { exposureScore: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        bio: true,
        exposureScore: true,
        designerVerified: true,
      },
    });
  }

  throw new Error(`Unknown tool: ${name}`);
}

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : fallback;
  return Math.max(min, Math.min(max, n));
}
