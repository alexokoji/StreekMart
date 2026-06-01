import { NextResponse } from "next/server";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { authorizedCron, cronForbidden } from "@/lib/cron";
import { sendPushBulk } from "@/lib/notifications";

// Runs every 12 hours via GitHub Actions (see
// .github/workflows/cron-buyer-product-alerts.yml). For each registered
// buyer device, pushes a short summary of new products listed since the
// previous run. We intentionally do NOT email here — twice-daily emails
// to every buyer would burn through the Resend free tier and read as
// spam. Push is opt-in by definition (the user installed the app +
// accepted the prompt).

export const runtime = "nodejs";

// Window: products created in the last 13 hours (one hour overlap with
// the cron cadence to ride out small clock drift between the scheduler and
// the database).
const WINDOW_MS = 13 * 60 * 60 * 1000;
// Hard cap on notifications per run — protects against fan-out cost spikes.
const MAX_RECIPIENTS = 5000;

export async function GET(req: Request) {
  if (!authorizedCron(req)) return cronForbidden();

  const since = new Date(Date.now() - WINDOW_MS);

  // Recent new arrivals, sorted by exposure for the headline pick.
  const newProducts = await prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      createdAt: { gte: since },
    },
    orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
    take: 30,
    select: { id: true, name: true, category: true, seller: { select: { country: true } } },
  });

  if (newProducts.length === 0) {
    return NextResponse.json({ ok: true, productsFound: 0, recipients: 0 });
  }

  // Headline product + category mix for the push body.
  const headline = newProducts[0];
  const distinctCategories = Array.from(
    new Set(newProducts.map((p) => p.category)),
  ).slice(0, 3);

  // Buyer cohort: not suspended, has at least one push token (so the bulk
  // call doesn't waste DB hops on devices that can't be reached). We don't
  // exclude sellers/designers — they're buyers too.
  const buyers = await prisma.user.findMany({
    where: {
      suspendedAt: null,
      pushTokens: { some: {} },
    },
    take: MAX_RECIPIENTS,
    select: { id: true },
  });

  if (buyers.length === 0) {
    return NextResponse.json({ ok: true, productsFound: newProducts.length, recipients: 0 });
  }

  const body =
    newProducts.length === 1
      ? `${headline.name} just dropped.`
      : `${headline.name} + ${newProducts.length - 1} more in ${distinctCategories.join(", ")}.`;

  // Fire — sendPushBulk paces through Expo's batching internally.
  const result = await sendPushBulk(
    buyers.map((b) => b.id),
    {
      title: "New on StreekMart",
      body,
      link: "/",
      data: { type: "new-products", since: since.toISOString() },
    },
  );

  return NextResponse.json({
    ok: true,
    productsFound: newProducts.length,
    recipients: buyers.length,
    accepted: result.accepted,
    rejected: result.rejected,
  });
}
