// Deterministic search bot for StreekMart.
//
// Not an LLM — a hand-tuned natural-language parser combined with a
// click-through ranker. The behavior is fully inspectable from the source:
//   parse(query) → ParsedQuery        decides categories/colors/price/tags
//   rank(matches, history) → results  scores by engagement + history bias
//
// The "controlled learning" angle is the SearchLog table: every served query
// + the first product the user clicked is stored. When future queries
// normalize to the same key, products with high click-through history get a
// bias bump. There's no opaque model, just a stats table the operator can
// inspect, edit, or wipe.

import { CATEGORIES, CATEGORY_GROUPS, ProductKind } from "./enums";

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

// Synonym map: each key is a canonical category from CATEGORIES; each value
// is the set of words that should map to it. Singular/plural variants are
// listed explicitly — we want zero magic in tokenization.
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  // Materials
  Ankara: ["ankara", "wax print", "wax-print", "african print", "kitenge"],
  Lace: ["lace", "guipure", "chantilly", "tulle"],
  Linen: ["linen", "flax"],
  Cotton: ["cotton", "calico", "muslin"],
  Silk: ["silk", "habotai"],
  Satin: ["satin", "charmeuse"],
  Denim: ["denim", "jean", "jeans"],
  Chiffon: ["chiffon", "georgette"],
  Velvet: ["velvet", "velour"],
  "Sewing Supplies": ["thread", "needle", "needles", "zipper", "buttons", "interfacing"],
  "Tailoring Tools": ["scissors", "shears", "mannequin", "dressform", "sewing machine", "tailor", "tailoring"],
  // Clothing
  Tops: ["shirt", "shirts", "tee", "tees", "t-shirt", "tshirt", "blouse", "blouses", "tank", "top", "tops", "polo", "crop", "sweater", "hoodie", "sweatshirt"],
  Bottoms: ["pants", "trouser", "trousers", "jeans", "shorts", "leggings", "skirt", "skirts", "joggers", "chinos"],
  Dresses: ["dress", "dresses", "gown", "gowns", "frock", "sundress"],
  Outerwear: ["jacket", "blazer", "coat", "trench", "puffer", "parka", "cardigan", "windbreaker"],
  "Native Wear": ["agbada", "ankara dress", "kaftan", "buba", "boubou", "dashiki", "iro", "native"],
  Activewear: ["activewear", "leggings", "yoga", "gym", "sportswear", "running"],
  Loungewear: ["loungewear", "pajama", "pajamas", "robe", "sleepwear"],
  // Accessories
  Shoes: ["shoes", "sneakers", "boots", "sandals", "loafers", "heels", "trainers"],
  Bags: ["bag", "bags", "tote", "clutch", "purse", "handbag", "backpack", "satchel"],
  Jewelry: ["jewelry", "jewellery", "necklace", "bracelet", "ring", "rings", "earring", "earrings", "pendant"],
  Watches: ["watch", "watches", "timepiece"],
  Sunglasses: ["sunglasses", "shades", "eyewear", "glasses"],
  Hats: ["hat", "hats", "cap", "caps", "beanie", "fedora", "bucket"],
  Belts: ["belt", "belts"],
  Scarves: ["scarf", "scarves", "shawl", "wrap"],
  Beauty: ["lipstick", "perfume", "fragrance", "makeup", "cosmetic", "beauty"],
};

// Reverse index: token → category candidates (a token can match multiple).
const TOKEN_TO_CATEGORIES = (() => {
  const map = new Map<string, string[]>();
  for (const [cat, syns] of Object.entries(CATEGORY_SYNONYMS)) {
    for (const s of syns) {
      const arr = map.get(s) ?? [];
      arr.push(cat);
      map.set(s, arr);
    }
  }
  return map;
})();

