import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";

const Body = z.object({
  token: z.string().min(16).max(128),
  password: z.string().min(8).max(200),
});

// POST /api/auth/reset-password { token, password }
//
// Consume a token minted by /api/auth/forgot-password. On success:
//   - Hash + persist the new password
//   - Clear the reset token + expiry so it can't be reused
//   - Sign the user in (set cookie AND return token in body for mobile)
// Generic error responses so the endpoint can't be probed for known
// tokens.
export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { token, password } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { passwordResetToken: token },
    select: { id: true, email: true, name: true, isSeller: true, isDesigner: true, passwordResetTokenExpiresAt: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Reset link is invalid or already used." }, { status: 400 });
  }
  if (!user.passwordResetTokenExpiresAt || user.passwordResetTokenExpiresAt < new Date()) {
    return NextResponse.json({ error: "Reset link has expired. Request a new one." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      passwordResetToken: null,
      passwordResetTokenExpiresAt: null,
    },
  });

  const sessionToken = await setSessionCookie({
    sub: user.id,
    email: user.email,
    name: user.name,
    isSeller: user.isSeller,
    isDesigner: user.isDesigner,
  });
  return NextResponse.json({
    token: sessionToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isSeller: user.isSeller,
      isDesigner: user.isDesigner,
    },
  });
}