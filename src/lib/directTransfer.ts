// Direct-pay bank transfers. The buyer pays the seller's own bank account (no
// payment gateway), then uploads a receipt. The seller matches the credit alert
// to the order by the reference the buyer put in the narration, and confirms.

import { randomInt } from "node:crypto";

// No 0/O/1/I so a reference read off a bank alert can't be mistaken.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newTransferReference(): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return `SM-${out}`;
}

export type TransferStatus = "AWAITING_TRANSFER" | "PROOF_SUBMITTED" | "CONFIRMED" | "REJECTED";

/** Whether the buyer may (re)upload a receipt for this state. */
export function canSubmitProof(status: string | null | undefined): boolean {
  return status === "AWAITING_TRANSFER" || status === "PROOF_SUBMITTED" || status === "REJECTED";
}

/** Total the buyer must transfer for a set of orders, in naira (kobo-exact). */
export function transferTotal(orders: { totalPrice: number }[]): number {
  return Math.round(orders.reduce((s, o) => s + Math.round(o.totalPrice * 100), 0)) / 100;
}
