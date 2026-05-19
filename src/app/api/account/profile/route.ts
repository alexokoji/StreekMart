import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession, setSessionCookie } from "@/lib/auth";
import {
  canonicaliseBusinessNameDisplay,
  isBusinessNameTaken,
  normaliseBusinessName,
  normalisePhone,
} from "@/lib/businessName";
import { validateSlug } from "@/lib/slug";
import { isValidCountryCode } from "@/lib/location";

// PATCH /api/account/profile { name?, bio?, avatarUrl?, email?, password?, slug? }
//
// Edits the user's profile from inside their dashboard's Settings page.
// Permissions (isSeller / isDesigner) are intentionally NOT editable here —
// once chosen at signup, they stay. If a user genuinely needs to add a
// permission later that's a separate operator-side action.
//
// `slug` updates the user's public profile handle (/u/<slug>). Validated
// for format + uniqueness before persisting.

const Body = z.object({
  name: z.string().min(2).max(80).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().or(z.literal("")).optional(),
  // Profile-page cover banner. Owner-only — see /u/[slug]'s upload control.
  coverImageUrl: z.string().url().or(z.literal("")).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).max(200).optional(),
  slug: z.string().min(3).max(30).optional(),
  // Phone is always editable — it's the contact channel, not a brand identity.
  phone: z
    .string()
    .regex(/^[+]?[\d\s().-]{7,20}$/, "Enter a valid phone number")
    .optional(),
  // Business name is editable ONLY when the user doesn't already have one
  // set. Subsequent changes have to go through /api/account/business-name-change
  // for admin approval. The handler enforces this — the client can't bypass
  // by sending the field anyway.
  businessName: z.string().min(2).max(80).optional(),
  // Location updates — useful both for buyers (delivery matching) and
  // sellers (defines the "within city" zone for their delivery rates).
  country: z.string().length(2).optional(),
  city: z.string().min(2).max(80).optional(),
  region: z.string().max(80).optional(),
});

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  // Email-uniqueness check if the user is changing it.
  if (parsed.data.email && parsed.data.email !== session.email) {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing && existing.id !== session.sub) {
      return NextResponse.json({ error: "That email is already taken." }, { status: 409 });
    }
  }

  // Slug validation + uniqueness.
  if (parsed.data.slug !== undefined) {
    const err = validateSlug(parsed.data.slug);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    const owner = await prisma.user.findUnique({ where: { slug: parsed.data.slug } });
    if (owner && owner.id !== session.sub) {
      return NextResponse.json({ error: "That handle is already taken." }, { status: 409 });
    }
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name) data.name = parsed.data.name;
  if (parsed.data.bio !== undefined) data.bio = parsed.data.bio;
  if (parsed.data.avatarUrl !== undefined) data.avatarUrl = parsed.data.avatarUrl || null;
  if (parsed.data.coverImageUrl !== undefined) {
    data.coverImageUrl = parsed.data.coverImageUrl || null;
  }
  if (parsed.data.email) data.email = parsed.data.email;
  if (parsed.data.slug) data.slug = parsed.data.slug;
  if (parsed.data.phone !== undefined) {
    data.phone = normalisePhone(parsed.data.phone);
  }
  if (parsed.data.businessName !== undefined) {
    // Only honoured for the *first* time a user sets their business name.
    // Once `businessNameLower` is non-null the field is locked and the
    // user must go through BusinessNameChangeRequest. Silently dropping
    // the field would hide the intent, so 403 instead.
    const me = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { businessNameLower: true },
    });
    if (me?.businessNameLower) {
      return NextResponse.json(
        {
          error:
            "Your business name is locked. Submit a change request from settings to update it.",
        },
        { status: 403 },
      );
    }
    const display = canonicaliseBusinessNameDisplay(parsed.data.businessName);
    if (!display) {
      return NextResponse.json({ error: "Enter a valid business name." }, { status: 400 });
    }
    const lower = normaliseBusinessName(display);
    if (await isBusinessNameTaken(lower, session.sub)) {
      return NextResponse.json(
        { error: "That business name is already taken." },
        { status: 409 },
      );
    }
    data.businessName = display;
    data.businessNameLower = lower;
  }
  if (parsed.data.country) {
    const code = parsed.data.country.toUpperCase();
    if (!isValidCountryCode(code)) {
      return NextResponse.json({ error: "Pick a supported country" }, { status: 400 });
    }
    data.country = code;
  }
  if (parsed.data.city !== undefined) data.city = parsed.data.city.trim();
  if (parsed.data.region !== undefined) data.region = parsed.data.region.trim() || null;
  if (parsed.data.password) {
    const bcrypt = await import("bcryptjs");
    data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }

  const updated = await prisma.user.update({
    where: { id: session.sub },
    data,
    select: { id: true, email: true, name: true, isSeller: true, isDesigner: true, slug: true },
  });

  // Re-issue cookie so name/email in the JWT stays in sync with the row.
  await setSessionCookie({
    sub: updated.id,
    email: updated.email,
    name: updated.name,
    isSeller: updated.isSeller,
    isDesigner: updated.isDesigner,
  });

  return NextResponse.json({ user: updated });
}
