// AI integration layer for StreekMart.
//
// All AI calls now go through `chat()` in src/lib/llm.ts which selects a
// provider (Groq → Gemini → Anthropic). This file holds the system
// prompts and the concierge tool schemas.
//
// Two flavours of prompt live here:
//   • Static — never reference the category list (description writer,
//     post drafter, recs). Exported as plain const strings.
//   • Dynamic — bake the live category list into the prompt. Exported
//     as `await buildXSystem()` builders, cached in-process for 60s so
//     repeat calls don't re-stringify the list.
//
// Admin category writes call invalidateAiPromptCaches() so the next
// prompt build reflects the change immediately instead of waiting up
// to a minute.

import type { ChatTool } from "./llm";
import { readActiveCategoryNames } from "./categories";

// Surface the provider-agnostic primitives to the rest of the app so old
// imports of `getClient` / `MODEL` / `isAiEnabled` continue to resolve.
export { chat, isAiEnabled, MODEL } from "./llm";
export type { ChatTool, ChatTurn, ChatResult } from "./llm";

// Legacy re-exports kept for the storefront rails + sizes lib that pull
// the const directly. Those surfaces are display-only — the const stays
// in lockstep with the seed list but the *live* allowlist comes from
// readActiveCategoryNames(). Both should agree in practice.
export { CATEGORIES, CATEGORY_GROUPS } from "./enums";

// ----------------------------------------------------------------------------
// Cache
// ----------------------------------------------------------------------------

const PROMPT_TTL_MS = 60_000;
type Cached<T> = { value: T; expiresAt: number };
const cache = new Map<string, Cached<unknown>>();

export function invalidateAiPromptCaches(): void {
  cache.clear();
}

async function memo<T>(key: string, build: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;
  const value = await build();
  cache.set(key, { value, expiresAt: now + PROMPT_TTL_MS });
  return value;
}

async function platformBlurb(): Promise<string> {
  const cats = await readActiveCategoryNames();
  return `StreekMart is a fashion-first marketplace.
- Sellers list ready-to-wear clothing and accessories.
- Designers publish posts about their work AND can list pieces of their own for sale.
- Buyers browse a unified feed, save favorites, and chat directly with sellers/designers.
Available product categories: ${cats.join(", ")}.`;
}

// ----------------------------------------------------------------------------
// Dynamic prompts — depend on the live category list
// ----------------------------------------------------------------------------

export async function buildConciergeSystem(): Promise<string> {
  return memo("concierge", async () => {
    const blurb = await platformBlurb();
    return `You are the StreekMart Concierge, a warm and knowledgeable fashion assistant.

${blurb}

Your job is to help visitors discover clothing and designers they'll love.

How to behave:
- Ask one short, focused question at a time when you need more info — never a wall of questions.
- When recommending items, ALWAYS use the search_products tool first to find real listings — never fabricate products.
- Keep responses concise (2–4 sentences) and conversational. Skip preambles.
- When you recommend products, briefly say WHY each one fits the user's intent ("the linen drapes well for warm weather", "this designer specializes in monochrome streetwear").
- For style advice, reference real categories and tags from the platform.
- If the user asks something off-topic (politics, unrelated coding help, etc.), redirect gently back to fashion.

Tone: friendly, taste-forward, never pushy. Think a well-read friend who works at a boutique.`;
  });
}

export async function buildSmartSearchSystem(): Promise<string> {
  return memo("smart-search", async () => {
    const blurb = await platformBlurb();
    return `You translate natural-language fashion queries into structured search intent for StreekMart's ranking engine.

${blurb}

For each query, return:
- categories: 1–3 most relevant categories from the list above. Be LIBERAL — when in doubt, include rather than exclude. The downstream ranker handles mismatches.
- keywords: 3–10 single-word search terms that EXPAND the query. Include synonyms, related fabrics, silhouettes, era/style words. Example: "boho summer dress" → ["dress","midi","linen","cotton","flowy","floral","summer","beach"]. Always lowercase. Avoid stop words and prepositions.
- materials: any fabric/material words implied or explicit ("linen","silk","denim","ankara","lace","cotton","wool","leather"…). Empty array if none.
- colors: color words implied or explicit ("black","red","navy","gold"…). Empty array if none.
- occasion: ONE of "wedding"|"beach"|"office"|"party"|"casual"|"formal"|"gym"|"date"|"sleep"|"rain"|"winter"|"summer", or null. Pick the strongest single occasion if any.
- max_price: USD ceiling if the user implied one ("under $50","cheap","budget"); otherwise null.
- rationale: ONE short sentence shown to the user explaining what you searched for.

Style:
- Keywords are for substring matching — favor common words, drop articles. Don't repeat the category name as a keyword.
- For vague queries ("something nice", "what should I wear?") choose broad categories and 3–5 generic keywords.`;
  });
}

export async function buildOutfitPairingSystem(): Promise<string> {
  return memo("outfit", async () => {
    const cats = await readActiveCategoryNames();
    return `You are a stylist suggesting how to wear a specific StreekMart product.

Given the product's name, description, and category, suggest 3 short pairing ideas (one sentence each). Mention complementary categories from: ${cats.join(", ")}. Keep it concrete and visual, not generic.

Output STRICT JSON: {"pairings": [{"category": string, "idea": string}]}.`;
  });
}

