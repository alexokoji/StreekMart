import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import {
  adminBroadcastWrap,
  resolveAudienceEmails,
  sendEmail,
  type BroadcastAudience,
} from "@/lib/email";
import { sendPushBulk } from "@/lib/notifications";

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

// Resend's free tier rate-limits at 2 requests/second. We send sequentially
// (1 in flight) with a 600ms gap → ~1.7/sec, safely under the ceiling.
// Anything more aggressive triggers 429s mid-blast and silently fails
// recipients. If you upgrade Resend's plan, lift these numbers in tandem.
const SEND_GAP_MS = 600;
const RATE_LIMIT_RETRY_WAIT_MS = 1500;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function looksRateLimited(error: string | undefined): boolean {
  if (!error) return false;
  const msg = error.toLowerCase();
  return (
    msg.includes("rate") ||
    msg.includes("429") ||
    msg.includes("too many") ||
    msg.includes("throttl")
  );
}

export async function POST(req: Request) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_EMAIL);
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
  const failures: { email: string; error: string }[] = [];

  // Sequential send loop with pacing. One send per ~600ms keeps us under
  // Resend's free-tier 2 req/s. On a 429-shaped error we wait longer and
  // retry once — captures the common transient-rate-limit case without
  // looping forever.
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    if (i > 0) await sleep(SEND_GAP_MS);

    let res = await sendEmail({ to: r.email, ...tpl }).catch((err) => ({
      ok: false as const,
      error: err instanceof Error ? err.message : "Unknown",
    }));

    if (!res.ok && looksRateLimited(res.error)) {
      // Single retry after a longer wait. Resend's 429s clear in well
      // under a second; 1.5s is comfortable headroom.
      await sleep(RATE_LIMIT_RETRY_WAIT_MS);
      res = await sendEmail({ to: r.email, ...tpl }).catch((err) => ({
        ok: false as const,
        error: err instanceof Error ? err.message : "Unknown",
      }));
    }

    if (res.ok) {
      sent++;
    } else {
      const error = res.error ?? "Unknown error";
      if (!firstError) firstError = error;
      failures.push({ email: r.email, error });
    }
  }

  // Fire a parallel push broadcast to recipients that have a user id
  // (non-user EMAILS-audience entries are skipped — there's nothing to
  // route a push to). Body is the plain-text version of the email body
  // truncated to ~140 chars so the system banner doesn't wrap awkwardly.
  // Fire-and-forget — email is the authoritative channel for this audit
  // log; the push is a courtesy.
  const userIds = recipients.map((r) => r.id).filter(Boolean);
  if (userIds.length > 0) {
    const previewBody = parsed.data.body
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    void sendPushBulk(userIds, {
      title: parsed.data.subject,
      body: previewBody.length > 140 ? previewBody.slice(0, 137) + "…" : previewBody,
      data: { type: "admin-broadcast", broadcastId: broadcast.id },
    }).catch((err) => console.error("[push:broadcast] threw", { broadcastId: broadcast.id, err }));
  }

  const status = sent === recipients.length ? "SENT" : sent === 0 ? "FAILED" : "PARTIAL";
  await prisma.emailBroadcast.update({
    where: { id: broadcast.id },
    data: {
      status,
      sentCount: sent,
      errorNote: firstError ?? null,
      failuresJson: JSON.stringify(failures),
    },
  });

  return NextResponse.json({
    ok: status !== "FAILED",
    broadcastId: broadcast.id,
    recipientCount: recipients.length,
    sentCount: sent,
    status,
    failures,
  });
}
