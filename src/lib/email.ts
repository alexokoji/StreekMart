// Email sender + transactional templates.
//
// Provider: Resend (https://resend.com — 3,000 emails / month free).
//
// Stub mode (no RESEND_API_KEY): logs the email to stdout instead of
// sending. Mirrors the Monnify stub pattern so devs can run the whole
// signup / order flow without configuring an email provider.

import { prisma } from "./db";

const SITE = "StreekMart";
const SITE_TAGLINE = "Fashion-first marketplace for materials, ready-to-wear, and designers.";

export function isEmailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function fromAddress(): string {
  // Override with EMAIL_FROM in production once you've set up a verified
  // sending domain on Resend. The default works for testing only — Resend
  // restricts the onresend.com address to your own account email.
  return process.env.EMAIL_FROM ?? "StreekMart <onboarding@resend.dev>";
}

export type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  // Optional reply-to override (e.g. for admin broadcasts).
  replyTo?: string;
};

export type SendResult = {
  ok: boolean;
  id?: string;
  error?: string;
};

// Single send. Returns ok=false with a reason on failure so callers can log
// + continue rather than crash the request that triggered the send.
export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const toList = Array.isArray(args.to) ? args.to : [args.to];

  if (!isEmailEnabled()) {
    // Stub mode — print + pretend we sent. Useful for dev / CI.
    console.log("[email:stub]", { to: toList, subject: args.subject });
    return { ok: true, id: "stub-" + Date.now() };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Resend } = require("resend") as typeof import("resend");
    const client = new Resend(process.env.RESEND_API_KEY);
    const res = await client.emails.send({
      from: fromAddress(),
      to: toList,
      subject: args.subject,
      html: args.html,
      text: args.text,
      replyTo: args.replyTo,
    });
    if (res.error) {
      return { ok: false, error: res.error.message };
    }
    return { ok: true, id: res.data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown email error" };
  }
}

// Resolve a recipient set for an admin broadcast.
export type BroadcastAudience = "ALL" | "BUYERS" | "SELLERS" | "DESIGNERS" | "VERIFIED" | "SPECIFIC";

export async function resolveAudienceEmails(audience: BroadcastAudience, specificIds: string[] = []) {
  const where: Record<string, unknown> = {};
  switch (audience) {
    case "ALL":
      break;
    case "BUYERS":
      // "Pure" buyers: no seller / designer flags. Everyone can buy, but
      // this label means accounts that don't also sell.
      where.isSeller = false;
      where.isDesigner = false;
      break;
    case "SELLERS":
      where.isSeller = true;
      break;
    case "DESIGNERS":
      where.isDesigner = true;
      break;
    case "VERIFIED":
      where.OR = [{ sellerVerified: true }, { designerVerified: true }];
      break;
    case "SPECIFIC":
      where.id = { in: specificIds };
      break;
  }
  const users = await prisma.user.findMany({
    where,
    select: { id: true, email: true, name: true },
  });
  return users;
}

// ---------- Templates ----------

function wrap(content: string): string {
  // Tiny inline-styled wrapper — most email clients strip <head>/<style>
  // tags, so inline is the safest path. Keep this minimal; design lives in
  // the app, not the inbox.
  return `<!doctype html>
<html><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#f7f7f8; margin:0; padding:24px;">
  <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; padding:32px; box-shadow:0 4px 24px rgba(0,0,0,0.04);">
    <div style="font-size:14px; font-weight:700; letter-spacing:0.04em; color:#7c3aed; text-transform:uppercase;">${SITE}</div>
    <div style="margin-top:16px; color:#262630; line-height:1.55; font-size:15px;">${content}</div>
    <hr style="margin:24px 0; border:none; border-top:1px solid #e4e4e8;" />
    <p style="color:#737378; font-size:11px; line-height:1.4;">
      ${SITE_TAGLINE}<br/>
      You're receiving this because you have a StreekMart account.
    </p>
  </div>
</body></html>`;
}

