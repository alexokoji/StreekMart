// 4-character alphanumeric delivery code used to verify handoffs.
//
// The buyer sees the code on their order page and tells it to the dispatch
// rider at the door. The rider keys it into /deliver/[orderId] which posts
// to /api/orders/[id]/confirm-by-code — a match marks the order COMPLETED
// and releases the seller's held funds.
//
// The alphabet excludes characters that look alike (0/O, 1/I/L, etc.) so
// dictation between a buyer and a rider doesn't go wrong.

import { randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 29 chars
const LENGTH = 4;

export function generateDeliveryCode(): string {
  const bytes = randomBytes(LENGTH);
  let out = "";
  for (let i = 0; i < LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

// Case-insensitive, whitespace-tolerant equality. Constant-time compare so
// an attacker brute-forcing the code can't lean on early-return timing.
export function deliveryCodesMatch(stored: string, supplied: string): boolean {
  const a = stored.trim().toUpperCase();
  const b = supplied.trim().toUpperCase();
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}
