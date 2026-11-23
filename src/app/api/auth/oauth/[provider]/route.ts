import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { uniqueSlugFrom } from "@/lib/slug";
import { sendEmail, welcomeEmail, emailVerificationEmail } from "@/lib/email";
import { generateEmailVerificationToken } from "@/lib/emailVerification";
import { ensureReferralCode } from "@/lib/referrals";
import {
  type OAuthProfile,
  verifyAppleIdentityToken,
  verifyFacebookAccessToken,
  verifyGoogleIdToken,
} from "@/lib/mobileOAuth";

export const runtime = "nodejs";

// POST /api/auth/oauth/{google|apple|facebook}
//
// Token-based social sign-in for the mobile app. The app signs in with the
// native provider SDK and sends us the resulting token; we verify it with
// the provider, then resolve to a StreekMart user the same way the web's
// Google callback does:
//   1. Existing account for that provider id (Google) → sign in.
//   2. Existing account with the same verified email  → link and sign in.
//   3. Otherwise create a fresh buyer account.
// Responds like /api/auth/login: { token, user }.

const Body = z.object({
  idToken: z.string().optional(),
  accessToken: z.string().optional(),
  identityToken: z.string().optional(),
  authorizationCode: z.string().optional(),
  email: z.string().email().nullish(),
  fullName: z
    .object({ givenName: z.string().nullish(), familyName: z.string().nullish() })
    .nullish(),
});

export async function POST(req: Request, { params }: { params: { provider: string } }) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const b = parsed.data;

  let profile: OAuthProfile;
  try {
    if (params.provider === "google" && b.idToken) profile = await verifyGoogleIdToken(b.idToken);
    else if (params.provider === "apple" && b.identityToken)
      profile = await verifyAppleIdentityToken(b.identityToken, { email: b.email, fullName: b.fullName });
    else if (params.provider === "facebook" && b.accessToken)
      profile = await verifyFacebookAccessToken(b.accessToken);
    else return NextResponse.json({ error: "Unsupported sign-in method." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sign-in failed." },
      { status: 401 },
    );
  }
  // Linking by email is only safe when the provider vouches for it.
  if (!profile.emailVerified) {
    return NextResponse.json({ error: "Your email address isn't verified with the provider." }, { status: 401 });
  }

  let user =
    profile.provider === "google"
      ? await prisma.user.findUnique({ where: { googleId: profile.sub } })
      : null;
  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
    if (byEmail) {
      user =
        profile.provider === "google" && !byEmail.googleId
          ? await prisma.user.update({ where: { id: byEmail.id }, data: { googleId: profile.sub } })
          : byEmail;
    }
  }

  let isNewSignup = false;
  if (!user) {
    const slug = await uniqueSlugFrom(profile.name || profile.email.split("@")[0]);
    const verification = generateEmailVerificationToken();
    user = await prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        slug,
        passwordHash: null,
        googleId: profile.provider === "google" ? profile.sub : null,
        authProvider: profile.provider,
        avatarUrl: profile.picture ?? null,
        isSeller: false,
        isDesigner: false,
        emailVerificationToken: verification.token,
        emailVerificationTokenExpiresAt: verification.expiresAt,
        cart: { create: {} },
      },
    });
    isNewSignup = true;
    await ensureReferralCode(user.id);
  } else {
    await prisma.cart.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
  }

  if (user.suspendedAt) {
    return NextResponse.json(
      { error: "This account has been suspended. Contact support if you believe this is a mistake." },
      { status: 403 },
    );
  }

  const token = await setSessionCookie({
    sub: user.id,
    email: user.email,
    name: user.name,
    isSeller: user.isSeller,
    isDesigner: user.isDesigner,
  });

  if (isNewSignup && user.emailVerificationToken) {
    const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;
    void sendEmail({ to: user.email, ...welcomeEmail(user.name) }).catch(() => {});
    void sendEmail({
      to: user.email,
      ...emailVerificationEmail({
        name: user.name,
        verificationLink: `${origin}/verify-email?token=${user.emailVerificationToken}`,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isSeller: user.isSeller,
      isDesigner: user.isDesigner,
    },
  });
}
