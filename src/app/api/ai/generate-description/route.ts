import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { Permission } from "@/lib/enums";
import { requireApiUser } from "@/lib/auth";
import { DESCRIPTION_WRITER_SYSTEM, MODEL, getClient, isAiEnabled } from "@/lib/ai";

// AI product-description writer.
// Sellers and designers paste a few keywords; Claude returns a polished blurb.

const Body = z.object({
  name: z.string().min(2).max(120),
  category: z.string().min(1).max(40),
  notes: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  if (!isAiEnabled()) {
    return NextResponse.json(
      { error: "AI features are disabled. Set ANTHROPIC_API_KEY in .env." },
      { status: 503 },
    );
  }

  // Both sellers and designers create products.
  const guard = await requireApiUser([Permission.SELLER, Permission.DESIGNER]);
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { name, category, notes } = parsed.data;
  const userPrompt = [
    `Product name: ${name}`,
    `Category: ${category}`,
    notes ? `Notes from seller: ${notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: [
      {
        type: "text",
        text: DESCRIPTION_WRITER_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const description = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim()
    // Strip accidental wrapping quotes if the model adds them despite instructions.
    .replace(/^["“”]+|["“”]+$/g, "");

  return NextResponse.json({ description });
}