// Color names → representative hex codes. The image matcher converts the
// uploaded image's dominant hex codes into nearest-name hits, then back to
// other products' tagged colors.
export const NAMED_COLORS: { name: string; hex: string }[] = [
  { name: "black", hex: "#000000" },
  { name: "white", hex: "#ffffff" },
  { name: "ivory", hex: "#f3edd9" },
  { name: "cream", hex: "#f5e9c8" },
  { name: "beige", hex: "#d8c4a0" },
  { name: "tan", hex: "#c9a17a" },
  { name: "brown", hex: "#5a3a1f" },
  { name: "gray", hex: "#808086" },
  { name: "grey", hex: "#808086" },
  { name: "silver", hex: "#c0c0c8" },
  { name: "gold", hex: "#cf9f32" },
  { name: "red", hex: "#c0252b" },
  { name: "maroon", hex: "#6b1a2a" },
  { name: "burgundy", hex: "#6b1a2a" },
  { name: "pink", hex: "#e879a8" },
  { name: "fuchsia", hex: "#d946ef" },
  { name: "purple", hex: "#7c3aed" },
  { name: "violet", hex: "#7c3aed" },
  { name: "lavender", hex: "#c4b5fd" },
  { name: "blue", hex: "#2c5fb8" },
  { name: "navy", hex: "#1a2342" },
  { name: "teal", hex: "#0b6e6e" },
  { name: "emerald", hex: "#0b6e4f" },
  { name: "green", hex: "#3d8a4d" },
  { name: "olive", hex: "#6b7a31" },
  { name: "yellow", hex: "#e8c530" },
  { name: "mustard", hex: "#caa73a" },
  { name: "orange", hex: "#e07a2a" },
  { name: "coral", hex: "#e88575" },
  { name: "peach", hex: "#f3c8b0" },
];

// Occasion → category bias. A "wedding" query nudges toward dresses and
// native wear; "office" toward bottoms/outerwear, etc.
const OCCASIONS: Record<string, string[]> = {
  wedding: ["Dresses", "Native Wear", "Lace", "Silk"],
  beach: ["Dresses", "Tops", "Sunglasses", "Hats", "Sandals"],
  office: ["Bottoms", "Outerwear", "Tops"],
  party: ["Dresses", "Tops", "Shoes"],
  casual: ["Tops", "Bottoms", "Shoes"],
  formal: ["Outerwear", "Bottoms", "Dresses"],
  gym: ["Activewear"],
  workout: ["Activewear"],
  date: ["Dresses", "Tops", "Outerwear"],
  sleep: ["Loungewear"],
  rain: ["Outerwear"],
  winter: ["Outerwear"],
  summer: ["Dresses", "Tops", "Sunglasses"],
};

// Material families — when a user mentions a fabric word, weight category
// search toward the matching material category AND keep the keyword for
// description matching.
const MATERIAL_WORDS = new Set([
  "ankara", "lace", "linen", "cotton", "silk", "denim", "chiffon", "velvet",
  "satin", "wool", "polyester", "rayon", "cashmere", "leather", "suede",
]);

// Stop words removed during tokenization so the bot doesn't waste time
// matching them.
const STOP_WORDS = new Set([
  "i", "me", "my", "we", "you", "your", "the", "a", "an", "of", "for", "to",
  "in", "on", "at", "with", "from", "by", "and", "or", "is", "are", "was",
  "were", "be", "been", "this", "that", "these", "those", "want", "need",
  "looking", "find", "show", "get", "buy", "shop", "search",
]);

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export type ParsedQuery = {
  rawQuery: string;
  normalized: string;
  tokens: string[];
  // Categories the bot is confident about (top-scoring).
  categories: string[];
  // Color names found explicitly in the query OR derived from uploaded image.
  colors: string[];
  // Material/fabric words mentioned (used to bias material listings).
  materials: string[];
  // Optional max price ceiling, e.g. "under $50".
  maxPrice?: number;
  // Occasion tag if any ("wedding", "beach", etc.).
  occasion?: string;
  // Free keywords that survived stop-word filtering — used for substring
  // matching against name/description.
  keywords: string[];
};

const PRICE_PATTERNS = [
  /under\s*\$?(\d{1,5})/i,
  /below\s*\$?(\d{1,5})/i,
  /less\s*than\s*\$?(\d{1,5})/i,
  /<=?\s*\$?(\d{1,5})/i,
];

// Tokenize: lowercase, strip punctuation, drop stop words.
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9$<>\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

