import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { sendEmail, isEmailEnabled } from "@/lib/email";

// POST /api/admin/email/test { to }
//
// Sends a one-off diagnostic email so you can confirm RESEND_API_KEY is set,
// the from address is valid, and the recipient actually receives mail.
// Returns the exact SendResult so you can see the Resend error verbatim
// instead of having to grep build logs.
//
// Usage:
//   curl -X POST https://<host>/api/admin/email/test \
//     -H "Cookie: <admin session>" \
//     -H "Content-Type: application/json" \
//     -d '{ "to": "you@example.com" }'

const Body = z.object({
  to: z.string().email(),
});

export async function POST(req: Request) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_EMAIL);
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a valid `to` email." }, { status: 400 });
  }

  const stub = !isEmailEnabled();
  const result = await sendEmail({
    to: parsed.data.to,
    subject: "StreekMart email test",
    html: `
      <p>This is a diagnostic email from StreekMart.</p>
      <p>If you received this, the Resend transport is wired correctly. Sent at ${new Date().toISOString()}.</p>
    `,
    text: `StreekMart email test — Resend transport is wired. Sent at ${new Date().toISOString()}.`,
  });

  return NextResponse.json({
    stubMode: stub,
    result,
    env: {
      RESEND_API_KEY_set: !!process.env.RESEND_API_KEY,
      EMAIL_FROM: process.env.EMAIL_FROM ?? "(unset — using Resend sandbox)",
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "(unset)",
    },
  });
}
