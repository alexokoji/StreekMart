// Referral program helpers.
//
// Each user gets an 8-character referral code at signup. Friends sign up
// with `?ref=<code>` (the value is captured into a cookie on landing so
// it survives the OAuth round-trip too) and the referrer gets points.
//
// Points values live here so admins can tweak them in one place. The
// actual award of points goes through awardPoints() so every credit is
// recorded in the PointsLedger.

import { prisma } from "@/lib/db";

// Points awarded for each referral milestone. The "what they're worth"
// decision is deferred — for now just bookkeep balances. When the spend
// rules are wired (e.g. ₦100 per 100pts) the conversion is one place.
export const POINTS = {
  // Awarded the moment a new user signs up via your code.
  REFERRAL_SIGNUP: 50,
  // Awarded once the referee completes their first paid order. Bigger
  // than signup so the incentive is "refer real buyers", not bots.
  REFERRAL_QUALIFIED: 200,
} as const;

// Generate a short, readable code. 8 chars from a 32-symbol alphabet =
// ~10^12 codes, plenty for the foreseeable user base. Excludes 0/O/1/I
// so people typing them on paper / messages don't collide.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function generateReferralCode(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

// Ensure a user has a code, generating + persisting one if not. Idempotent.
// Loops on the (rare) unique-constraint collision so duplicate codes can
// never escape the function.
export async function ensureReferralCode(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
  if (u?.referralCode) return u.referralCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
        select: { referralCode: true },
      });
      return updated.referralCode!;
    } catch {
      // unique violation — try a different code
    }
  }
  throw new Error("Couldn't allocate a referral code after 5 attempts.");
}

// Credit a delta to a user. Writes a ledger row and updates the cached
// balance in one transaction so the dashboard never disagrees with the
// ledger sum.
export async function awardPoints(args: {
  userId: string;
  delta: number;
  reason: string;
  refId?: string;
}): Promise<void> {
  if (!Number.isFinite(args.delta) || args.delta === 0) return;
  await prisma.$transaction([
    prisma.pointsLedger.create({
      data: {
        userId: args.userId,
        delta: args.delta,
        reason: args.reason,
        refId: args.refId,
      },
    }),
    prisma.user.update({
      where: { id: args.userId },
      data: { pointsBalance: { increment: args.delta } },
    }),
  ]);
}

// Look up the referrer by code. Returns null if unknown. Tolerates
// case-insensitive input since people retype these from screenshots.
export async function findReferrerByCode(code: string): Promise<{ id: string; name: string } | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const u = await prisma.user.findFirst({
    where: { referralCode: normalized },
    select: { id: true, name: true },
  });
  return u;
}

// Capture the new-user side of a referral: create the Referral row and
// award the signup points. Skips silently if the referrer doesn't exist,
// the new user is the referrer themselves, or a Referral row already
// exists for this referee (re-runs are no-ops).
export async function recordReferralOnSignup(args: {
  newUserId: string;
  code: string;
}): Promise<void> {
  const referrer = await findReferrerByCode(args.code);
  if (!referrer) return;
  if (referrer.id === args.newUserId) return;

  const exists = await prisma.referral.findUnique({
    where: { refereeId: args.newUserId },
  });
  if (exists) return;

  const referral = await prisma.referral.create({
    data: {
      referrerId: referrer.id,
      refereeId: args.newUserId,
      codeUsed: args.code.trim().toUpperCase(),
    },
  });
  await awardPoints({
    userId: referrer.id,
    delta: POINTS.REFERRAL_SIGNUP,
    reason: "referral:signup",
    refId: referral.id,
  });
}

// Mark a referee as "qualified" when they complete their first paid
// order. Called from the order-completion path. Idempotent — only awards
// once per Referral row.
export async function markRefereeQualified(refereeUserId: string): Promise<void> {
  const referral = await prisma.referral.findUnique({
    where: { refereeId: refereeUserId },
  });
  if (!referral) return;
  if (referral.qualifiedAt) return;
  await prisma.referral.update({
    where: { id: referral.id },
    data: { qualifiedAt: new Date() },
  });
  await awardPoints({
    userId: referral.referrerId,
    delta: POINTS.REFERRAL_QUALIFIED,
    reason: "referral:qualified",
    refId: referral.id,
  });
}
