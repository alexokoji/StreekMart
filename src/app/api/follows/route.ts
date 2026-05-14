import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

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
  if (!designer || !designer.isDesigner) {
    return NextResponse.json({ error: "Not a designer." }, { status: 404 });
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
  return NextResponse.json({ following: true });
}
