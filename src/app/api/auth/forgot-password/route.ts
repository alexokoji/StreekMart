import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { sendEmail, passwordResetEmail } from "@/lib/email";

const Body = z.object({ email: z.string().email() });

function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

// POST /api/auth/forgot-password { email }
//
// Always returns a generic 200 so the caller cannot use this endpoint to
// probe for which emails are registered. If the email matches a real
// account with a password (Google-only accounts can't reset a password),
// we mint a single-use token, store it on the User row, and email the
// reset link. Tokens are 32 random hex chars; lifetime is 60 minutes.
export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: true });
  }
  const { email } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, name: true, email: true, passwordHash: true },
  });
  if (!user || !user.passwordHash) {
    return NextResponse.json({ ok: true });
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: token,
      passwordResetTokenExpiresAt: expiresAt,
    },
  });

  const resetLink = `${siteOrigin()}/reset-password?token=${token}`;
  const tpl = passwordResetEmail({ name: user.name, resetLink });
  void sendEmail({ to: user.email, ...tpl })
    .then((r) => {
      if (!r.ok) console.error("[email:reset] failed", { email: user.email, error: r.error });
    })
    .catch((err) => console.error("[email:reset] threw", { email: user.email, err }));

  return NextResponse.json({ ok: true });
}