import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { hasManagerPermission } from "@/lib/managersServer";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          businessName: true,
          bio: true,
          avatarUrl: true,
          coverImageUrl: true,
          isSeller: true,
          isDesigner: true,
          sellerVerified: true,
          designerVerified: true,
          slug: true,
        },
      },
      _count: { select: { comments: true } },
    },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  prisma.post.update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  const { _count, ...rest } = post;
  return NextResponse.json({ post: { ...rest, commentCount: _count.comments } });
}

const UpdateBody = z.object({
  title: z.string().min(2).optional(),
  body: z.string().min(1).optional(),
  images: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  // Preorder config — same rules as on create. `null` clears the field;
  // omitted leaves it untouched.
  preorderEnabled: z.boolean().optional(),
  preorderPriceCents: z.number().int().min(50_000).max(1_000_000_000).nullable().optional(),
  preorderLeadDays: z.number().int().min(1).max(120).nullable().optional(),
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

  const {
    images,
    tags,
    preorderEnabled,
    preorderPriceCents,
    preorderLeadDays,
    ...rest
  } = parsed.data;

  // Resolve the effective preorder state. The form sends `enabled: true`
  // alongside both numerics, or `enabled: false` to clear. We never enable
  // without both numerics — silently treat as disabled if either is missing.
  const preorderActive =
    preorderEnabled === true &&
    typeof preorderPriceCents === "number" &&
    typeof preorderLeadDays === "number";

  const updated = await prisma.post.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(images ? { imagesJson: JSON.stringify(images) } : {}),
      ...(tags ? { tagsJson: JSON.stringify(tags) } : {}),
      ...(preorderEnabled !== undefined
        ? {
            preorderEnabled: preorderActive,
            preorderPriceCents: preorderActive ? preorderPriceCents : null,
            preorderLeadDays: preorderActive ? preorderLeadDays : null,
          }
        : {}),
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
