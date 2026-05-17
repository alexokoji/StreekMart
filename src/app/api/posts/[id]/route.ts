import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { hasManagerPermission } from "@/lib/managersServer";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: { author: { select: { id: true, name: true, bio: true, avatarUrl: true } } },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  prisma.post.update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  return NextResponse.json({ post });
}

const UpdateBody = z.object({
  title: z.string().min(2).optional(),
  body: z.string().min(1).optional(),
  images: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ok = await hasManagerPermission(guard.session.sub, post.authorId, "edit_post");
  if (!ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = UpdateBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { images, tags, ...rest } = parsed.data;
  const updated = await prisma.post.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(images ? { imagesJson: JSON.stringify(images) } : {}),
      ...(tags ? { tagsJson: JSON.stringify(tags) } : {}),
    },
  });
  return NextResponse.json({ post: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ok = await hasManagerPermission(guard.session.sub, post.authorId, "edit_post");
  if (!ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.post.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
