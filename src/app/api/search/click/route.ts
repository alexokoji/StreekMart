import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { normalizeQuery } from "@/lib/searchBot";

// POST /api/search/click { query, productId, source? }
//
// Records that the user clicked a result for a given query. The ranker reads
// these to bias future searches with the same normalized query toward the
// product. Public — anonymous clicks are valuable signal too.

const Body = z.object({
  query: z.string().min(1).max(300),
  productId: z.string().min(1),
  source: z.enum(["text", "image"]).optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const session = await getSession();
  const queryNorm = parsed.data.source === "image"
    ? normalizeQuery(`image:${parsed.data.query}`)
    : normalizeQuery(parsed.data.query);

  await prisma.searchLog.create({
    data: {
      queryNorm,
      source: parsed.data.source ?? "text",
      userId: session?.sub ?? null,
      clickedProductId: parsed.data.productId,
    },
  });

  return NextResponse.json({ ok: true });
}
