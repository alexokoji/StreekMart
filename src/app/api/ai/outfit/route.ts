import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { CATEGORIES, OUTFIT_PAIRING_SYSTEM, chat, isAiEnabled } from "@/lib/ai";

// AI outfit pairing — given a product, suggest 3 ways to style it.
// Public: no auth required (improves discovery for guests).

const Body = z.object({ productId: z.string() });

const Pairings = z.object({
  pairings: z
    .array(
      z.object({
        category: z.enum(CATEGORIES),
        idea: z.string().min(5).max(220),
      }),
    )
    .max(5),
});

export async function POST(req: Request) {
  if (!isAiEnabled()) {
    return NextResponse.json({ error: "AI features are disabled." }, { status: 503 });
  }
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { name: true, description: true, category: true },
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userPrompt = `Item: ${product.name}
Category: ${product.category}
Description: ${product.description}`;

  const { text } = await chat({
    system: OUTFIT_PAIRING_SYSTEM,
    maxTokens: 600,
    messages: [{ role: "user", content: userPrompt }],
    responseJsonSchema: {
      type: "object",
      properties: {
        pairings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string", enum: [...CATEGORIES] },
              idea: { type: "string" },
            },
            required: ["category", "idea"],
          },
        },
      },
      required: ["pairings"],
    },
  });

  try {
    const data = Pairings.parse(JSON.parse(text));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Couldn't generate pairings." }, { status: 422 });
  }
}
