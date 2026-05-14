import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";

// PATCH /api/admin/users/[id]/verify { kind, value }
//
// Lets an admin flip a verification badge on or off directly without a
// pending request — the "trust them, they're real" path the spec asks for.

const Body = z.object({
  kind: z.enum(["SELLER", "DESIGNER"]),
  value: z.boolean(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin();
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.kind === "SELLER" && !target.isSeller) {
    return NextResponse.json({ error: "User isn't a seller." }, { status: 400 });
  }
  if (parsed.data.kind === "DESIGNER" && !target.isDesigner) {
    return NextResponse.json({ error: "User isn't a designer." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      ...(parsed.data.kind === "SELLER" ? { sellerVerified: parsed.data.value } : {}),
      ...(parsed.data.kind === "DESIGNER" ? { designerVerified: parsed.data.value } : {}),
      verifiedAt: parsed.data.value ? new Date() : null,
      verifiedBy: parsed.data.value ? guard.user.id : null,
    },
    select: { id: true, sellerVerified: true, designerVerified: true },
  });
  return NextResponse.json({ user: updated });
}
