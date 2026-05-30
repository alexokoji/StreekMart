// Fan-out to every admin whenever something lands in a queue that needs
// human action — verifications, business-name change requests, promotion
// approvals, etc. Sends both email AND push so admins reach the queue
// whether they're at a desk or on their phone.
//
// Fire-and-forget by design: the user's submission shouldn't fail because
// a Resend / Expo Push call hiccuped. Failures are logged so prod
// incidents are debuggable but never block the request.

import { prisma } from "./db";
import { adminAttentionEmail, sendEmail } from "./email";
import { sendPushBulk } from "./notifications";

export type AdminAttentionPayload = {
  // Short label used in the email subject + push title. e.g.
  // "Verification request", "Promotion submission".
  kind: string;
  // One-line "who + what" description shown prominently. e.g.
  // "Ada Lovelace (SELLER) requested Tier 2".
  summary: string;
  // Admin path the email button + push tap deep-link into.
  // e.g. "/admin/verifications".
  link: string;
  // Optional key-value rows surfaced in the email body. Anything useful
  // for triage without opening the page (amount, current value vs.
  // requested value, etc.).
  meta?: Array<{ label: string; value: string }>;
};

/**
 * Notify every active admin. Skips suspended admin accounts so a deactivated
 * admin keeps their email + push silence.
 *
 * @returns nothing — caller should `void` this to make the fire-and-forget
 *          intent explicit at the call site.
 */
export async function notifyAdmins(payload: AdminAttentionPayload): Promise<void> {
  let admins: { id: string; email: string }[] = [];
  try {
    admins = await prisma.user.findMany({
      where: { isAdmin: true, suspendedAt: null },
      select: { id: true, email: true },
    });
  } catch (err) {
    console.error("[admin-notify] couldn't load admins", err);
    return;
  }
  if (admins.length === 0) {
    // Soft warn so a misconfigured deployment (no admins set) shows up
    // in the logs without the user-facing request failing.
    console.warn("[admin-notify] no admins flagged isAdmin:true — alert dropped", payload);
    return;
  }

  // EMAIL — one send per admin so each lands in their personal inbox.
  // We don't BCC because some providers downgrade BCC sends to a higher
  // spam score.
  const tpl = adminAttentionEmail({
    kind: payload.kind,
    summary: payload.summary,
    link: payload.link,
    meta: payload.meta,
  });
  for (const admin of admins) {
    void sendEmail({ to: admin.email, ...tpl })
      .then((r) => {
        if (!r.ok)
          console.error("[admin-notify:email] failed", {
            to: admin.email,
            kind: payload.kind,
            error: r.error,
          });
      })
      .catch((err) =>
        console.error("[admin-notify:email] threw", {
          to: admin.email,
          kind: payload.kind,
          err,
        }),
      );
  }

  // PUSH — bulk to every admin that has a registered device. Cheap
  // because the helper skips users with no PushToken rows.
  void sendPushBulk(
    admins.map((a) => a.id),
    {
      title: payload.kind,
      body: payload.summary,
      link: payload.link,
      data: { type: "admin-attention", kind: payload.kind },
    },
  ).catch((err) =>
    console.error("[admin-notify:push] threw", { kind: payload.kind, err }),
  );
}

/**
 * Convenience wrapper for promotion submissions that just hit PENDING_REVIEW.
 * Called from every webhook + stub path that flips a promotion into the
 * admin queue. Looks up the owner + product so the email has useful context.
 */
export async function notifyAdminsOfPromotionReview(paymentReference: string): Promise<void> {
  let promos: Array<{
    id: string;
    priceCents: number;
    owner: { name: string; email: string } | null;
    product: { name: string } | null;
    post: { title: string } | null;
  }> = [];
  try {
    promos = await prisma.promotion.findMany({
      where: { paymentReference, status: "PENDING_REVIEW" },
      select: {
        id: true,
        priceCents: true,
        owner: { select: { name: true, email: true } },
        product: { select: { name: true } },
        post: { select: { title: true } },
      },
    });
  } catch (err) {
    console.error("[admin-notify:promotion] couldn't load promo", { paymentReference, err });
    return;
  }
  for (const p of promos) {
    const subject = p.product?.name ?? p.post?.title ?? "an item";
    const owner = p.owner?.name ?? "A seller";
    void notifyAdmins({
      kind: "Promotion submission",
      summary: `${owner} promoted ${subject}`,
      link: "/admin/promotions",
      meta: [
        { label: "Owner", value: `${owner}${p.owner?.email ? ` · ${p.owner.email}` : ""}` },
        { label: "Subject", value: subject },
        { label: "Fee paid", value: `₦${(p.priceCents / 100).toLocaleString("en-NG")}` },
      ],
    });
  }
}
