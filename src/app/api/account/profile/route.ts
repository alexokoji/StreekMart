import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession, setSessionCookie } from "@/lib/auth";
import { validateSlug } from "@/lib/slug";

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
  email: z.string().email().optional(),
  password: z.string().min(8).max(200).optional(),
  slug: z.string().min(3).max(30).optional(),
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
  if (parsed.data.email) data.email = parsed.data.email;
  if (parsed.data.slug) data.slug = parsed.data.slug;
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
