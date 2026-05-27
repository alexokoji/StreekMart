import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

const PatchBody = z.object({
  label: z.string().max(60).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  formattedAddress: z.string().min(3).max(500).optional(),
  placeId: z.string().max(255).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  region: z.string().max(120).nullable().optional(),
  country: z.string().max(60).nullable().optional(),
  isDefault: z.boolean().optional(),
});

async function ownedAddressOr404(id: string, userId: string) {
  const address = await prisma.address.findUnique({ where: { id } });
  if (!address || address.userId !== userId) return null;
  return address;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const existing = await ownedAddressOr404(params.id, guard.session.sub);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { isDefault, ...rest } = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    if (isDefault === true) {
      await tx.address.updateMany({
        where: {
          userId: guard.session.sub,
          kind: existing.kind,
          isDefault: true,
          NOT: { id: existing.id },
        },
        data: { isDefault: false },
      });
    }
    return tx.address.update({
      where: { id: existing.id },
      data: { ...rest, ...(isDefault === undefined ? {} : { isDefault }) },
    });
  });

  return NextResponse.json({ ok: true, address: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const existing = await ownedAddressOr404(params.id, guard.session.sub);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.address.delete({ where: { id: existing.id } });
    if (existing.isDefault) {
      // Promote the most recently updated remaining address of the same kind to default.
      const next = await tx.address.findFirst({
        where: { userId: guard.session.sub, kind: existing.kind },
        orderBy: { updatedAt: "desc" },
      });
      if (next) {
        await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