export function parseQuery(rawQuery: string, hintColors: string[] = []): ParsedQuery {
  const normalized = rawQuery.trim().toLowerCase();
  const tokens = tokenize(normalized);

  // Price extraction.
  let maxPrice: number | undefined;
  for (const re of PRICE_PATTERNS) {
    const m = rawQuery.match(re);
    if (m) {
      maxPrice = Number(m[1]);
      break;
    }
  }

  // Occasion: first match wins (we cap at one occasion per query).
  let occasion: string | undefined;
  for (const w of tokens) {
    if (OCCASIONS[w]) {
      occasion = w;
      break;
    }
  }

  // Categories: score by token hits across single AND two-word phrases.
  const categoryScore = new Map<string, number>();
  function bump(cat: string, by: number) {
    categoryScore.set(cat, (categoryScore.get(cat) ?? 0) + by);
  }

  for (let i = 0; i < tokens.length; i++) {
    const single = tokens[i];
    const pair = i + 1 < tokens.length ? `${single} ${tokens[i + 1]}` : "";

    // Two-word phrase first (more specific).
    if (pair) {
      const cats = TOKEN_TO_CATEGORIES.get(pair);
      if (cats) cats.forEach((c) => bump(c, 3));
    }
    const cats = TOKEN_TO_CATEGORIES.get(single);
    if (cats) {
      cats.forEach((c) => bump(c, 1));
      continue;
    }
    // Typo tolerance — for tokens 4+ chars long that didn't match any known
    // synonym, look up the closest synonym by Levenshtein distance and accept
    // it if it's within 1 edit. This catches "linnen" → linen, "denlim" →
    // denim, "agbaba" → agbada, etc. Distance of 1 is intentionally strict
    // to keep false positives down.
    if (single.length >= 4) {
      const fuzzy = closestSynonym(single, 1);
      if (fuzzy) {
        const fcats = TOKEN_TO_CATEGORIES.get(fuzzy);
        if (fcats) fcats.forEach((c) => bump(c, 0.7));
      }
    }
  }

  // Occasion → category bias.
  if (occasion) {
    for (const cat of OCCASIONS[occasion]) {
      if (CATEGORIES.includes(cat)) bump(cat, 0.5);
    }
  }

  // Colors mentioned in query.
  const colors = new Set<string>(hintColors);
  for (const t of tokens) {
    if (NAMED_COLORS.find((c) => c.name === t)) colors.add(t);
  }

  // Materials.
  const materials: string[] = [];
  for (const t of tokens) {
    if (MATERIAL_WORDS.has(t)) materials.push(t);
  }

  // Pick top-3 categories by score (drop 0-score).
  const categories = [...categoryScore.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([, s]) => s > 0)
    .slice(0, 3)
    .map(([c]) => c);

  // Keywords = tokens not used as price/occasion markers.
  const keywords = tokens.filter(
    (t) =>
      !["under", "below", "less", "than"].includes(t) &&
      !(occasion && t === occasion) &&
      !/^\d+$/.test(t),
  );

  return {
    rawQuery,
    normalized,
    tokens,
    categories,
    colors: [...colors],
    materials,
    maxPrice,
    occasion,
    keywords,
  };
}

// ---------------------------------------------------------------------------
// Typo tolerance — Levenshtein over the (small) synonym vocabulary
// ---------------------------------------------------------------------------

const ALL_SYNONYMS = [...TOKEN_TO_CATEGORIES.keys()].filter((s) => !s.includes(" "));

function closestSynonym(token: string, maxDist: number): string | null {
  let best: string | null = null;
  let bestD = maxDist + 1;
  for (const s of ALL_SYNONYMS) {
    // Skip wildly different lengths cheaply — the bound rules them out.
    if (Math.abs(s.length - token.length) > maxDist) continue;
    const d = levenshtein(token, s, maxDist);
    if (d <= maxDist && d < bestD) {
      bestD = d;
      best = s;
      if (d === 0) break;
    }
  }
  return best;
}

// Iterative Damerau-Levenshtein lite (substitution/insertion/deletion only),
// with an early-exit cap. Plenty fast for our ~250-entry vocabulary.
function levenshtein(a: string, b: string, cap: number): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > cap) return cap + 1;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > cap) return cap + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// ---------------------------------------------------------------------------
// Color matching (used for image search)
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

