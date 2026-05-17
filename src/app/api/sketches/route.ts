import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { resolveActingOwner } from "@/lib/managersServer";

// GET /api/sketches — current user's sketches.
export async function GET() {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const sketches = await prisma.sketch.findMany({
    where: { authorId: guard.session.sub },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ sketches });
}

const Body = z.object({
  title: z.string().min(1).max(120),
  imageData: z.string().min(20), // data:image/png;base64,...
  garment: z.string().max(40).optional(),
  productId: z.string().optional(),
  postId: z.string().optional(),
  // Managers with `use_sketch_studio` can save under the owner's studio.
  actAsOwnerId: z.string().optional(),
});

export async function POST(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const ownerId = await resolveActingOwner(
    guard.session.sub,
    parsed.data.actAsOwnerId,
    "use_sketch_studio",
  );
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sketch = await prisma.sketch.create({
    data: {
      authorId: ownerId,
      title: parsed.data.title,
      garment: parsed.data.garment ?? "other",
      imageData: parsed.data.imageData,
      productId: parsed.data.productId,
      postId: parsed.data.postId,
    },
  });
  return NextResponse.json({ sketch });
}
