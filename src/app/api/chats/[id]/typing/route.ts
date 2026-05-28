import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

// POST /api/chats/[id]/typing
//
// Typing heartbeat. Client calls this every ~2s while the input has
// focus and content. The peer's poll considers any lastTypingAt within
// the last 5 seconds as "currently typing" — no explicit stop signal
// needed; the value naturally expires.
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
    data: { lastTypingAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
