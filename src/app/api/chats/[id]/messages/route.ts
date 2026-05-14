import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

async function assertParticipant(chatId: string, userId: string) {
  const member = await prisma.chatParticipant.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  return !!member;
}

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
    include: { sender: { select: { id: true, name: true, isSeller: true, isDesigner: true } } },
    take: 200,
  });
  return NextResponse.json({ messages });
}

const PostBody = z.object({ body: z.string().min(1).max(4000) });

// POST /api/chats/[id]/messages — send a message in this chat.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const ok = await assertParticipant(params.id, guard.session.sub);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = PostBody.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const message = await prisma.message.create({
    data: {
      chatId: params.id,
      senderId: guard.session.sub,
      body: parsed.data.body,
    },
    include: { sender: { select: { id: true, name: true, isSeller: true, isDesigner: true } } },
  });

  // Bump chat updatedAt so listings re-sort.
  await prisma.chat.update({
    where: { id: params.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ message });
}
