import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { setSessionCookie, verifyPassword } from "@/lib/auth";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  if (!user.passwordHash) {
    // Account was created via Google and has never set a password.
    return NextResponse.json(
      { error: "This account uses Google sign-in. Click 'Sign in with Google' instead." },
      { status: 401 },
    );
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // Older accounts may not have a cart row yet — provision lazily on login.
  await prisma.cart.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
  });

  await setSessionCookie({
    sub: user.id,
    email: user.email,
    name: user.name,
    isSeller: user.isSeller,
    isDesigner: user.isDesigner,
  });
  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    isSeller: user.isSeller,
    isDesigner: user.isDesigner,
  });
}
