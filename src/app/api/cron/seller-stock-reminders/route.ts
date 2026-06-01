import { NextResponse } from "next/server";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { authorizedCron, cronForbidden } from "@/lib/cron";
import { sendPushBulk } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";

// Runs once a day at 19:00 UTC (= 20:00 Lagos) per vercel.json. Reminds
// every seller / designer who has at least one ACTIVE listing to update
// their stock numbers — keeps the storefront honest and stops "ghost"
// listings sticking around with stale availability.
//
// Both channels fire: push for the in-pocket nudge, email for the people
// who manage the shop from a laptop. The email is a single short line —
// not a digest — so it doesn't read as marketing noise.

export const runtime = "nodejs";

// Cap on the cohort size per run. Comfortably above the realistic seller
// count and a soft brake on Resend/Expo fan-out cost.
const MAX_RECIPIENTS = 2000;

export async function GET(req: Request) {
  if (!authorizedCron(req)) return cronForbidden();

  // Sellers / designers with at least one ACTIVE listing. We don't bother
  // pinging dormant accounts that have no live products to update.
  const sellers = await prisma.user.findMany({
    where: {
      suspendedAt: null,
      OR: [{ isSeller: true }, { isDesigner: true }],
      products: {
        some: { status: ProductStatus.ACTIVE },
      },
    },
    take: MAX_RECIPIENTS,
    select: { id: true, name: true, email: true, isSeller: true },
  });

  if (sellers.length === 0) {
    return NextResponse.json({ ok: true, recipients: 0 });
  }

  // Push to everyone with a device — best per-recipient channel and
  // cheaper to fan out.
  const pushResult = await sendPushBulk(
    sellers.map((s) => s.id),
    {
      title: "End-of-day stock check",
      body: "Tap to confirm your listings are still in stock for tomorrow.",
      link: "/seller/products",
      data: { type: "stock-reminder" },
    },
  );

  // Email each seller. Sequential with a tiny pause to keep us under the
  // Resend free-tier 2 req/s ceiling. Failures log per-recipient and the
  // run continues; one rejected address can't take the whole cron down.
  const SEND_GAP_MS = 600;
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  let emailed = 0;
  let emailErrors = 0;
  for (let i = 0; i < sellers.length; i++) {
    if (i > 0) await sleep(SEND_GAP_MS);
    const s = sellers[i];
    const dashHref = s.isSeller ? "/seller/products" : "/designer/products";
    const tpl = stockReminderEmail({ name: s.name, dashHref });
    const r = await sendEmail({ to: s.email, ...tpl }).catch((err) => ({
      ok: false as const,
      error: err instanceof Error ? err.message : "Unknown",
    }));
    if (r.ok) emailed++;
    else {
      emailErrors++;
      console.error("[cron:stock-reminder] email failed", { to: s.email, error: r.error });
    }
  }

  return NextResponse.json({
    ok: true,
    recipients: sellers.length,
    push: { accepted: pushResult.accepted, rejected: pushResult.rejected },
    email: { sent: emailed, failed: emailErrors },
  });
}

// Inline template — kept here rather than in email.ts because it's only
// used by this cron and surfaces a stock-specific CTA path.
function stockReminderEmail(opts: { name: string; dashHref: string }) {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const link = `${baseUrl}${opts.dashHref}`;
  return {
    subject: "Update your stock for tomorrow",
    html: `<!doctype html>
<html><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#f7f7f8; margin:0; padding:24px;">
  <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:16px; padding:24px;">
    <p style="margin:0 0 14px; color:#262630;">Hi ${escapeHtml(opts.name)},</p>
    <p style="margin:0 0 14px; color:#525258;">It's the end of the day — please take a moment to confirm your listings are still in stock, archive anything that's sold out elsewhere, and adjust prices if needed. Accurate stock keeps your storefront in the recommendations.</p>
    <p style="margin:18px 0;">
      <a href="${link}" style="display:inline-block; padding:10px 18px; background:#7c3aed; color:#ffffff; text-decoration:none; border-radius:10px; font-weight:600;">Open my products</a>
    </p>
    <p style="margin:0; color:#737378; font-size:11px;">You're getting this because you have at least one active listing on StreekMart.</p>
  </div>
</body></html>`,
    text: `Hi ${opts.name}, please confirm your stock is up to date for tomorrow: ${link}`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
