import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { staticSuggestions, normalizeQuery } from "@/lib/searchBot";

// GET /api/search/suggest?q=<prefix>
// Returns a small list of suggestions that combines:
//   1. Hand-curated seeds (always available, no DB hit needed)
//   2. The most-clicked recent queries that share the prefix
// The seeds give zero-state coverage; the click data lets the bot "learn"
// what users actually look for over time.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const prefix = (url.searchParams.get("q") ?? "").trim();

  const seeds = staticSuggestions(prefix, 6);

  // Pull recent queries that successfully resulted in a click (clickedProductId
  // present) and share the prefix. Group by queryNorm and order by frequency.
  let learned: string[] = [];
  if (prefix.length >= 2) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await prisma.searchLog.groupBy({
      by: ["queryNorm"],
      where: {
        queryNorm: { startsWith: normalizeQuery(prefix) },
        clickedProductId: { not: null },
        createdAt: { gte: since },
      },
      _count: { _all: true },
      orderBy: { _count: { queryNorm: "desc" } },
      take: 6,
    });
    learned = rows
      .map((r) => r.queryNorm)
      // Drop image: prefixed image-search keys.
      .filter((q) => !q.startsWith("image:"));
  }

  // Merge, dedupe, cap at 8.
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const s of [...learned, ...seeds]) {
    const k = s.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      merged.push(s);
    }
    if (merged.length >= 8) break;
  }

  return NextResponse.json({ suggestions: merged });
}