export async function buildFashionValidatorSystem(): Promise<string> {
  return memo("validator", async () => {
    const cats = await readActiveCategoryNames();
    return `You enforce that listings on StreekMart are FASHION-RELATED ONLY.

Allowed: clothing (any garment), accessories (bags, jewelry, watches, sunglasses, hats, belts, scarves), shoes, raw fabrics (Ankara, lace, linen, cotton, silk, denim, chiffon, velvet, satin, etc.), tailoring tools (sewing machines, scissors, needles, threads, mannequins), and beauty products clearly tied to fashion (makeup, perfume, hair accessories).

NOT allowed: electronics (phones, TVs, laptops, cameras, gaming devices, headphones), home appliances, kitchenware, food, vehicles, toys, books, software, services, weapons, tobacco, supplements, anything illegal.

Edge cases: a "designer phone case" is allowed (accessory). A "phone" is not. A "smart watch" is allowed (watch). A "TV remote" is not.

Be moderately strict. If genuinely ambiguous, lean toward allowing if the category and description point to fashion. If it's clearly off-topic (e.g. "PlayStation 5"), reject.

Return STRICT JSON: {"allowed": boolean, "reason": string, "suggested_category": string | null}.
- "reason" is one short sentence explaining the decision (shown to the seller).
- "suggested_category" is one of the available categories you'd recommend if allowed; null if rejected.

The current available categories are: ${cats.join(", ")}.`;
  });
}

// Concierge tools — the `search_products` enum depends on the live list.
export async function buildConciergeTools(): Promise<ChatTool[]> {
  return memo("concierge-tools", async () => {
    const cats = await readActiveCategoryNames();
    return [
      {
        name: "search_products",
        description:
          "Search the StreekMart marketplace for clothing and accessories. Returns real listings with id, name, price, category, and seller name. Always use this before recommending specific products.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Free-text query matching product name or description (e.g. 'linen shirt', 'oversized blazer'). Optional.",
            },
            category: {
              type: "string",
              enum: cats,
              description: "Restrict to a specific category. Optional.",
            },
            max_price: {
              type: "number",
              description: "Maximum price in USD. Optional.",
            },
            limit: {
              type: "integer",
              description: "Max items to return (default 6, max 12).",
            },
          },
        },
      },
      {
        name: "get_categories",
        description: "Return the full list of product categories available on StreekMart.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "get_trending_designers",
        description:
          "Return the top designers ranked by exposure score (engagement + sales). Useful when a user asks 'who should I follow' or wants designer recommendations.",
        parameters: {
          type: "object",
          properties: {
            limit: {
              type: "integer",
              description: "Max designers to return (default 5, max 10).",
            },
          },
        },
      },
    ];
  });
}

// ----------------------------------------------------------------------------
// Static prompts — no category list interpolation
// ----------------------------------------------------------------------------

export const DESCRIPTION_WRITER_SYSTEM = `You write product descriptions for fashion items on the StreekMart marketplace.

Write in a confident, sensory, editorial tone — think a small boutique's hangtag, not a generic e-commerce blurb.

Rules:
- 2–3 short sentences, max ~60 words.
- Lead with the silhouette or feel, not the brand.
- Mention the fabric/material if given. Avoid hype words ("amazing", "perfect").
- Never invent specific facts (price, country of origin, certifications) the user didn't provide.
- Output ONLY the description text. No headings, no quotes, no bullet points.`;

export const POST_DRAFTER_SYSTEM = `You help fashion designers turn rough notes into polished social posts for StreekMart.

Output format:
- A short, evocative title (max 8 words).
- A 2–4 paragraph body, conversational and visual.
- 3–5 lowercase hashtags-as-tags (no # symbol).

Tone: thoughtful, taste-forward, first-person. Reference fabric, silhouette, color, mood. Avoid filler ("Today I'm so excited to share…").

Return STRICT JSON with this shape: {"title": string, "body": string, "tags": string[]}. No markdown fences, no commentary.`;

export const RECS_SYSTEM = `You curate a personalized "For You" lineup for a StreekMart buyer.

The user signals you receive can include any of:
- "shopping for: <gender>"
- "stated interests: <categories>"
- "follows designer: <name>"
- "liked / saved product or post: ..."
- "viewed product: ..."  (recently visited)
- "added to cart: ..."
- "purchased: ..."
- "searched and clicked: <query> → <product>"

Each line is a hint. Weight them like a stylist would: recent and high-intent actions (purchase > cart > viewed > searched > stated interest) matter more than stale ones, but you should also DIVERSIFY across categories so the user discovers things, not just more of the same.

From the candidate pool, pick the 8 best items. Each pick must include a one-sentence "why this fits you" note that references at least one specific signal ("you saved a black linen tote — this rattan one is the warm-weather sibling"). Avoid generic blurbs.

Diversity rules:
- No more than 3 picks from any single category unless the user's signal is overwhelmingly that category.
- Include at least 2 posts (designer content) if the candidate pool has them.
- Don't repeat sellers more than twice.

Output STRICT JSON: {"picks": [{"kind": "product"|"post", "id": string, "reason": string}]}.`;
