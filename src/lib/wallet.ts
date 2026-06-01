// Wallet helper. Provides a single transactional entry point so balance and
// ledger always agree. All amounts are in USD-cents (integer math) — display
// goes through the CurrencyProvider's local-currency conversion.

import { prisma } from "./db";
import type { Prisma } from "@prisma/client";
import { PLATFORM_FEE_BPS } from "./monnify";

export type TxnType =
  | "SALE_CREDIT"
  | "PLATFORM_FEE"
  | "WITHDRAWAL"
  | "WITHDRAWAL_FEE"
  | "REFUND"           // Money credited back to a buyer's wallet after a cancel.
  | "PURCHASE"         // Wallet credit spent at checkout.
  | "ADJUSTMENT";

// Provision a wallet for a user if they don't have one yet.
export async function ensureWallet(userId: string) {
  return prisma.wallet.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

// Pure helper: compute the platform's cut of a sale.
export function platformFeeCents(grossCents: number): number {
  return Math.round((grossCents * PLATFORM_FEE_BPS) / 10000);
}

// Append a transaction and update the wallet's balance atomically.
export async function recordTransaction(args: {
  userId: string;
  amountCents: number; // signed
  type: TxnType;
  description: string;
  refType?: string;
  refId?: string;
  status?: "PENDING" | "COMPLETED" | "FAILED";
  tx?: Prisma.TransactionClient; // optional outer transaction
}) {
  const client = args.tx ?? prisma;
  const wallet = await client.wallet.upsert({
    where: { userId: args.userId },
    create: { userId: args.userId },
    update: {},
  });

  const txn = await client.walletTransaction.create({
    data: {
      walletId: wallet.id,
      amountCents: args.amountCents,
      type: args.type,
      description: args.description,
      refType: args.refType,
      refId: args.refId,
      status: args.status ?? "COMPLETED",
    },
  });

  // Only completed transactions move the balance — pending withdrawals don't
  // double-deduct until they're paid out by the disbursement webhook.
  if ((args.status ?? "COMPLETED") === "COMPLETED") {
    await client.wallet.update({
      where: { id: wallet.id },
      data: { balanceCents: { increment: args.amountCents } },
    });
  }

  return txn;
}

// Convenience: book a sale + the matching platform-fee debit. The net amount
// is added to the wallet's `heldCents` so it isn't withdrawable until the
// order is delivered (see releaseHeldFundsForOrder).
//
// Net credit to the seller = gross − platformFeeCents.
export async function recordSale(args: {
  sellerId: string;
  grossCents: number;
  productName: string;
  orderId: string;
  // StreekMart-affiliated sellers bypass escrow — the net credit lands
  // straight in their withdrawable balance instead of `heldCents`. Set
  // from User.streekmartAffiliated in finalizePaidOrders.
  skipHold?: boolean;
}) {
  const fee = platformFeeCents(args.grossCents);
  const net = args.grossCents - fee;
  await prisma.$transaction(async (tx) => {
    await recordTransaction({
      tx,
      userId: args.sellerId,
      amountCents: args.grossCents,
      type: "SALE_CREDIT",
      description: args.skipHold
        ? `Sale: ${args.productName} (direct credit · affiliated)`
        : `Sale: ${args.productName} (held until delivery)`,
      refType: "order",
      refId: args.orderId,
    });
    if (fee > 0) {
      await recordTransaction({
        tx,
        userId: args.sellerId,
        amountCents: -fee,
        type: "PLATFORM_FEE",
        description: `Platform fee (${(PLATFORM_FEE_BPS / 100).toFixed(2)}%)`,
        refType: "order",
        refId: args.orderId,
      });
    }
    if (!args.skipHold) {
      // Mark the net as held — withdrawable balance excludes this.
      // Affiliated sellers skip this step entirely so the net is
      // withdrawable as soon as the order is paid.
      await tx.wallet.update({
        where: { userId: args.sellerId },
        data: { heldCents: { increment: net } },
      });
    }
  });
  return { gross: args.grossCents, fee, net };
}

// Withdrawable balance = balanceCents - heldCents. Used by /api/wallet/payout
// before authorising a withdrawal. Always non-negative.
export async function availableBalanceCents(userId: string): Promise<number> {
  const w = await prisma.wallet.findUnique({ where: { userId } });
  if (!w) return 0;
  return Math.max(0, w.balanceCents - w.heldCents);
}

// Release the held portion of a sale once the buyer confirms delivery (or
// the seller marks the order COMPLETED). Idempotent — calling twice does
// nothing the second time because `released` is recorded on the order.
export async function releaseHeldFundsForOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;
  // Already released? The order's status moving to COMPLETED is the trigger;
  // we use completedAt as the idempotency marker — non-null means we've
  // already moved the funds.
  if (order.completedAt) return;

  const grossCents = Math.round(order.totalPrice * 100);
  const net = grossCents - platformFeeCents(grossCents);

  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { userId: order.sellerId },
      data: { heldCents: { decrement: net } },
    });
    await tx.order.update({
      where: { id: order.id },
      data: { completedAt: new Date() },
    });
  });
}