export function welcomeEmail(name: string): { subject: string; html: string; text: string } {
  return {
    subject: `Welcome to ${SITE}, ${name}!`,
    html: wrap(`
      <p>Hey ${escapeHtml(name)} 👋</p>
      <p>Welcome aboard. ${SITE} is the home for fabrics, ready-to-wear, and independent designers — and you're now part of it.</p>
      <p style="margin-top:24px;"><a href="${appUrl()}" style="display:inline-block; padding:10px 18px; background:#7c3aed; color:#ffffff; text-decoration:none; border-radius:10px; font-weight:600;">Browse the storefront</a></p>
      <p style="margin-top:24px; color:#525258;">If you signed up to sell or design, head to your dashboard to request verification — it's required before you can list products.</p>
    `),
    text: `Welcome to ${SITE}, ${name}! Visit ${appUrl()} to start browsing. Sellers/designers must verify before listing.`,
  };
}

export function orderPlacedEmail(opts: {
  name: string;
  orderId: string;
  productName: string;
  deliveryCode: string | null;
  totalDisplay: string;
}): { subject: string; html: string; text: string } {
  const codeBlock = opts.deliveryCode
    ? `<div style="margin-top:24px; padding:16px; background:#f5f3ff; border-radius:12px; text-align:center;">
         <div style="font-size:11px; font-weight:700; color:#6d28d9; letter-spacing:0.18em; text-transform:uppercase;">Delivery code</div>
         <div style="margin-top:8px; font-family:'SF Mono', monospace; font-size:28px; letter-spacing:0.4em; font-weight:700; color:#262630;">${opts.deliveryCode}</div>
         <div style="margin-top:8px; font-size:11px; color:#737378;">Share with the dispatch rider on arrival.</div>
       </div>`
    : "";
  return {
    subject: `Order placed — ${opts.productName}`,
    html: wrap(`
      <p>Hi ${escapeHtml(opts.name)},</p>
      <p>Your order for <strong>${escapeHtml(opts.productName)}</strong> is confirmed. Total: <strong>${escapeHtml(opts.totalDisplay)}</strong>.</p>
      ${codeBlock}
      <p style="margin-top:24px;"><a href="${appUrl()}/account/orders/${opts.orderId}" style="color:#7c3aed; font-weight:600;">Track this order →</a></p>
    `),
    text: `Order confirmed: ${opts.productName} · ${opts.totalDisplay}. Delivery code: ${opts.deliveryCode ?? "n/a"}. Track at ${appUrl()}/account/orders/${opts.orderId}`,
  };
}

export function verificationDecisionEmail(opts: {
  name: string;
  kind: "SELLER" | "DESIGNER";
  approved: boolean;
  note?: string | null;
}): { subject: string; html: string; text: string } {
  const role = opts.kind.toLowerCase();
  return {
    subject: opts.approved
      ? `You're a verified ${role} on ${SITE} ✓`
      : `Your ${role} verification needs another look`,
    html: wrap(
      opts.approved
        ? `<p>Hi ${escapeHtml(opts.name)},</p>
           <p>Your ${role} account is now verified. A check-mark badge is showing next to your name, and your listings are eligible for recommendations.</p>
           <p style="margin-top:24px;"><a href="${appUrl()}/${role === "seller" ? "seller" : "designer"}" style="color:#7c3aed; font-weight:600;">Open your dashboard →</a></p>`
        : `<p>Hi ${escapeHtml(opts.name)},</p>
           <p>Our team reviewed your ${role} verification and couldn&rsquo;t approve it as-is.</p>
           ${opts.note ? `<p style="padding:12px; background:#fbeef0; color:#6b1a2a; border-radius:10px;">${escapeHtml(opts.note)}</p>` : ""}
           <p>You can resubmit with updated info from your dashboard.</p>`,
    ),
    text: opts.approved
      ? `You're a verified ${role} on ${SITE}.`
      : `Your ${role} verification needs another look.${opts.note ? " " + opts.note : ""}`,
  };
}

export function adminBroadcastWrap(subject: string, body: string): { subject: string; html: string; text: string } {
  // For admin broadcasts we use the same wrapper but render `body` as
  // already-escaped HTML (the admin authored it). If you want plain-text
  // input you can pre-escape on the server before calling this.
  return {
    subject,
    html: wrap(body),
    text: body.replace(/<[^>]+>/g, ""),
  };
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