// Squared distance in RGB space — cheap, good enough for our category-level
// matching. CIELab would be more perceptually accurate, not worth the cost
// for hex-bucket matching.
function colorDistanceSq(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2;
}

// Convert a list of dominant hex colors from an uploaded image into the
// closest named-color hits. Used so image search reuses the same color
// vocabulary as text search.
export function namedColorsFromHex(hexes: string[]): string[] {
  const hits = new Set<string>();
  for (const hex of hexes) {
    let bestName = NAMED_COLORS[0].name;
    let bestDist = Infinity;
    for (const c of NAMED_COLORS) {
      const d = colorDistanceSq(hex, c.hex);
      if (d < bestDist) {
        bestDist = d;
        bestName = c.name;
      }
    }
    hits.add(bestName);
  }
  return [...hits];
}

// Score how well two hex sets overlap (0..1). Used by image-mode ranking.
export function colorOverlapScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  // For each color in `a`, find the closest in `b` and accumulate inverse-distance.
  let total = 0;
  for (const ca of a) {
    let best = Infinity;
    for (const cb of b) {
      const d = colorDistanceSq(ca, cb);
      if (d < best) best = d;
    }
    // Distances range 0..195075 in RGB; normalize to 0..1.
    total += 1 - Math.min(1, best / 30000);
  }
  return total / a.length;
}

// ---------------------------------------------------------------------------
// Ranker
// ---------------------------------------------------------------------------

export type RankableProduct = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  salePrice: number | null;
  kind: string;
  likeCount: number;
  saveCount: number;
  salesCount: number;
  ratingAvg: number;
  exposureScore: number;
  dominantColors: string[];
  tags: string[];
  promoted: boolean;
  // Optional — set by the API layer when the viewer is logged in. Lets the
  // ranker apply a personalisation boost without forcing every callsite to
  // populate it.
  sellerId?: string;
  sellerVerified?: boolean;
};

// Per-viewer signal injected by the API layer. None of these are required —
// when the request is anonymous they're all left empty/null and the ranker
// behaves as before.
export type ViewerSignal = {
  // Designer/seller IDs the viewer follows. Boost their products.
  followedSellerIds?: Set<string>;
  // Categories the viewer has liked or saved recently. Items in those
  // categories get a soft bump even when the query doesn't mention them.
  recentLikedCategories?: Set<string>;
};

export type RankInput = {
  parsed: ParsedQuery;
  products: RankableProduct[];
  // Map of productId → click count for queries normalized to parsed.normalized.
  clickHistory: Map<string, number>;
  // True for image-mode (color overlap matters more).
  imageMode?: boolean;
  // Optional viewer signal — empty or null for anonymous requests.
  viewer?: ViewerSignal;
};

export type RankedResult = {
  product: RankableProduct;
  score: number;
  reasons: string[];
};

