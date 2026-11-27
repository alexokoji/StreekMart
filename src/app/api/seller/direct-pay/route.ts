import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { Permission } from "@/lib/enums";
import { hasDirectPay, isValidAccountNumber } from "@/lib/directPay";

// GET /api/seller/direct-pay — the seller's direct-pay status and details.
// PUT /api/seller/direct-pay — save bank details + flat delivery fee.
//
// Only sellers an admin has enabled can save (the privilege itself is
// granted at /api/admin/users/[id]/direct-pay). The account number is
// stored as entered; the seller is responsible for it being right, and every
// payout shows the masked account in their wallet history.

const SELECT = {
  directPayEnabled: true,
  directBankCode: true,
  directAccountNumber: true,
  directAccountName: true,
  directDeliveryFeeCents: true,
  directFeeBps: true,
} as const;

export async function GET() {
  const guard = await requireApiUser([Permission.SELLER]);
  if ("error" in guard) return guard.error;
  const u = await prisma.user.findUnique({ where: { id: guard.session.sub }, select: SELECT });
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    enabled: u.directPayEnabled,
    active: hasDirectPay(u),
    bankCode: u.directBankCode,
    accountNumber: u.directAccountNumber,
    accountName: u.directAccountName,
    deliveryFeeCents: u.directDeliveryFeeCents,
    platformFeeBps: u.directFeeBps,
  });
}

const Body = z.object({
  bankCode: z.string().trim().min(2).max(10),
  accountNumber: z.string().trim(),
  accountName: z.string().trim().min(2).max(120),
  // Flat delivery fee in naira the seller charges (0 = free delivery).
  deliveryFeeNaira: z.number().min(0).max(1_000_000),
});

export async function PUT(req: Request) {
  const guard = await requireApiUser([Permission.SELLER]);
  if ("error" in guard) return guard.error;

  const me = await prisma.user.findUnique({
    where: { id: guard.session.sub },
    select: { directPayEnabled: true },
  });
  if (!me?.directPayEnabled) {
    return NextResponse.json(
      { error: "Direct payments aren't enabled on your account. Contact StreekMart to request it." },
      { status: 403 },
    );
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the bank details and try again." }, { status: 400 });
  if (!isValidAccountNumber(parsed.data.accountNumber)) {
    return NextResponse.json({ error: "Account numbers are 10 digits." }, { status: 400 });
  }
  await prisma.user.update({
    where: { id: guard.session.sub },
    data: {
      directBankCode: parsed.data.bankCode,
      directAccountNumber: parsed.data.accountNumber,
      directAccountName: parsed.data.accountName,
      directDeliveryFeeCents: Math.round(parsed.data.deliveryFeeNaira * 100),
    },
  });
  return NextResponse.json({ ok: true });
}
