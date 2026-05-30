import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/auth/verify-email?token=…
//
// Called by the link in the verification email. Looks the token up against
// every User row, checks expiry, marks the email verified, and wipes the
// token so the link can't be replayed. Returns JSON with a friendly outcome
// — the /verify-email landing page POSTs / fetches this and renders the
// result.
//
// We don't auto-issue a session here (the user typically clicks the link
// in the same browser session they just signed up in; if they don't, the
// /verify-email page nudges them to log in).

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { emailVerificationToken: token },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      emailVerificationTokenExpiresAt: true,
    },
  });
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "This verification link isn't valid. Request a new one." },
      { status: 404 },
    );
  }

  // Already verified — surface as success so a curious second-click feels
  // like "yep, all good" rather than an error.
  if (user.emailVerifiedAt) {
    return NextResponse.json({ ok: true, alreadyVerified: true, email: user.email });
  }

  if (
    !user.emailVerificationTokenExpiresAt ||
    user.emailVerificationTokenExpiresAt.getTime() < Date.now()
  ) {
    return NextResponse.json(
      { ok: false, error: "This verification link has expired. Request a new one." },
      { status: 410 },
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationToken: null,
      emailVerificationTokenExpiresAt: null,
    },
  });

  return NextResponse.json({ ok: true, email: user.email });
}
