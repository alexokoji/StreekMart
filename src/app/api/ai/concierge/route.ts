import { NextResponse } from "next/server";
import { z } from "zod";
import { isAiEnabled } from "@/lib/ai";
import { runConcierge } from "@/lib/conciergeCore";

// On-site SmartSearch concierge. The reusable tool loop lives in
// `src/lib/conciergeCore.ts` and is shared with the WhatsApp webhook so
// both surfaces use the same brain.

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

  const result = await runConcierge({
    messages: parsed.data.messages,
    // The on-site UI mounts product cards from `products[]` and routes
    // taps via Next's Link — a relative path is what the renderer wants.
    productHref: (id) => `/products/${id}`,
  });

  return NextResponse.json({ reply: result.reply, products: result.products });
}
