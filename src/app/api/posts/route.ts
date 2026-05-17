import { NextResponse } from "next/server";
import { z } from "zod";
import { Permission } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { resolveActingOwner } from "@/lib/managersServer";

// GET /api/posts?mine=1
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mine = url.searchParams.get("mine");
  const q = url.searchParams.get("q");

  if (mine) {
    const guard = await requireApiUser(Permission.DESIGNER);
    if ("error" in guard) return guard.error;
    const posts = await prisma.post.findMany({
      where: { authorId: guard.session.sub },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ posts });
  }

  const posts = await prisma.post.findMany({
    where: q ? { OR: [{ title: { contains: q } }, { body: { contains: q } }] } : undefined,
    include: { author: { select: { id: true, name: true, exposureScore: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ posts });
}

const Body = z.object({
  title: z.string().min(2),
  body: z.string().min(1),
  images: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  // Managers with the `post` permission can publish under the owner's name.
  actAsOwnerId: z.string().optional(),
});

export async function POST(req: Request) {
  // Managers don't need to themselves be designers — owners do. So we
  // require *any* signed-in user here and let resolveActingOwner enforce
  // the relationship.
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const ownerId = await resolveActingOwner(guard.session.sub, parsed.data.actAsOwnerId, "post");
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Whether acting for self or someone else, the OWNER must be a designer.
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { isDesigner: true },
  });
  if (!owner?.isDesigner) {
    return NextResponse.json({ error: "Owner is not a designer" }, { status: 403 });
  }

  const post = await prisma.post.create({
    data: {
      authorId: ownerId,
      title: parsed.data.title,
      body: parsed.data.body,
      imagesJson: JSON.stringify(parsed.data.images),
      tagsJson: JSON.stringify(parsed.data.tags),
    },
  });
  return NextResponse.json({ post });
}
