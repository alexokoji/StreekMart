import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import {
  adminBroadcastWrap,
  resolveAudienceEmails,
  sendEmail,
  type BroadcastAudience,
} from "@/lib/email";

// POST /api/admin/email — broadcast email to a chosen audience.
//
// Body: { subject, body (HTML allowed), audience, specificIds? }
//
// We deliver sequentially with a small concurrency cap so a Resend rate
// limit doesn't take down the request. For very large blasts, a real job
// queue would be the next step — out of scope for V1.

const Body = z.object({
  subject: z.string().min(2).max(200),
  body: z.string().min(2).max(20_000),
  audience: z.enum(["ALL", "BUYERS", "SELLERS", "DESIGNERS", "VERIFIED", "SPECIFIC", "EMAILS"]),
  specificIds: z.array(z.string()).max(2000).optional(),
  // For audience=EMAILS: a list of raw email addresses. Mix of users and
  // non-users is fine; the resolver attaches user metadata where it can.
  specificEmails: z.array(z.string().email()).max(2000).optional(),
});

const SEND_CONCURRENCY = 4;

export async function POST(req: Request) {
  const guard = await requireApiAdmin();
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const recipients = await resolveAudienceEmails(
    parsed.data.audience as BroadcastAudience,
    parsed.data.specificIds ?? [],
    parsed.data.specificEmails ?? [],
  );

  if (recipients.length === 0) {
    return NextResponse.json({ error: "Audience resolved to 0 recipients." }, { status: 400 });
  }

  // For EMAILS audience some recipients won't have a user id (non-users);
  // store the raw emails in the audit field instead. Otherwise store the
  // resolved user ids as before. The column is `String @default("[]")`
  // — semantically just a JSON array, the field name is historical.
  const auditList =
    parsed.data.audience === "EMAILS"
      ? recipients.map((r) => r.email)
      : recipients.map((r) => r.id);

  // Create the audit row up-front so we have an ID even if the send fails.
  const broadcast = await prisma.emailBroadcast.create({
    data: {
      createdById: guard.user.id,
      subject: parsed.data.subject,
      body: parsed.data.body,
      audience: parsed.data.audience,
      recipientIdsJson: JSON.stringify(auditList),
      recipientCount: recipients.length,
      status: "STUB",
    },
  });

  const tpl = adminBroadcastWrap(parsed.data.subject, parsed.data.body);

  let sent = 0;
  let firstError: string | null = null;

  // Small concurrency window — Resend's free tier rate-limits at 2 req/s.
  // 4 concurrent calls × short body keeps us comfortably under that.
  for (let i = 0; i < recipients.length; i += SEND_CONCURRENCY) {
    const batch = recipients.slice(i, i + SEND_CONCURRENCY);
    const results = await Promise.all(
      batch.map((r) =>
        sendEmail({ to: r.email, ...tpl }).catch((err) => ({
          ok: false as const,
          error: err instanceof Error ? err.message : "Unknown",
        })),
      ),
    );
    for (const res of results) {
      if (res.ok) sent++;
      else if (!firstError) firstError = res.error ?? "Unknown error";
    }
  }

  const status = sent === recipients.length ? "SENT" : sent === 0 ? "FAILED" : "PARTIAL";
  await prisma.emailBroadcast.update({
    where: { id: broadcast.id },
    data: { status, sentCount: sent, errorNote: firstError ?? null },
  });

  return NextResponse.json({
    ok: status !== "FAILED",
    broadcastId: broadcast.id,
    recipientCount: recipients.length,
    sentCount: sent,
    status,
  });
}