export function rank(input: RankInput): RankedResult[] {
  const { parsed, products, clickHistory, imageMode, viewer } = input;
  const followedSet = viewer?.followedSellerIds ?? new Set<string>();
  const likedCats = viewer?.recentLikedCategories ?? new Set<string>();

  return products
    .map((p) => {
      const reasons: string[] = [];
      let score = 0;

      // Category match (strong signal).
      if (parsed.categories.includes(p.category)) {
        score += 4;
        reasons.push(`category: ${p.category}`);
      } else if (parsed.categories.length > 0) {
        // Off-category but maybe still relevant — much smaller bump.
        score += 0.5;
      } else {
        // No category opinion from the query — let the rest decide.
        score += 1;
      }

      // Material bias (Ankara/Linen/etc. — these are themselves categories,
      // so material-named queries reinforce the category match).
      for (const m of parsed.materials) {
        if (p.category.toLowerCase() === m || p.tags.includes(m)) {
          score += 1;
          reasons.push(`material: ${m}`);
        }
      }

      // Keyword match against name+description (substring; case-insensitive).
      const haystack = (p.name + " " + p.description).toLowerCase();
      let kwHits = 0;
      for (const kw of parsed.keywords) {
        if (kw.length < 2) continue;
        if (haystack.includes(kw)) kwHits++;
      }
      if (kwHits > 0) {
        score += Math.min(3, kwHits);
        reasons.push(`${kwHits} keyword hit${kwHits === 1 ? "" : "s"}`);
      }

      // Color match.
      if (parsed.colors.length > 0) {
        if (imageMode && p.dominantColors.length > 0) {
          // Image mode: compare image colors to product's dominant palette.
          const userHexes = parsed.colors
            .map((n) => NAMED_COLORS.find((c) => c.name === n)?.hex)
            .filter((h): h is string => !!h);
          const overlap = colorOverlapScore(userHexes, p.dominantColors);
          if (overlap > 0.3) {
            score += overlap * 4;
            reasons.push(`color overlap: ${Math.round(overlap * 100)}%`);
          }
        } else {
          // Text mode: did the product mention the color word?
          for (const cn of parsed.colors) {
            if (haystack.includes(cn) || p.tags.includes(cn)) {
              score += 1.5;
              reasons.push(`color: ${cn}`);
              break;
            }
          }
        }
      }

      // Price ceiling.
      if (parsed.maxPrice) {
        const eff = p.salePrice ?? p.price;
        if (eff <= parsed.maxPrice) {
          score += 1;
        } else {
          score -= 2;
          reasons.push(`over budget`);
        }
      }

      // Engagement signal — small steady contribution.
      score +=
        Math.log1p(p.likeCount) * 0.2 +
        Math.log1p(p.saveCount) * 0.3 +
        Math.log1p(p.salesCount) * 0.4 +
        Math.log1p(p.exposureScore) * 0.2;

      // Promoted boost.
      if (p.promoted) {
        score *= 1.2;
        reasons.push("promoted");
      }

      // Click-history bias — the controlled-learning lever.
      const clicks = clickHistory.get(p.id) ?? 0;
      if (clicks > 0) {
        score += Math.log1p(clicks) * 1.0;
        reasons.push(`history: ${clicks} click${clicks === 1 ? "" : "s"}`);
      }

      // Viewer personalisation — followed seller + recently-liked category
      // both nudge the score upward without overwhelming the query intent.
      if (p.sellerId && followedSet.has(p.sellerId)) {
        score += 1.5;
        reasons.push("from a seller you follow");
      }
      if (likedCats.has(p.category)) {
        score += 0.8;
        reasons.push("matches your taste");
      }

      // Verified seller — small uplift, mirrors the feed ranker's policy
      // so users see the same trust signal in both surfaces.
      if (p.sellerVerified) {
        score *= 1.08;
      }

      return { product: p, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Suggestions (autocomplete)
// ---------------------------------------------------------------------------

// Static seed of popular queries — augment with frequent rows from SearchLog
// at call time. Provides instant suggestions even before any history exists.
const SEED_SUGGESTIONS = [
  "ankara fabric",
  "linen shirt",
  "silk dress",
  "denim jacket",
  "agbada set",
  "wedding gown under $300",
  "leather tote",
  "summer dress",
  "office trousers",
  "oversized hoodie",
];

export function staticSuggestions(prefix: string, limit = 6): string[] {
  const p = prefix.trim().toLowerCase();
  if (!p) return SEED_SUGGESTIONS.slice(0, limit);
  const matches = SEED_SUGGESTIONS.filter((s) => s.includes(p));
  // If the prefix doesn't match seeds, expand to category names that start
  // with the prefix (e.g. "Lin" → "Linen").
  if (matches.length < limit) {
    for (const c of CATEGORIES) {
      if (c.toLowerCase().startsWith(p) && !matches.find((m) => m.includes(c.toLowerCase()))) {
        matches.push(c.toLowerCase());
      }
      if (matches.length >= limit) break;
    }
  }
  return matches.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Helpers used by the API layer
// ---------------------------------------------------------------------------

// Normalize a query for the SearchLog key. Trim, lowercase, collapse whitespace.
export function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 200);
}

// True if a category belongs to the Materials group — used to filter
// "raw fabric" queries from finished-product results when the bot isn't sure.
export function isMaterialCategory(cat: string): boolean {
  return (CATEGORY_GROUPS.Materials as readonly string[]).includes(cat);
}

export { ProductKind };
