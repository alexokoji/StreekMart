// WhatsApp Cloud API helper.
//
// Talks to Meta's Graph API for the WhatsApp Business Platform. Free up
// to 1,000 business-initiated conversations / month (user-initiated ones
// like our concierge replies are free in unlimited volume on a 24-hour
// service window) — see https://business.whatsapp.com/products/platform-pricing.
//
// Setup:
//   1. Create a Meta Business app at developers.facebook.com.
//   2. Add the "WhatsApp" product, accept the terms.
//   3. Note the test phone number ID + permanent access token.
//   4. Set the webhook URL to https://streekmart.com/api/whatsapp/webhook
//      and configure the verify token to match WHATSAPP_VERIFY_TOKEN.
//   5. Subscribe to the `messages` webhook field.
//
// All requests are server-side — never expose WHATSAPP_ACCESS_TOKEN to
// the client.

import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH_VERSION = "v18.0";

export function isWhatsAppEnabled(): boolean {
  return !!(
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_VERIFY_TOKEN
  );
}

/**
 * Send a plain-text message back to a sender. `to` is the WhatsApp phone
 * id Meta gives us in the inbound webhook payload — already in the
 * "263772XXXXX" digits-only form, no leading `+`.
 *
 * URLs in `body` are auto-previewed by WhatsApp clients — that's how
 * product links render as cards with the image + title.
 */
export async function sendWhatsAppText(args: {
  to: string;
  body: string;
}): Promise<{ ok: boolean; externalId?: string; error?: string }> {
  if (!isWhatsAppEnabled()) {
    console.warn(
      "[whatsapp:stub] WhatsApp env vars not set — message dropped.",
      { to: args.to, preview: args.body.slice(0, 80) },
    );
    return { ok: true, externalId: `stub-${Date.now()}` };
  }
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const token = process.env.WHATSAPP_ACCESS_TOKEN!;
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: args.to,
          type: "text",
          text: {
            preview_url: true,
            body: args.body,
          },
        }),
      },
    );
    const data = (await res.json()) as {
      messages?: Array<{ id: string }>;
      error?: { message: string };
    };
    if (!res.ok || data.error) {
      const msg = data.error?.message ?? `HTTP ${res.status}`;
      console.error("[whatsapp:send] failed", { to: args.to, error: msg });
      return { ok: false, error: msg };
    }
    return { ok: true, externalId: data.messages?.[0]?.id };
  } catch (err) {
    console.error("[whatsapp:send] threw", { to: args.to, err });
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown send failure",
    };
  }
}

/**
 * Verify Meta's webhook signature header (`x-hub-signature-256`).
 * Returns true on match OR when WHATSAPP_APP_SECRET isn't set (dev mode).
 *
 * Meta signs the raw POST body with HMAC-SHA256 using the app secret;
 * we recompute and constant-time compare. Read the raw body BEFORE
 * `req.json()` because once we parse it the original bytes are gone.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // dev / not configured — accept
  if (!signatureHeader) return false;
  // Header is "sha256=<hex>"; strip the prefix.
  const expectedHex = signatureHeader.replace(/^sha256=/, "");
  const computed = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expectedHex, "hex"), Buffer.from(computed, "hex"));
  } catch {
    return false;
  }
}
