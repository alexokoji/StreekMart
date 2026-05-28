import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

// PATCH /api/chats/[id]/messages/[mid] { body }
//
// Sender-only edit. Body must be non-empty. Window: 15 minutes from
// createdAt — after that the row is frozen so the conversation history
// stays trustworthy.
//
// DELETE /api/chats/[id]/messages/[mid]
//
// Soft delete. Sets `deletedAt`, blanks body + attachment in subsequent
// responses (we filter at the client). Reactions and replies stay.

const EDIT_WINDOW_MS = 15 * 60 * 1000;

const PatchBody = z.object({
  body: z.string().min(1).max(4000),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; mid: string } },
) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const message = await prisma.message.findFirst({
    where: { id: params.mid, chatId: params.id },
    select: { id: true, senderId: true, createdAt: true, deletedAt: true },
  });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (message.senderId !== guard.session.sub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (message.deletedAt) {
    return NextResponse.json({ error: "Can't edit a deleted message." }, { status: 400 });
  }
  if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
    return NextResponse.json(
      { error: "Edit window has closed. Messages can be edited for 15 minutes after sending." },
      { status: 400 },
    );
  }

  const updated = await prisma.message.update({
    where: { id: message.id },
    data: { body: parsed.data.body, editedAt: new Date() },
    select: { id: true, body: true, editedAt: true, updatedAt: true },
  });
  return NextResponse.json({ message: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; mid: string } },
) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const message = await prisma.message.findFirst({
    where: { id: params.mid, chatId: params.id },
    select: { id: true, senderId: true, deletedAt: true },
  });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (message.senderId !== guard.session.sub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (message.deletedAt) {
    return NextResponse.json({ ok: true, alreadyDeleted: true });
  }

  await prisma.message.update({
    where: { id: message.id },
    data: {
      deletedAt: new Date(),
      // Blank the payload so subsequent fetches don't carry the original
      // text or attachment. The row stays so replies/reactions keep their
      // context.
      body: "",
      attachmentUrl: null,
      attachmentMime: null,
    },
  });
  return NextResponse.json({ ok: true });
}
