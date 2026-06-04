import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import {
  adminBroadcastWrap,
  sendEmail,
} from "@/lib/email";
import { sendPushBulk } from "@/lib/notifications";
import {
  ALL_CAMPAIGN_TEMPLATE_KEYS,
  CAMPAIGN_TEMPLATES,
  renderTemplateString,
  type CampaignTemplateKey,
} from "@/lib/campaignTemplates";
import {
  ALL_AUDIENCE_SEGMENT_KEYS,
  resolveSegmentRecipients,
  type AudienceSegmentKey,
} from "@/lib/audienceSegments";

// POST /api/admin/campaigns
// Body: { template, segment, subjectOverride?, bodyOverride?, dryRun? }
//
//   template          — one of CAMPAIGN_TEMPLATES keys (see lib).
//   segment           — one of AUDIENCE_SEGMENTS keys.
//   subjectOverride   — optional plain string; replaces the template's
//                       subject before interpolation.
//   bodyOverride      — optional HTML string; replaces the template's
//                       body before interpolation.
//   dryRun            — when true, resolves the audience and returns the
//                       count + a sample preview but doesn't send anything.
//                       The admin UI uses this for the "Recipients" panel.

const Body = z.object({
  template: z.enum(ALL_CAMPAIGN_TEMPLATE_KEYS as [CampaignTemplateKey, ...CampaignTemplateKey[]]),
  segment: z.enum(ALL_AUDIENCE_SEGMENT_KEYS as [AudienceSegmentKey, ...AudienceSegmentKey[]]),
  subjectOverride: z.string().min(2).max(200).optional(),
  bodyOverride: z.string().min(2).max(20_000).optional(),
  dryRun: z.boolean().default(false),
});

// Mirrors the broadcast endpoint: keep us under Resend's free-tier
// 2 req/s by sending one email every 600 ms with a 1.5 s wait on retry.
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

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
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

  const template = CAMPAIGN_TEMPLATES[parsed.data.template];
  const subjectTemplate = parsed.data.subjectOverride ?? template.subject;
  const bodyTemplate = parsed.data.bodyOverride ?? template.body;

  const recipients = await resolveSegmentRecipients(parsed.data.segment);

  if (parsed.data.dryRun) {
    // Sample render against the first recipient (or "Friend" if empty)
    // so the preview shows what an actual person receives.
    const sampleVars =
      recipients.length > 0
        ? { name: recipients[0].name, appUrl: appUrl() }
        : { name: "Friend", appUrl: appUrl() };
    return NextResponse.json({
      ok: true,
      recipientCount: recipients.length,
      sample: {
        to: recipients[0]?.email ?? "(no recipients)",
        subject: renderTemplateString(subjectTemplate, sampleVars),
        html: renderTemplateString(bodyTemplate, sampleVars),
      },
    });
  }

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "Audience resolved to 0 recipients." },
      { status: 400 },
    );
  }

  // Audit row up-front. Same EmailBroadcast table the existing /admin/email
  // tool writes to — campaigns and broadcasts share history. We tag the
  // template key in `errorNote` (reused as a free-text channel) so a
  // grep on the table shows campaign sends distinctly. A dedicated
  // `templateKey` column is a future cleanup.
  const broadcast = await prisma.emailBroadcast.create({
    data: {
      createdById: guard.user.id,
      subject: subjectTemplate,
      body: bodyTemplate,
      audience: "SPECIFIC",
      recipientIdsJson: JSON.stringify(recipients.map((r) => r.id)),
      recipientCount: recipients.length,
      status: "STUB",
      errorNote: `campaign:${parsed.data.template}|segment:${parsed.data.segment}`,
    },
  });

  let sent = 0;
  let firstError: string | null = null;
  const failures: { email: string; error: string }[] = [];

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    if (i > 0) await sleep(SEND_GAP_MS);

    const vars = { name: r.name, appUrl: appUrl() };
    const tpl = adminBroadcastWrap(
      renderTemplateString(subjectTemplate, vars),
      renderTemplateString(bodyTemplate, vars),
    );
    let res = await sendEmail({ to: r.email, ...tpl }).catch((err) => ({
      ok: false as const,
      error: err instanceof Error ? err.message : "Unknown",
    }));

    if (!res.ok && looksRateLimited(res.error)) {
      await sleep(RATE_LIMIT_RETRY_WAIT_MS);
      res = await sendEmail({ to: r.email, ...tpl }).catch((err) => ({
        ok: false as const,
        error: err instanceof Error ? err.message : "Unknown",
      }));
    }

    if (res.ok) sent++;
    else {
      const error = res.error ?? "Unknown error";
      if (!firstError) firstError = error;
      failures.push({ email: r.email, error });
    }
  }

  // Mirror to push for the recipients who have a device registered — same
  // pattern the broadcast endpoint uses, gives the campaign a second
  // channel without doubling the work.
  const previewBody = bodyTemplate
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  void sendPushBulk(
    recipients.map((r) => r.id),
    {
      title: subjectTemplate,
      body: previewBody.length > 140 ? previewBody.slice(0, 137) + "…" : previewBody,
      data: { type: "campaign", campaignKey: parsed.data.template },
    },
  ).catch((err) =>
    console.error("[push:campaign] threw", { template: parsed.data.template, err }),
  );

  const status = sent === recipients.length ? "SENT" : sent === 0 ? "FAILED" : "PARTIAL";
  await prisma.emailBroadcast.update({
    where: { id: broadcast.id },
    data: {
      status,
      sentCount: sent,
      errorNote:
        `campaign:${parsed.data.template}|segment:${parsed.data.segment}` +
        (firstError ? ` | first error: ${firstError}` : ""),
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
