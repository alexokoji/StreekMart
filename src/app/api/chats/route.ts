import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

// GET /api/chats — list current user's chats with last message + counterpart.
export async function GET() {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const userId = guard.session.sub;

  const chats = await prisma.chat.findMany({
    where: { participants: { some: { userId } } },
    include: {
      participants: { include: { user: { select: { id: true, name: true, isSeller: true, isDesigner: true, avatarUrl: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  const shaped = chats.map((c) => {
    const other = c.participants.find((p) => p.userId !== userId)?.user ?? null;
    return {
      id: c.id,
      updatedAt: c.updatedAt,
      counterpart: other,
      lastMessage: c.messages[0] ?? null,
    };
  });

  return NextResponse.json({ chats: shaped });
}

// POST /api/chats { withUserId } — get-or-create a 1:1 chat.
const CreateBody = z.object({ withUserId: z.string() });
export async function POST(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const userId = guard.session.sub;

  const body = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { withUserId } = parsed.data;
  if (withUserId === userId) return NextResponse.json({ error: "Cannot chat with self" }, { status: 400 });

  const other = await prisma.user.findUnique({ where: { id: withUserId } });
  if (!other) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Find an existing 1:1 chat between the two users.
  const existing = await prisma.chat.findFirst({
    where: {
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: withUserId } } },
      ],
    },
  });
  if (existing) return NextResponse.json({ chat: existing });

  const chat = await prisma.chat.create({
    data: {
      participants: { create: [{ userId }, { userId: withUserId }] },
    },
  });
  return NextResponse.json({ chat });
}
