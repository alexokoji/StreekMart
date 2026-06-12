import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

const PatchBody = z.object({ isDefault: z.boolean() });

// PATCH /api/payment-methods/[id] { isDefault: true } -- promote this
// card to default. Demotes any other default in a single transaction so
// at most one row has isDefault=true.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  if (!parsed.data.isDefault) return NextResponse.json({ ok: true });
  const userId = guard.session.sub;
  const own = await prisma.savedPaymentMethod.findFirst({
    where: { id: params.id, userId },
  });
  if (!own) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.$transaction([
    prisma.savedPaymentMethod.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.savedPaymentMethod.update({
      where: { id: params.id },
      data: { isDefault: true },
    }),
  ]);
  return NextResponse.json({ ok: true });
}

// DELETE /api/payment-methods/[id] -- forget the saved card.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const userId = guard.session.sub;
  const result = await prisma.savedPaymentMethod.deleteMany({
    where: { id: params.id, userId },
  });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}