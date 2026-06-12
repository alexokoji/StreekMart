import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { sendPush } from "@/lib/notifications";

// POST /api/follows { designerId } — toggle follow.
const Body = z.object({ designerId: z.string() });

export async function POST(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  if (parsed.data.designerId === guard.session.sub) {
    return NextResponse.json({ error: "Can't follow yourself." }, { status: 400 });
  }

  const designer = await prisma.user.findUnique({ where: { id: parsed.data.designerId } });
  if (!designer || (!designer.isDesigner && !designer.isSeller)) {
    return NextResponse.json({ error: "Cannot follow this account." }, { status: 404 });
  }

  const existing = await prisma.follow.findUnique({
    where: {
      followerId_designerId: {
        followerId: guard.session.sub,
        designerId: parsed.data.designerId,
      },
    },
  });

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
    return NextResponse.json({ following: false });
  }

  await prisma.follow.create({
    data: { followerId: guard.session.sub, designerId: parsed.data.designerId },
  });

  // Notify the designer. Push only — followers happen often enough that
  // an email per event would feel spammy; the designer dashboard's
  // engagement stats panel rolls follower totals up weekly already.
  const follower = await prisma.user.findUnique({
    where: { id: guard.session.sub },
    select: { name: true, slug: true },
  });
  void sendPush({
    userId: parsed.data.designerId,
    title: "New follower",
    body: `${follower?.name ?? "Someone"} started following you`,
    link: `/u/${follower?.slug ?? guard.session.sub}`,
    data: { type: "new-follower", followerId: guard.session.sub },
  }).catch((err) =>
    console.error("[push:new-follower] threw", {
      designerId: parsed.data.designerId,
      err,
    }),
  );

  return NextResponse.json({ following: true });
}
