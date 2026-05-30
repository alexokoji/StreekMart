import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { sendPush } from "@/lib/notifications";

// GET /api/posts/[id]/comments → list comments oldest-first.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const comments = await prisma.comment.findMany({
    where: { postId: params.id },
    include: { author: { select: { id: true, name: true, isDesigner: true, designerVerified: true, designerTier: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return NextResponse.json({ comments });
}

const Body = z.object({ body: z.string().min(1).max(1000) });

// POST /api/posts/[id]/comments → any logged-in user can comment.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const comment = await prisma.comment.create({
    data: { postId: post.id, authorId: guard.session.sub, body: parsed.data.body },
    include: { author: { select: { id: true, name: true, isDesigner: true, designerVerified: true, designerTier: true } } },
  });

  // Notify the post's author — but only if they're not the commenter
  // (self-comments don't deserve a push).
  if (post.authorId !== guard.session.sub) {
    const preview =
      parsed.data.body.length > 80
        ? parsed.data.body.slice(0, 77) + "…"
        : parsed.data.body;
    void sendPush({
      userId: post.authorId,
      title: `${comment.author.name} commented`,
      body: preview,
      link: `/posts/${post.id}`,
      data: { type: "post-comment", postId: post.id, commentId: comment.id },
    }).catch((err) =>
      console.error("[push:post-comment] threw", { postId: post.id, err }),
    );
  }

  return NextResponse.json({ comment });
}
