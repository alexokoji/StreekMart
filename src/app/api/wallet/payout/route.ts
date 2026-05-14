import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import {
  disburse,
  WITHDRAWAL_FEE_BPS,
  WITHDRAWAL_FEE_FLAT_CENTS,
} from "@/lib/monnify";
import { availableBalanceCents, ensureWallet, recordTransaction } from "@/lib/wallet";

// POST /api/wallet/payout { amountCents, bankCode, accountNumber, accountName }
//
// Sellers/designers withdraw funds. We:
//   1. Validate they have enough balance (incl. fees).
//   2. Record a PENDING WITHDRAWAL row (debits the wallet immediately so a
//      double-spend can't slip through while we wait on Monnify).
//   3. Record the WITHDRAWAL_FEE debit.
//   4. Call Monnify (stub or live).
//   5. Mark the PayoutRequest + transactions PAID/FAILED based on the result.

const Body = z.object({
  amountCents: z.number().int().positive(),
  bankCode: z.string().min(2).max(10),
  accountNumber: z.string().min(6).max(20),
  accountName: z.string().min(2).max(120),
});

export async function POST(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { amountCents, bankCode, accountNumber, accountName } = parsed.data;

  // Compute the fee first so we can guarantee the wallet covers everything.
  const feeCents = WITHDRAWAL_FEE_FLAT_CENTS + Math.round((amountCents * WITHDRAWAL_FEE_BPS) / 10000);
  const totalDebit = amountCents + feeCents;

  await ensureWallet(guard.session.sub);
  // Withdrawable = total balance MINUS funds held against undelivered orders.
  // This is the buyer-protection guarantee: a seller cannot withdraw money
  // for products that haven't reached the buyer yet.
  const available = await availableBalanceCents(guard.session.sub);
  if (available < totalDebit) {
    return NextResponse.json(
      {
        error:
          `Insufficient available balance. Need at least ` +
          `${(totalDebit / 100).toFixed(2)} (incl. ${(feeCents / 100).toFixed(2)} fee). ` +
          `Funds from undelivered orders are released only after the buyer confirms delivery.`,
      },
      { status: 400 },
    );
  }

  // Step 1: create the request + book the wallet entries optimistically.
  const reqRow = await prisma.payoutRequest.create({
    data: {
      userId: guard.session.sub,
      amountCents,
      destinationJson: JSON.stringify({ bankCode, accountNumber, accountName }),
      status: "PROCESSING",
    },
  });
  await prisma.$transaction(async (tx) => {
    await recordTransaction({
      tx,
      userId: guard.session.sub,
      amountCents: -amountCents,
      type: "WITHDRAWAL",
      description: `Withdrawal to ${accountName} · ${maskAccount(accountNumber)}`,
      refType: "payout",
      refId: reqRow.id,
    });
    if (feeCents > 0) {
      await recordTransaction({
        tx,
        userId: guard.session.sub,
        amountCents: -feeCents,
        type: "WITHDRAWAL_FEE",
        description: `Withdrawal fee`,
        refType: "payout",
        refId: reqRow.id,
      });
    }
  });

  // Step 2: dispatch to Monnify.
  try {
    const result = await disburse({
      amountCents,
      destinationAccountNumber: accountNumber,
      destinationBankCode: bankCode,
      reference: reqRow.id,
      narration: "StreekMart wallet withdrawal",
    });
    await prisma.payoutRequest.update({
      where: { id: reqRow.id },
      data: {
        status: result.status === "PAID" ? "PAID" : result.status === "FAILED" ? "FAILED" : "PROCESSING",
        externalRef: result.externalReference,
        failureReason: result.message ?? null,
      },
    });

    // If Monnify returned FAILED synchronously, refund the wallet.
    if (result.status === "FAILED") {
      await refundFailedPayout(guard.session.sub, amountCents, feeCents, reqRow.id);
    }

    return NextResponse.json({ ok: true, payoutId: reqRow.id, status: result.status });
  } catch (err) {
    // Network/auth failure → refund + mark FAILED.
    await prisma.payoutRequest.update({
      where: { id: reqRow.id },
      data: { status: "FAILED", failureReason: err instanceof Error ? err.message : "Unknown error" },
    });
    await refundFailedPayout(guard.session.sub, amountCents, feeCents, reqRow.id);
    return NextResponse.json(
      { error: "Withdrawal failed. Funds returned to your wallet." },
      { status: 502 },
    );
  }
}

async function refundFailedPayout(
  userId: string,
  amountCents: number,
  feeCents: number,
  payoutId: string,
) {
  await prisma.$transaction(async (tx) => {
    await recordTransaction({
      tx,
      userId,
      amountCents,
      type: "REFUND",
      description: "Refund — withdrawal failed",
      refType: "payout",
      refId: payoutId,
    });
    if (feeCents > 0) {
      await recordTransaction({
        tx,
        userId,
        amountCents: feeCents,
        type: "REFUND",
        description: "Refund — withdrawal fee",
        refType: "payout",
        refId: payoutId,
      });
    }
  });
}

function maskAccount(s: string): string {
  if (s.length <= 4) return s;
  return "•••• " + s.slice(-4);
}
