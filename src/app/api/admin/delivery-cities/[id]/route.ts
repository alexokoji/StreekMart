import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";

const PatchBody = z.object({
  feeCents: z.number().int().min(0).max(1_000_000).optional(),
  active: z.boolean().optional(),
  region: z.string().max(80).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_DELIVERY);
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const updated = await prisma.deliveryCity.update({
    where: { id: params.id },
    data: parsed.data,
  });
  return NextResponse.json({ city: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_DELIVERY);
  if ("error" in guard) return guard.error;
  await prisma.deliveryCity.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
