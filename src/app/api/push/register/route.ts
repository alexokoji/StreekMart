import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

// POST /api/push/register { token, platform? }
//
// Called by the mobile shell (mobile/App.tsx) on first launch and after
// every cold-start once permission is granted. Upserts the device's Expo
// push token against the current user. Same user with two devices = two
// rows; same token re-registered = updatedAt bump (no duplicate row).
//
// We don't authenticate the token format here — Expo's send API will
// reject malformed tokens with InvalidCredentials, and we'll delete those
// rows in sendPush (see src/lib/notifications.ts).

const Body = z.object({
  // Expo push tokens look like "ExponentPushToken[xxxxxxxxxxxxxxxxxxxx]".
  // Plain FCM/APNs tokens are accepted too — sendPush forwards them as-is.
  token: z.string().min(10).max(200),
  platform: z.enum(["ios", "android"]).optional(),
});

export async function POST(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  // Upsert by unique `token`. If a different user previously claimed this
  // token (e.g. someone signed out and a new user signed in on the same
  // device), this rebinds it — exactly what we want, so notifications go
  // to the current account on that device, not the old one.
  await prisma.pushToken.upsert({
    where: { token: parsed.data.token },
    create: {
      userId: guard.session.sub,
      token: parsed.data.token,
      platform: parsed.data.platform,
    },
    update: {
      userId: guard.session.sub,
      platform: parsed.data.platform ?? undefined,
    },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/push/register?token=... — called by the mobile shell on
// explicit sign-out so the device stops receiving pushes for that user.
export async function DELETE(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  // Only delete if the token belongs to the requesting user — prevents a
  // signed-in user from invalidating someone else's device by guessing
  // their token.
  await prisma.pushToken.deleteMany({
    where: { token, userId: guard.session.sub },
  });

  return NextResponse.json({ ok: true });
}
