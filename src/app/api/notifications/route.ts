import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

// GET /api/notifications -- list the calling user's notifications, newest
// first. Capped at 50 to keep the bell-icon dropdown fast. Returns the
// unread count as well so the badge stays accurate after a refresh.
export async function GET() {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const userId = guard.session.sub;
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return NextResponse.json({
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  });
}

const PatchBody = z.object({
  // "id" marks a single row read; "all" marks every unread row read.
  id: z.string().optional(),
  all: z.boolean().optional(),
});

// PATCH /api/notifications { id? all? } -- mark one or all read.
export async function PATCH(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const userId = guard.session.sub;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const now = new Date();
  if (parsed.data.all) {
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: now },
    });
    return NextResponse.json({ ok: true });
  }
  if (parsed.data.id) {
    await prisma.notification.updateMany({
      where: { id: parsed.data.id, userId },
      data: { readAt: now },
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Provide id or all" }, { status: 400 });
}