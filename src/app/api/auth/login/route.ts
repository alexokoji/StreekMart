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

  // Suspension gate — block at sign-in so the user gets a clear message
  // instead of a confusing successful login that then 401s on every page.
  if (user.suspendedAt) {
    return NextResponse.json(
      {
        error:
          "This account has been suspended. Contact support if you believe this is a mistake.",
      },
      { status: 403 },
    );
  }

  // Older accounts may not have a cart row yet — provision lazily on login.
  await prisma.cart.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
  });

  // Capture the token so the mobile client (which cannot read httpOnly
  // cookies from a fetch response) can store it in SecureStore and
  // replay it as Authorization: Bearer on subsequent calls. The web
  // flow still uses the cookie that setSessionCookie also sets.
  const token = await setSessionCookie({
    sub: user.id,
    email: user.email,
    name: user.name,
    isSeller: user.isSeller,
    isDesigner: user.isDesigner,
  });
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
