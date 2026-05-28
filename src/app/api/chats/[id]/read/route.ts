import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

// POST /api/chats/[id]/read
//
// Updates the caller's `lastReadAt` to now. The peer's poll sees the new
// cursor and paints ✓✓ (blue) on every message it sent with
// createdAt <= lastReadAt. Cheaper than a per-message read receipt — one
// row write per chat-open, not per message.
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const member = await prisma.chatParticipant.findUnique({
    where: { chatId_userId: { chatId: params.id, userId: guard.session.sub } },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.chatParticipant.update({
    where: { id: member.id },
    data: { lastReadAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
