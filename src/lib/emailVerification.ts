// Email-verification token helpers.
//
// Token: a 32-byte hex string (~64 chars). Generated with crypto.randomBytes
// rather than nanoid so we don't pull a dep just for this; the entropy is
// well past what's needed for an unguessable URL.
//
// Lifetime: 7 days. Long enough that someone signing up before a holiday
// week still has a working link when they come back; short enough that a
// stolen old email isn't a permanent hijack vector.

import { randomBytes } from "node:crypto";

export const EMAIL_VERIFICATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateEmailVerificationToken(): {
  token: string;
  expiresAt: Date;
} {
  return {
    token: randomBytes(32).toString("hex"),
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
  };
}
