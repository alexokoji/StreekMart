import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { uniqueSlugFrom } from "@/lib/slug";

// Every account starts with implicit Buyer permission.
// Sellers and Designers are opt-in flags that can be enabled at signup or
// later from /account.
const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2),
  isSeller: z.boolean().optional().default(false),
  isDesigner: z.boolean().optional().default(false),
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

  const { email, password, name, isSeller, isDesigner } = parsed.data;
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

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    isSeller: user.isSeller,
    isDesigner: user.isDesigner,
  });
}
