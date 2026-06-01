import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { notifyAdmins } from "@/lib/adminNotifications";

// POST /api/account/role-change { toIsSeller, toIsDesigner, reason? }
//
// User requests a change to their role flags. Admin reviews from
// /admin/role-changes; approval flips the booleans on the User row and
// emails / pushes the requester.
//
// We block stacking pending requests for the same user — one in-flight
// at a time keeps the admin queue clean.

const Body = z.object({
  toIsSeller: z.boolean(),
  toIsDesigner: z.boolean(),
  reason: z.string().trim().max(1000).optional(),
});

export async function POST(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const me = await prisma.user.findUnique({
    where: { id: guard.session.sub },
    select: { id: true, name: true, email: true, isSeller: true, isDesigner: true },
  });
  if (!me) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // No-op guard — if the target state matches the current state we have
  // nothing to do. Surface as an explicit 400 so the UI can render a
  // helpful message instead of a silent success.
  if (
    me.isSeller === parsed.data.toIsSeller &&
    me.isDesigner === parsed.data.toIsDesigner
  ) {
    return NextResponse.json(
      { error: "You already have that exact role." },
      { status: 400 },
    );
  }

  const existing = await prisma.roleChangeRequest.findFirst({
    where: { userId: me.id, status: "PENDING" },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have a pending role-change request." },
      { status: 409 },
    );
  }

  const created = await prisma.roleChangeRequest.create({
    data: {
      userId: me.id,
      fromIsSeller: me.isSeller,
      fromIsDesigner: me.isDesigner,
      toIsSeller: parsed.data.toIsSeller,
      toIsDesigner: parsed.data.toIsDesigner,
      reason: parsed.data.reason,
    },
  });

  const targetRoles = [
    parsed.data.toIsSeller && "Seller",
    parsed.data.toIsDesigner && "Designer",
    !parsed.data.toIsSeller && !parsed.data.toIsDesigner && "Buyer only",
  ]
    .filter(Boolean)
    .join(" · ");
  void notifyAdmins({
    kind: "Role-change request",
    summary: `${me.name} wants ${targetRoles}`,
    link: "/admin/role-changes",
    meta: [
      { label: "Requester", value: `${me.name} · ${me.email}` },
      { label: "Target roles", value: targetRoles },
      ...(parsed.data.reason ? [{ label: "Reason", value: parsed.data.reason }] : []),
    ],
  });

  return NextResponse.json({ ok: true, request: created });
}
