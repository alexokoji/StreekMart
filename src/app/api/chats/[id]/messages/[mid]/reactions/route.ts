import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

// POST /api/chats/[id]/messages/[mid]/reactions { emoji }
//
// Toggle a reaction. If the (message, user, emoji) row exists it's
// deleted; otherwise it's created. WhatsApp-style — a single user can
// stack multiple distinct emojis on the same message, but never two of
// the same emoji.
//
// The message row gets its updatedAt bumped so polling clients pick up
// the change in the next /messages?updatedAfter= window.

const Body = z.object({
  // Curated allowlist mirrors the picker in the UI. Free-form input could
  // accept anything emoji-shaped but the small fixed set keeps audit
  // trails tidy and avoids weird unicode in the polling payload.
  emoji: z.enum(["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥"]),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string; mid: string } },
) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Participation check via the parent chat — guard against reacting on
  // a message that's not in a chat the user is part of.
  const message = await prisma.message.findFirst({
    where: {
      id: params.mid,
      chatId: params.id,
      chat: { participants: { some: { userId: guard.session.sub } } },
    },
    select: { id: true },
  });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = guard.session.sub;
  const emoji = parsed.data.emoji;

  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId: message.id, userId, emoji } },
  });

  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.messageReaction.create({
      data: { messageId: message.id, userId, emoji },
    });
  }

  // Touch the message so polling pollers see the change via updatedAt.
  await prisma.message.update({
    where: { id: message.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true, removed: !!existing });
}
