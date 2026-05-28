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
//
// Failure-mode logging happens here at the source so we don't depend on
// every caller wiring its own try/catch. The log line format
// `[email:send] <reason>` is the single grep target for prod incidents.
export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const toList = Array.isArray(args.to) ? args.to : [args.to];

  if (!isEmailEnabled()) {
    // Stub mode — print + pretend we sent. Useful for dev / CI.
    // In prod this line is the smoking gun for "emails not arriving":
    // RESEND_API_KEY isn't set on the Vercel env.
    console.warn(
      "[email:stub] RESEND_API_KEY not set — email NOT sent.",
      { to: toList, subject: args.subject },
    );
    return { ok: true, id: "stub-" + Date.now() };
  }

  const from = fromAddress();
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Resend } = require("resend") as typeof import("resend");
    const client = new Resend(process.env.RESEND_API_KEY);
    const res = await client.emails.send({
      from,
      to: toList,
      subject: args.subject,
      html: args.html,
      text: args.text,
      replyTo: args.replyTo,
    });
    if (res.error) {
      console.error("[email:send] Resend rejected", {
        to: toList,
        subject: args.subject,
        from,
        error: res.error,
      });
      return { ok: false, error: res.error.message };
    }
    console.log("[email:send] ok", { to: toList, subject: args.subject, id: res.data?.id });
    return { ok: true, id: res.data?.id };
  } catch (err) {
    console.error("[email:send] threw", {
      to: toList,
      subject: args.subject,
      from,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: err instanceof Error ? err.message : "Unknown email error" };
  }
}

// Resolve a recipient set for an admin broadcast.
//
// SPECIFIC takes an array of User IDs. EMAILS takes an array of email
// addresses — useful when the admin already has the addresses (e.g. CSV
// export, support ticket) and doesn't want to look up IDs first. Unknown
// addresses are still included as send targets so a "blast to my mailing
// list" use case works even for non-users.
export type BroadcastAudience =
  | "ALL"
  | "BUYERS"
  | "SELLERS"
  | "DESIGNERS"
  | "VERIFIED"
  | "SPECIFIC"
  | "EMAILS";

type Recipient = { id: string; email: string; name: string };

export async function resolveAudienceEmails(
  audience: BroadcastAudience,
  specificIds: string[] = [],
  specificEmails: string[] = [],
): Promise<Recipient[]> {
  if (audience === "EMAILS") {
    if (specificEmails.length === 0) return [];
    // Normalise + de-dupe addresses; the form may include duplicates.
    const normalized = Array.from(
      new Set(specificEmails.map((e) => e.trim().toLowerCase()).filter(Boolean)),
    );
    // Pull matching users so the audit row + email envelope have a real
    // name when available. Unknown addresses fall through with id="".
    const users = await prisma.user.findMany({
      where: { email: { in: normalized } },
      select: { id: true, email: true, name: true },
    });
    const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
    return normalized.map((email) => byEmail.get(email) ?? { id: "", email, name: email });
  }

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
  // Never blast to suspended accounts — they can't sign in or interact
  // with the platform, and sending them content would just generate
  // bounce / unsubscribe noise.
  where.suspendedAt = null;
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
  //
  // Logo is rendered as an absolute-URL <img> because email clients won't
  // resolve relative paths. Height locks the visual size; max-width keeps it
  // from blowing up if a client ignores height. alt text falls back to the
  // brand name when images are blocked (common default in Outlook / Gmail).
  const logoSrc = `${appUrl()}/logo.jpeg`;
  return `<!doctype html>
<html><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#f7f7f8; margin:0; padding:24px;">
  <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; padding:32px; box-shadow:0 4px 24px rgba(0,0,0,0.04);">
    <img src="${logoSrc}" alt="${SITE}" height="40" style="display:block; height:40px; width:auto; max-width:200px;" />
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

export function accountSuspendedEmail(opts: {
  name: string;
  reason?: string | null;
}): { subject: string; html: string; text: string } {
  return {
    subject: `Your ${SITE} account has been suspended`,
    html: wrap(`
      <p>Hi ${escapeHtml(opts.name)},</p>
      <p>Your ${SITE} account has been suspended by an admin. You won&rsquo;t be able to sign in or use the platform until the suspension is lifted.</p>
      ${opts.reason
        ? `<p style="padding:12px; background:#fbeef0; color:#6b1a2a; border-radius:10px;"><strong>Reason:</strong> ${escapeHtml(opts.reason)}</p>`
        : ""}
      <p>If you believe this is a mistake, reply to this email and our team will review.</p>
    `),
    text: `Your ${SITE} account has been suspended.${opts.reason ? " Reason: " + opts.reason : ""}`,
  };
}

export function accountReinstatedEmail(name: string): { subject: string; html: string; text: string } {
  return {
    subject: `Your ${SITE} account is active again`,
    html: wrap(`
      <p>Hi ${escapeHtml(name)},</p>
      <p>Good news — your ${SITE} account has been reinstated. You can sign in and continue where you left off.</p>
      <p style="margin-top:24px;"><a href="${appUrl()}/login" style="display:inline-block; padding:10px 18px; background:#7c3aed; color:#ffffff; text-decoration:none; border-radius:10px; font-weight:600;">Sign in</a></p>
    `),
    text: `Your ${SITE} account is active again. Sign in at ${appUrl()}/login.`,
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
