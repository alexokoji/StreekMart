import { NextResponse } from "next/server";
import { z } from "zod";
import { Permission } from "@/lib/enums";
import { requireApiUser } from "@/lib/auth";
import { buildFashionValidatorSystem, chat, isAiEnabled } from "@/lib/ai";
import { isValidCategory } from "@/lib/categories";

// AI fashion-only listing validator. Called by the product create/edit form
// and by the server-side product API to enforce that StreekMart never lists
// non-fashion items (no phones, TVs, cars, gadgets, etc.).

const Body = z.object({
  name: z.string().min(2).max(120),
  description: z.string().min(2).max(2000),
  category: z.string().min(1),
});

const Verdict = z.object({
  allowed: z.boolean(),
  reason: z.string().min(2).max(280),
  suggested_category: z.string().nullable(),
});

export async function POST(req: Request) {
  // Both seller and designer permissions can create listings.
  const guard = await requireApiUser([Permission.SELLER, Permission.DESIGNER]);
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // 1. Hard category check — anything outside the live admin-managed
  // allowlist is auto-rejected.
  const { name, description, category } = parsed.data;
  if (!(await isValidCategory(category))) {
    return NextResponse.json({
      allowed: false,
      reason: `"${category}" is not a fashion category on StreekMart.`,
      suggested_category: null,
    });
  }

  // 2. If AI is disabled, treat the category check as authoritative.
  if (!isAiEnabled()) {
    return NextResponse.json({ allowed: true, reason: "Approved by category check.", suggested_category: category });
  }

  // 3. Ask the model for the semantic check.
  const userPrompt = `Name: ${name}\nCategory: ${category}\nDescription: ${description}`;
  const { text } = await chat({
    system: await buildFashionValidatorSystem(),
    maxTokens: 400,
    messages: [{ role: "user", content: userPrompt }],
    responseJsonSchema: {
      type: "object",
      properties: {
        allowed: { type: "boolean" },
        reason: { type: "string" },
        suggested_category: { type: ["string", "null"] },
      },
      required: ["allowed", "reason", "suggested_category"],
    },
  });

  try {
    const verdict = Verdict.parse(JSON.parse(text));
    return NextResponse.json(verdict);
  } catch {
    // Be safe: if the model output can't be parsed, do not block the listing —
    // the category allowlist already caught the gross cases.
    return NextResponse.json({
      allowed: true,
      reason: "Validator returned an unreadable response; allowing based on category match.",
      suggested_category: category,
    });
  }
}
