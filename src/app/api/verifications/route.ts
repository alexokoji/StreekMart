import { NextResponse } from "next/server";
import { z } from "zod";
import { Permission } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

// POST /api/verifications  — file a verification request.
// GET  /api/verifications  — list the requesting user's own requests.
//
// Two-step tier progression:
//   Tier 2 (blue check): identity verification via NIN, Passport, or
//     Driver's License + the corresponding ID number. No documents.
//   Tier 3 (gold check): business verification via CAC document and an
//     optional storefront photo. Only available to users who already
//     hold Tier 2.

const Tier2Body = z.object({
  kind: z.enum(["SELLER", "DESIGNER"]),
  tier: z.literal(2),
  idType: z.enum(["NIN", "PASSPORT", "DRIVERS_LICENSE"]),
  idNumber: z.string().min(4).max(50),
  // CDN URL of the photographed / scanned ID. Required at the schema
  // level so a request can't reach the admin queue without something to
  // actually verify against.
  idDocumentUrl: z.string().url(),
  notes: z.string().max(2000).optional(),
});

const Tier3Body = z.object({
  kind: z.enum(["SELLER", "DESIGNER"]),
  tier: z.literal(3),
  cacDocumentUrl: z.string().url(),
  storeImageUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

const Body = z.discriminatedUnion("tier", [Tier2Body, Tier3Body]);

export async function POST(req: Request) {
  const guard = await requireApiUser([Permission.SELLER, Permission.DESIGNER]);
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const me = await prisma.user.findUnique({ where: { id: guard.session.sub } });
  if (!me) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isSellerKind = parsed.data.kind === "SELLER";
  if (isSellerKind && !me.isSeller) {
    return NextResponse.json({ error: "Only sellers can request seller verification." }, { status: 403 });
  }
  if (!isSellerKind && !me.isDesigner) {
    return NextResponse.json({ error: "Only designers can request designer verification." }, { status: 403 });
  }

  const currentTier = isSellerKind ? me.sellerTier : me.designerTier;

  // Tier-already-held guard. Stops a user wasting an admin's time
  // submitting a request for something they've already earned.
  if (parsed.data.tier <= currentTier) {
    return NextResponse.json(
      {
        error:
          parsed.data.tier === 2
            ? `You're already at Tier ${currentTier} or higher.`
            : "You're already at Tier 3.",
      },
      { status: 400 },
    );
  }

  // Tier 3 prereq: must already hold Tier 2. Without this an admin would
  // be asked to grant Gold to an unverified account.
  if (parsed.data.tier === 3 && currentTier < 2) {
    return NextResponse.json(
      { error: "Get verified at Tier 2 first, then apply for Tier 3." },
      { status: 400 },
    );
  }

  // One pending request per (kind, tier). Stops accidental double-submits
  // and keeps the admin queue clean.
  const existing = await prisma.verificationRequest.findFirst({
    where: {
      userId: me.id,
      kind: parsed.data.kind,
      tier: parsed.data.tier,
      status: "PENDING",
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have a pending request at this tier." },
      { status: 409 },
    );
  }

  const data =
    parsed.data.tier === 2
      ? {
          userId: me.id,
          kind: parsed.data.kind,
          tier: 2,
          idType: parsed.data.idType,
          idNumber: parsed.data.idNumber,
          idDocumentUrl: parsed.data.idDocumentUrl,
          notes: parsed.data.notes,
        }
      : {
          userId: me.id,
          kind: parsed.data.kind,
          tier: 3,
          cacDocumentUrl: parsed.data.cacDocumentUrl,
          storeImageUrl: parsed.data.storeImageUrl || null,
          notes: parsed.data.notes,
        };

  const created = await prisma.verificationRequest.create({ data });
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
