import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { uniqueSlugFrom } from "@/lib/slug";
import { isValidCountryCode } from "@/lib/location";
import { sendEmail, welcomeEmail } from "@/lib/email";

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
  country: z.string().length(2, "Pick a country"),
  city: z.string().min(2, "Enter your city").max(80),
  region: z.string().max(80).optional(),
  isSeller: z.boolean().optional().default(false),
  isDesigner: z.boolean().optional().default(false),
  // Taste signal collected at signup. Both optional — backwards-compatible
  // with any client that doesn't send them. Used by recs + smart-suggestions.
  gender: z.enum(["female", "male", "nonbinary", "prefer-not-to-say"]).optional(),
  interests: z.array(z.string().min(1).max(80)).max(20).optional(),
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

  const { email, password, name, country, city, region, isSeller, isDesigner, gender, interests } = parsed.data;
  if (!isValidCountryCode(country.toUpperCase())) {
    return NextResponse.json({ error: "Pick a supported country" }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  // Auto-generate a memorable handle from the user's name. Collision-safe
  // — uniqueSlugFrom appends -2, -3, etc. as needed.
  const slug = await uniqueSlugFrom(name);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      slug,
      passwordHash: await hashPassword(password),
      country: country.toUpperCase(),
      city: city.trim(),
      region: region?.trim() || null,
      gender: gender ?? null,
      interestsJson: JSON.stringify(interests ?? []),
      isSeller,
      isDesigner,
      // Provision an empty cart up front — every account is a buyer.
      cart: { create: {} },
    },
  });

  await setSessionCookie({
    sub: user.id,
    email: user.email,
    name: user.name,
    isSeller: user.isSeller,
    isDesigner: user.isDesigner,
  });

  // Welcome email — fire-and-forget. Stub mode (no RESEND_API_KEY) just
  // logs to stdout, so dev signups never fail because email isn't wired.
  const tpl = welcomeEmail(user.name);
  void sendEmail({ to: user.email, ...tpl }).catch(() => {});

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    isSeller: user.isSeller,
    isDesigner: user.isDesigner,
  });
}