// Reverse a held sale when the buyer cancels a paid-but-undelivered order.
// We zero out the held funds AND the seller's wallet credit (REFUND debit
// for audit). The buyer's actual money refund happens out-of-band via the
// payment gateway.
export async function reverseHeldFundsForOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;
  // Already released to the seller? Can't claw back automatically — that
  // becomes a dispute.
  if (order.completedAt) {
    throw new Error("Cannot reverse — order was already marked completed.");
  }

  const grossCents = Math.round(order.totalPrice * 100);
  const fee = platformFeeCents(grossCents);
  const net = grossCents - fee;

  await prisma.$transaction(async (tx) => {
    // Net refund to the platform (negative for the seller).
    await recordTransaction({
      tx,
      userId: order.sellerId,
      amountCents: -net,
      type: "REFUND",
      description: `Refund — buyer cancelled order #${order.id.slice(0, 8)}`,
      refType: "order",
      refId: order.id,
    });
    // Roll back the platform fee too.
    if (fee > 0) {
      await recordTransaction({
        tx,
        userId: order.sellerId,
        amountCents: fee,
        type: "REFUND",
        description: `Platform fee refund — order #${order.id.slice(0, 8)}`,
        refType: "order",
        refId: order.id,
      });
    }
    await tx.wallet.update({
      where: { userId: order.sellerId },
      data: { heldCents: { decrement: net } },
    });
  });
}

// Credit the buyer's wallet with a refund. Called when an order is cancelled
// after payment so the buyer can either spend it on another purchase or
// withdraw to their bank. Idempotent per (userId, refId, "REFUND") pair —
// a follow-up call with the same ref no-ops.
export async function creditRefundToWallet(args: {
  buyerId: string;
  amountCents: number;
  description: string;
  orderId: string;
}) {
  // Idempotency guard.
  const wallet = await ensureWallet(args.buyerId);
  const existing = await prisma.walletTransaction.findFirst({
    where: {
      walletId: wallet.id,
      type: "REFUND",
      refType: "order",
      refId: args.orderId,
    },
  });
  if (existing) return existing;

  return recordTransaction({
    userId: args.buyerId,
    amountCents: args.amountCents,
    type: "REFUND",
    description: args.description,
    refType: "order",
    refId: args.orderId,
  });
}

// Apply wallet credit to a checkout. Returns the cents actually applied
// (capped at the available balance and the order subtotal). Books the
// PURCHASE debit + wallet update in a single transaction.
export async function chargeWalletForPurchase(args: {
  userId: string;
  maxApplyCents: number;
  paymentReference: string;
}): Promise<number> {
  const available = await availableBalanceCents(args.userId);
  const applied = Math.min(available, args.maxApplyCents);
  if (applied <= 0) return 0;

  await recordTransaction({
    userId: args.userId,
    amountCents: -applied,
    type: "PURCHASE",
    description: `Wallet payment — order group ${args.paymentReference}`,
    refType: "checkout",
    refId: args.paymentReference,
  });
  return applied;
}
