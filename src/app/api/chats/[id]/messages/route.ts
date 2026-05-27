import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

async function assertParticipant(chatId: string, userId: string) {
  const member = await prisma.chatParticipant.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  return !!member;
}

const senderSelect = {
  sender: { select: { id: true, name: true, isSeller: true, isDesigner: true } },
} as const;

// GET /api/chats/[id]/messages?after=<iso> — used for polling (near-real-time chat).
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const ok = await assertParticipant(params.id, guard.session.sub);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const after = url.searchParams.get("after");
  const messages = await prisma.message.findMany({
    where: {
      chatId: params.id,
      ...(after ? { createdAt: { gt: new Date(after) } } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: senderSelect,
    take: 200,
  });
  return NextResponse.json({ messages });
}

const PostBody = z.object({
  body: z.string().min(1).max(4000),
  // Client-generated identifier (typically a UUID) used to make POSTs
  // idempotent. Optional so direct API callers without retry semantics
  // still work; when provided, repeated submissions return the original
  // message instead of inserting a duplicate.
  clientMessageId: z.string().min(1).max(128).optional(),
});

// POST /api/chats/[id]/messages — send a message in this chat.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const ok = await assertParticipant(params.id, guard.session.sub);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = PostBody.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const chatId = params.id;
  const senderId = guard.session.sub;
  const { body: text, clientMessageId } = parsed.data;

  // Idempotency fast-path: if we've already accepted this clientMessageId
  // for this sender + chat, hand back the original row. Lets a retrying
  // client collapse double-sends without creating duplicate messages.
  if (clientMessageId) {
    const existing = await prisma.message.findFirst({
      where: { chatId, senderId, clientMessageId },
      include: senderSelect,
    });
    if (existing) {
      return NextResponse.json({ message: existing, duplicate: true });
    }
  }

  let message;
  try {
    message = await prisma.message.create({
      data: {
        chatId,
        senderId,
        body: text,
        clientMessageId: clientMessageId ?? null,
      },
      include: senderSelect,
    });
  } catch (err) {
    // Race condition: a parallel POST with the same clientMessageId won the
    // insert between our findFirst and create. Re-fetch and return that row.
    if (
      clientMessageId &&
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const winner = await prisma.message.findFirst({
        where: { chatId, senderId, clientMessageId },
        include: senderSelect,
      });
      if (winner) {
        return NextResponse.json({ message: winner, duplicate: true });
      }
    }
    throw err;
  }

  // Bump chat updatedAt so listings re-sort.
  await prisma.chat.update({
    where: { id: chatId },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ message });
}
