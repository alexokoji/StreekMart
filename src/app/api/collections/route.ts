import { NextResponse } from "next/server";
import { z } from "zod";
import { Permission } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import {
  CollectionStatus,
  resolveUniqueCollectionSlug,
  slugifyCollectionTitle,
} from "@/lib/collections";

// GET /api/collections?mine=1 → list the actor's collections
// POST /api/collections → create a new collection
//
// Designer-only feature. We use Permission.DESIGNER on POST so only verified
// designers (or those with the role flag) can curate look-books. GET is
// open to any signed-in user since collections are public surfaces and the
// "mine" filter just constrains to the actor's own rows.

const CreateBody = z.object({
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  coverUrl: z.string().url().optional().nullable(),
  status: z.enum([CollectionStatus.DRAFT, CollectionStatus.PUBLIC]).optional(),
});

export async function GET(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const mine = new URL(req.url).searchParams.get("mine") === "1";

  const collections = await prisma.collection.findMany({
    where: mine ? { ownerId: guard.session.sub } : undefined,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      coverUrl: true,
      status: true,
      updatedAt: true,
      _count: { select: { items: true } },
    },
  });
  return NextResponse.json({ collections });
}

export async function POST(req: Request) {
  const guard = await requireApiUser(Permission.DESIGNER);
  if ("error" in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const slug = await resolveUniqueCollectionSlug({
    prisma,
    ownerId: guard.session.sub,
    desired: slugifyCollectionTitle(parsed.data.title),
  });

  const collection = await prisma.collection.create({
    data: {
      ownerId: guard.session.sub,
      title: parsed.data.title,
      description: parsed.data.description,
      coverUrl: parsed.data.coverUrl ?? null,
      status: parsed.data.status ?? CollectionStatus.DRAFT,
      slug,
    },
  });
  return NextResponse.json({ collection });
}
