import { NextResponse } from "next/server";
import { z } from "zod";
import { Permission } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

// POST /api/verifications  — file a verification request.
// GET  /api/verifications  — list the requesting user's own requests.
//
// Robust intake: business name + address are required for everyone; the
// hasPhysicalStore toggle decides which piece of evidence is mandatory.

const Body = z
  .object({
    kind: z.enum(["SELLER", "DESIGNER"]),
    businessName: z.string().min(2).max(120),
    businessAddress: z.string().min(5).max(500),
    hasPhysicalStore: z.boolean(),
    storeImageUrl: z.string().url().optional().or(z.literal("")),
    cacDocumentUrl: z.string().url().optional().or(z.literal("")),
    notes: z.string().max(2000).optional(),
    documents: z
      .array(z.object({ label: z.string().min(1).max(80), url: z.string().url() }))
      .max(8)
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.hasPhysicalStore && !data.storeImageUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["storeImageUrl"],
        message: "Upload a photo of your storefront with your business name visible.",
      });
    }
    if (!data.hasPhysicalStore && !data.cacDocumentUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cacDocumentUrl"],
        message: "Upload your CAC certificate to verify an online-only business.",
      });
    }
  });

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
      businessName: parsed.data.businessName,
      businessAddress: parsed.data.businessAddress,
      hasPhysicalStore: parsed.data.hasPhysicalStore,
      storeImageUrl: parsed.data.storeImageUrl || null,
      cacDocumentUrl: parsed.data.cacDocumentUrl || null,
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
