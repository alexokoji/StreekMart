import { NextResponse } from "next/server";
import { z } from "zod";
import { Permission } from "@/lib/enums";
import { requireApiUser } from "@/lib/auth";
import { POST_DRAFTER_SYSTEM, chat, isAiEnabled } from "@/lib/ai";

const Body = z.object({
  notes: z.string().min(5).max(800),
});

const PostDraft = z.object({
  title: z.string().min(2).max(80),
  body: z.string().min(20),
  tags: z.array(z.string()).max(8),
});

export async function POST(req: Request) {
  if (!isAiEnabled()) {
    return NextResponse.json(
      { error: "AI features are disabled. Set GEMINI_API_KEY in .env." },
      { status: 503 },
    );
  }

  const guard = await requireApiUser(Permission.DESIGNER);
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { text } = await chat({
    system: POST_DRAFTER_SYSTEM,
    maxTokens: 1200,
    messages: [{ role: "user", content: parsed.data.notes }],
    responseJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        body: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["title", "body", "tags"],
    },
  });

  try {
    const draft = PostDraft.parse(JSON.parse(text));
    return NextResponse.json({ draft });
  } catch {
    return NextResponse.json(
      { error: "Couldn't draft a post from those notes. Try giving more detail." },
      { status: 422 },
    );
  }
}
