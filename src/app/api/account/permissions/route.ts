import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession, setSessionCookie } from "@/lib/auth";

// PATCH /api/account/permissions { isSeller?, isDesigner? }
// Buyer is implicit and cannot be toggled off.
const Body = z.object({
  isSeller: z.boolean().optional(),
  isDesigner: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const data: { isSeller?: boolean; isDesigner?: boolean } = {};
  if (parsed.data.isSeller !== undefined) data.isSeller = parsed.data.isSeller;
  if (parsed.data.isDesigner !== undefined) data.isDesigner = parsed.data.isDesigner;

  const updated = await prisma.user.update({
    where: { id: session.sub },
    data,
    select: { id: true, email: true, name: true, isSeller: true, isDesigner: true },
  });

  // Re-issue the session cookie with the new permission flags so the next
  // request sees them without needing a fresh login.
  await setSessionCookie({
    sub: updated.id,
    email: updated.email,
    name: updated.name,
    isSeller: updated.isSeller,
    isDesigner: updated.isDesigner,
  });

  return NextResponse.json({ user: updated });
}
