import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { sendEmail, emailVerificationEmail } from "@/lib/email";
import { generateEmailVerificationToken } from "@/lib/emailVerification";

// POST /api/auth/resend-verification
//
// Requires an authenticated session — we only resend to the email on the
// user's own User row, never an arbitrary address (that would be a spam
// vector). If the user is already verified we no-op with 200 so the UI
// can render a "you're good" message.

function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function POST() {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const me = await prisma.user.findUnique({
    where: { id: guard.session.sub },
    select: { id: true, name: true, email: true, emailVerifiedAt: true },
  });
  if (!me) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (me.emailVerifiedAt) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  // Fresh token. The old one (if any) is overwritten — we never want two
  // valid links floating around for the same account.
  const verification = generateEmailVerificationToken();
  await prisma.user.update({
    where: { id: me.id },
    data: {
      emailVerificationToken: verification.token,
      emailVerificationTokenExpiresAt: verification.expiresAt,
    },
  });

  const tpl = emailVerificationEmail({
    name: me.name,
    verificationLink: `${siteOrigin()}/verify-email?token=${verification.token}`,
  });
  const result = await sendEmail({ to: me.email, ...tpl });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: "We couldn't send the email right now. Try again in a minute." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
