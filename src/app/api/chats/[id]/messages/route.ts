import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { sendPush } from "@/lib/notifications";

async function assertParticipant(chatId: string, userId: string) {
  const member = await prisma.chatParticipant.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  return !!member;
}

// Shared shape — reactions roll up to a `{ emoji, count, mine }` summary
// so the client doesn't have to dedupe per render.
const messageInclude = {
  sender: { select: { id: true, name: true, isSeller: true, isDesigner: true } },
  reactions: { select: { id: true, emoji: true, userId: true } },
  replyTo: {
    select: {
      id: true,
      body: true,
      senderId: true,
      deletedAt: true,
      attachmentUrl: true,
      attachmentMime: true,
      sender: { select: { id: true, name: true } },
    },
  },
} as const;

// GET /api/chats/[id]/messages?after=<iso>&updatedAfter=<iso>
//
// Two-cursor poll. `after` returns brand-new messages since the cursor;
// `updatedAfter` returns existing messages whose body / reactions / read
// state has changed (edits, deletes, reactions). The client merges by id.
// Also returns the peer's typing flag + the peer's lastReadAt cursor so
// the sender can paint ✓✓ read receipts.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const ok = await assertParticipant(params.id, guard.session.sub);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const after = url.searchParams.get("after");
  const updatedAfter = url.searchParams.get("updatedAfter");

  const TYPING_WINDOW_MS = 5_000;

  const [newMessages, updatedMessages, peers] = await Promise.all([
    prisma.message.findMany({
      where: {
        chatId: params.id,
        ...(after ? { createdAt: { gt: new Date(after) } } : {}),
      },
      orderBy: { createdAt: "asc" },
      include: messageInclude,
      take: 200,
    }),
    updatedAfter
      ? prisma.message.findMany({
          where: {
            chatId: params.id,
            updatedAt: { gt: new Date(updatedAfter) },
            // Exclude rows already returned via `newMessages` — those carry
            // the same updatedAt as createdAt for freshly-inserted rows.
            ...(after ? { createdAt: { lte: new Date(after) } } : {}),
          },
          orderBy: { updatedAt: "asc" },
          include: messageInclude,
          take: 200,
        })
      : Promise.resolve([]),
    prisma.chatParticipant.findMany({
      where: { chatId: params.id, NOT: { userId: guard.session.sub } },
      select: {
        userId: true,
        lastReadAt: true,
        lastTypingAt: true,
        user: { select: { lastSeenAt: true } },
      },
    }),
  ]);

  const now = Date.now();
  // Peer is "online" when they pinged the API within the last 90s. Tight
  // enough that a closed-tab user goes offline within a minute or so;
  // loose enough that a brief network blip doesn't flap them.
  const PRESENCE_WINDOW_MS = 90_000;
  const peerTyping = peers
    .filter((p) => p.lastTypingAt && now - p.lastTypingAt.getTime() < TYPING_WINDOW_MS)
    .map((p) => p.userId);
  const peerReads = peers.map((p) => ({
    userId: p.userId,
    lastReadAt: p.lastReadAt?.toISOString() ?? null,
  }));
  const peerOnline = peers
    .filter((p) => p.user.lastSeenAt && now - p.user.lastSeenAt.getTime() < PRESENCE_WINDOW_MS)
    .map((p) => p.userId);

  return NextResponse.json({
    messages: newMessages,
    updates: updatedMessages,
    peerTyping,
    peerReads,
    peerOnline,
    serverNow: new Date().toISOString(),
  });
}

const PostBody = z.object({
  body: z.string().max(4000),
  clientMessageId: z.string().min(1).max(128).optional(),
  replyToId: z.string().min(1).max(64).optional(),
  attachmentUrl: z.string().url().optional(),
  attachmentMime: z.string().min(1).max(120).optional(),
  attachmentName: z.string().min(1).max(255).optional(),
  attachmentSize: z.number().int().nonnegative().max(50 * 1024 * 1024).optional(),
});

// POST /api/chats/[id]/messages
//
// Sends a new message. Required: at least one of `body` or `attachmentUrl`.
// Optional: `replyToId` for quoted replies, idempotency `clientMessageId`.
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
  const {
    body: text,
    clientMessageId,
    replyToId,
    attachmentUrl,
    attachmentMime,
    attachmentName,
    attachmentSize,
  } = parsed.data;

  if (!text.trim() && !attachmentUrl) {
    return NextResponse.json(
      { error: "Message must include text or an attachment." },
      { status: 400 },
    );
  }

  // Validate the replyToId exists in this chat — stops cross-chat leakage.
  if (replyToId) {
    const parent = await prisma.message.findFirst({
      where: { id: replyToId, chatId },
      select: { id: true },
    });
    if (!parent) {
      return NextResponse.json({ error: "Reply target not found in this chat." }, { status: 400 });
    }
  }

  // Idempotency fast-path.
  if (clientMessageId) {
    const existing = await prisma.message.findFirst({
      where: { chatId, senderId, clientMessageId },
      include: messageInclude,
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
        replyToId: replyToId ?? null,
        attachmentUrl: attachmentUrl ?? null,
        attachmentMime: attachmentMime ?? null,
        attachmentName: attachmentName ?? null,
        attachmentSize: attachmentSize ?? null,
      },
      include: messageInclude,
    });
  } catch (err) {
    if (
      clientMessageId &&
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const winner = await prisma.message.findFirst({
        where: { chatId, senderId, clientMessageId },
        include: messageInclude,
      });
      if (winner) {
        return NextResponse.json({ message: winner, duplicate: true });
      }
    }
    throw err;
  }

  // Bump chat updatedAt + clear sender's typing flag.
  await Promise.all([
    prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    }),
    prisma.chatParticipant.update({
      where: { chatId_userId: { chatId, userId: senderId } },
      data: { lastTypingAt: null },
    }),
  ]);

  // Push every other participant in the chat. Fire-and-forget — message
  // already saved, so a push failure can't make the send appear to fail.
  // We skip the sender (obvious) and rely on Expo's foreground handler in
  // the mobile shell to suppress the banner if the user is already on the
  // chat screen.
  void (async () => {
    try {
      const others = await prisma.chatParticipant.findMany({
        where: { chatId, userId: { not: senderId } },
        select: { userId: true },
      });
      // Show the message text in the body if there is one; otherwise hint
      // at the attachment kind so the recipient sees something useful
      // instead of an empty notification.
      const senderName = message.sender?.name ?? "Someone";
      const preview = text.trim()
        ? text.length > 120
          ? text.slice(0, 117) + "…"
          : text
        : attachmentMime?.startsWith("image/")
          ? "📷 Photo"
          : attachmentMime?.startsWith("audio/")
            ? "🎤 Voice note"
            : attachmentMime
              ? "📎 Attachment"
              : "New message";
      await Promise.all(
        others.map((p) =>
          sendPush({
            userId: p.userId,
            title: senderName,
            body: preview,
            link: `/messages/${chatId}`,
            data: { type: "new-message", chatId },
          }).catch((err) => console.error("[push:new-message] threw", { chatId, err })),
        ),
      );
    } catch (err) {
      console.error("[push:new-message] outer threw", { chatId, err });
    }
  })();

  return NextResponse.json({ message });
}
