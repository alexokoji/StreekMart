import { NextResponse } from "next/server";
import { z } from "zod";
import { Permission } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

// POST /api/verifications  — file a request to be verified.
// Sellers ask for a SELLER badge, designers for a DESIGNER badge. A user
// can only have one PENDING request per kind at a time.
//
// GET /api/verifications  — list the requesting user's own requests.

const Body = z.object({
  kind: z.enum(["SELLER", "DESIGNER"]),
  notes: z.string().max(2000).optional(),
  documents: z
    .array(z.object({ label: z.string().min(1).max(80), url: z.string().url() }))
    .max(8)
    .optional(),
});

export async function POST(req: Request) {
  const guard = await requireApiUser([Permission.SELLER, Permission.DESIGNER]);
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Check the requester actually has the permission they're asking to verify.
  const me = await prisma.user.findUnique({ where: { id: guard.session.sub } });
  if (!me) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (parsed.data.kind === "SELLER" && !me.isSeller) {
    return NextResponse.json({ error: "Only sellers can request seller verification." }, { status: 403 });
  }
  if (parsed.data.kind === "DESIGNER" && !me.isDesigner) {
    return NextResponse.json({ error: "Only designers can request designer verification." }, { status: 403 });
  }
  if (parsed.data.kind === "SELLER" && me.sellerVerified) {
    return NextResponse.json({ error: "You're already verified as a seller." }, { status: 400 });
  }
  if (parsed.data.kind === "DESIGNER" && me.designerVerified) {
    return NextResponse.json({ error: "You're already verified as a designer." }, { status: 400 });
  }

  // One pending per kind.
  const existing = await prisma.verificationRequest.findFirst({
    where: { userId: me.id, kind: parsed.data.kind, status: "PENDING" },
  });
  if (existing) {
    return NextResponse.json({ error: "You already have a pending request for this badge." }, { status: 409 });
  }

  const created = await prisma.verificationRequest.create({
    data: {
      userId: me.id,
      kind: parsed.data.kind,
      notes: parsed.data.notes,
      documentsJson: JSON.stringify(parsed.data.documents ?? []),
    },
  });
  return NextResponse.json({ request: created });
}

export async function GET() {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const requests = await prisma.verificationRequest.findMany({
    where: { userId: guard.session.sub },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ requests });
}
