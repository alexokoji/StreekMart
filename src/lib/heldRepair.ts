// Recomputes every seller's held (escrow) balance from first principles: the
// sum of what the orders still in flight really have in escrow. Fixes wallets
// that drifted because earlier releases subtracted the wrong amount (delivery
// fee included, or taken for sellers who never had escrow).
//
// `apply: false` only reports; `apply: true` writes the corrected balances and
// records the exact held amount on older orders so future releases are exact.

import { prisma } from "@/lib/db";
import { heldCentsFor } from "@/lib/wallet";

export type HeldRepairRow = {
  userId: string;
  name: string;
  email: string;
  openOrders: number;
  currentHeldCents: number;
  correctHeldCents: number;
  differenceCents: number;
};

export async function auditHeldFunds(apply: boolean): Promise<{ rows: HeldRepairRow[]; applied: boolean }> {
  const [wallets, openOrders] = await Promise.all([
    prisma.wallet.findMany({
      select: { userId: true, heldCents: true, user: { select: { name: true, email: true, streekmartAffiliated: true } } },
    }),
    prisma.order.findMany({
      where: { status: { in: ["PAID", "SHIPPED"] }, completedAt: null, directPayout: false },
      select: { id: true, sellerId: true, totalPrice: true, deliveryFeeCents: true, directPayout: true, heldCents: true },
    }),
  ]);

  const bySeller = new Map<string, typeof openOrders>();
  for (const o of openOrders) {
    const list = bySeller.get(o.sellerId) ?? [];
    list.push(o);
    bySeller.set(o.sellerId, list);
  }

  const rows: HeldRepairRow[] = [];
  const writes: Array<ReturnType<typeof prisma.wallet.update> | ReturnType<typeof prisma.order.update>> = [];
  for (const w of wallets) {
    const orders = bySeller.get(w.userId) ?? [];
    let correct = 0;
    for (const o of orders) {
      const held = heldCentsFor(o, w.user.streekmartAffiliated);
      correct += held;
      if (apply && o.heldCents === 0 && held > 0) {
        writes.push(prisma.order.update({ where: { id: o.id }, data: { heldCents: held } }));
      }
    }
    if (correct !== w.heldCents) {
      rows.push({
        userId: w.userId,
        name: w.user.name,
        email: w.user.email,
        openOrders: orders.length,
        currentHeldCents: w.heldCents,
        correctHeldCents: correct,
        differenceCents: correct - w.heldCents,
      });
      if (apply) writes.push(prisma.wallet.update({ where: { userId: w.userId }, data: { heldCents: correct } }));
    }
  }
  if (apply && writes.length > 0) await prisma.$transaction(writes as any);
  return { rows, applied: apply };
}
