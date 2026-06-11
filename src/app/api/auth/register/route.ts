import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import {
  canonicaliseBusinessNameDisplay,
  normaliseBusinessName,
  normalisePhone,
} from "@/lib/businessName";
import { isBusinessNameTaken } from "@/lib/businessNameServer";
import { uniqueSlugFrom } from "@/lib/slug";
import { isValidCountryCode } from "@/lib/location";
import { sendEmail, welcomeEmail, emailVerificationEmail } from "@/lib/email";
import { generateEmailVerificationToken } from "@/lib/emailVerification";
import { ensureReferralCode, recordReferralOnSignup } from "@/lib/referrals";

// Build the absolute URL we drop into the verification email so the click
// path stays correct in dev (localhost), preview (vercel.app), and prod.
function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

// Every account starts with implicit Buyer permission.
// Sellers and Designers are opt-in flags that can be enabled at signup or
// later from /account.
//
// Location (country + city) is required at signup so we can match buyers
// with nearby sellers and apply the right delivery rate at checkout. Region
// (state/province) is optional — useful in larger countries.
const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2),
  // Required for everyone — phone is the platform's contact channel for
  // delivery + order updates.
  phone: z
    .string()
    .regex(/^[+]?[\d\s().-]{7,20}$/, "Enter a valid phone number"),
  // Required when isSeller is true (further-validated below). Sellers can't
  // list a product without one — buyers identify shops by their business name.
  businessName: z.string().min(2).max(80).optional(),
  country: z.string().length(2, "Pick a country"),
  city: z.string().min(2, "Enter your city").max(80),
  region: z.string().max(80).optional(),
  isSeller: z.boolean().optional().default(false),
  isDesigner: z.boolean().optional().default(false),
  // Taste signal collected at signup. Both optional — backwards-compatible
  // with any client that doesn't send them. Used by recs + smart-suggestions.
  gender: z.enum(["female", "male", "nonbinary", "prefer-not-to-say"]).optional(),
  interests: z.array(z.string().min(1).max(80)).max(20).optional(),
  // Referral code from /register?ref=<code>. Stored on the body so OAuth
  // and password flows go through the same capture path. Empty/invalid
  // codes are ignored silently — recordReferralOnSignup tolerates them.
  referralCode: z.string().trim().min(4).max(12).optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { email, password, name, phone, businessName, country, city, region, isSeller, isDesigner, gender, interests, referralCode } = parsed.data;
  if (!isValidCountryCode(country.toUpperCase())) {
    return NextResponse.json({ error: "Pick a supported country" }, { status: 400 });
  }

  // Sellers must register with a business name. We allow non-sellers to
  // skip it — they may still set one later if they enable seller permission.
  if (isSeller && !businessName) {
    return NextResponse.json(
      { error: "Sellers must enter a business name." },
      { status: 400 },
    );
  }

  let businessNameDisplay: string | null = null;
  let businessNameLower: string | null = null;
  if (businessName) {
    businessNameDisplay = canonicaliseBusinessNameDisplay(businessName);
    if (!businessNameDisplay) {
      return NextResponse.json({ error: "Enter a valid business name." }, { status: 400 });
    }
    businessNameLower = normaliseBusinessName(businessNameDisplay);
    if (await isBusinessNameTaken(businessNameLower)) {
      return NextResponse.json(
        { error: "That business name is already taken." },
        { status: 409 },
      );
    }
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  // Auto-generate a memorable handle from the user's name. Collision-safe
  // — uniqueSlugFrom appends -2, -3, etc. as needed.
  const slug = await uniqueSlugFrom(name);

  // Generate the email-verification token alongside the account itself so
  // the welcome and verification emails can fire in the same async block.
  // Wiping the token + expiry on successful verification lives in the
  // /api/auth/verify-email route.
  const verification = generateEmailVerificationToken();

  const user = await prisma.user.create({
    data: {
      email,
      name,
      slug,
      phone: normalisePhone(phone),
      businessName: businessNameDisplay,
      businessNameLower,
      passwordHash: await hashPassword(password),
      country: country.toUpperCase(),
      city: city.trim(),
      region: region?.trim() || null,
      gender: gender ?? null,
      interestsJson: JSON.stringify(interests ?? []),
      isSeller,
      isDesigner,
      emailVerificationToken: verification.token,
      emailVerificationTokenExpiresAt: verification.expiresAt,
      // Provision an empty cart up front — every account is a buyer.
      cart: { create: {} },
    },
  });

  // Provision the new user's own referral code so we can show it on
  // their dashboard immediately. If a referrer code was passed in via
  // ?ref=, record the relationship + award points to the referrer.
  await ensureReferralCode(user.id);
  if (referralCode) {
    await recordReferralOnSignup({ newUserId: user.id, code: referralCode }).catch((err) =>
      console.error("[referral:signup] threw", { code: referralCode, err }),
    );
  }

  // Sign the user in immediately so they can browse the site / cart while
  // checking their email. Unverified accounts surface a "please verify"
  // banner from the layout but aren't otherwise restricted.
  await setSessionCookie({
    sub: user.id,
    email: user.email,
    name: user.name,
    isSeller: user.isSeller,
    isDesigner: user.isDesigner,
  });

  // Welcome email + verification email — fire-and-forget. Stub mode (no
  // RESEND_API_KEY) just logs to stdout, so dev signups never fail because
  // email isn't wired. Log failures so prod incidents are debuggable;
  // signup still succeeds.
  const welcome = welcomeEmail(user.name);
  void sendEmail({ to: user.email, ...welcome })
    .then((r) => {
      if (!r.ok) console.error("[email:welcome] failed", { to: user.email, error: r.error });
    })
    .catch((err) => console.error("[email:welcome] threw", { to: user.email, err }));

  const verifyTpl = emailVerificationEmail({
    name: user.name,
    verificationLink: `${siteOrigin()}/verify-email?token=${verification.token}`,
  });
  void sendEmail({ to: user.email, ...verifyTpl })
    .then((r) => {
      if (!r.ok) console.error("[email:verify] failed", { to: user.email, error: r.error });
    })
    .catch((err) => console.error("[email:verify] threw", { to: user.email, err }));

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    isSeller: user.isSeller,
    isDesigner: user.isDesigner,
  });
}
