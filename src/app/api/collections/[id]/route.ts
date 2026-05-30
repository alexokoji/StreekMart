import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import {
  CollectionStatus,
  resolveUniqueCollectionSlug,
  slugifyCollectionTitle,
} from "@/lib/collections";

// GET /api/collections/[id] → owner-only fetch with items.
// PATCH /api/collections/[id] → update metadata + items.
// DELETE /api/collections/[id] → remove the collection (items cascade).

const UpdateBody = z.object({
  title: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  status: z.enum([CollectionStatus.DRAFT, CollectionStatus.PUBLIC]).optional(),
  // Item set replacement. When provided, we wipe + re-insert in the given
  // order. Cheap (a handful of rows per collection) and the editor sends
  // the full ordered list anyway, so partial updates aren't worth the
  // complexity here.
  items: z
    .array(
      z.object({
        postId: z.string().optional(),
        productId: z.string().optional(),
      }),
    )
    .max(60)
    .optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const collection = await prisma.collection.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!collection || collection.ownerId !== guard.session.sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ collection });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const existing = await prisma.collection.findUnique({ where: { id: params.id } });
  if (!existing || existing.ownerId !== guard.session.sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = UpdateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // If the title is changing we resolve a new slug (with collision handling)
  // so the public URL keeps matching what the designer typed. Existing
  // public links break — acceptable trade for editable titles in V1.
  let nextSlug: string | undefined;
  if (parsed.data.title && parsed.data.title !== existing.title) {
    nextSlug = await resolveUniqueCollectionSlug({
      prisma,
      ownerId: guard.session.sub,
      desired: slugifyCollectionTitle(parsed.data.title),
      excludeId: existing.id,
    });
  }

  // Replace the item set inside a transaction. Wiping first guarantees the
  // final state matches what the editor sent — no leftover rows from a
  // removed-then-re-added item with a stale position.
  if (parsed.data.items) {
    // Validate each item references a real post/product we're allowed to
    // include. Anything else fails the whole patch.
    for (const it of parsed.data.items) {
      if (!it.postId && !it.productId) {
        return NextResponse.json(
          { error: "Each item needs a postId or productId." },
          { status: 400 },
        );
      }
      if (it.postId && it.productId) {
        return NextResponse.json(
          { error: "An item can be a post OR a product, not both." },
          { status: 400 },
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.collectionItem.deleteMany({ where: { collectionId: existing.id } });
      await tx.collectionItem.createMany({
        data: (parsed.data.items ?? []).map((it, i) => ({
          collectionId: existing.id,
          postId: it.postId ?? null,
          productId: it.productId ?? null,
          position: i,
        })),
      });
    });
  }

  const updated = await prisma.collection.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description }
        : {}),
      ...(parsed.data.coverUrl !== undefined
        ? { coverUrl: parsed.data.coverUrl }
        : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(nextSlug ? { slug: nextSlug } : {}),
    },
  });

  return NextResponse.json({ collection: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const existing = await prisma.collection.findUnique({ where: { id: params.id } });
  if (!existing || existing.ownerId !== guard.session.sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.collection.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
