// Parser + verifier for Meta's `signed_request` envelope.
//
// Used by the Data Deletion Callback (and the Deauthorize Callback, if we
// ever add one). Meta POSTs `signed_request=<sig>.<payload>` as
// `application/x-www-form-urlencoded`; both halves are base64url-encoded.
// The signature is HMAC-SHA256 of the encoded payload, keyed with the
// app's secret.
//
// Doc: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback

import { createHmac, timingSafeEqual } from "node:crypto";

export type MetaSignedRequestPayload = {
  // Algorithm — Meta uses "HMAC-SHA256". We reject anything else.
  algorithm: string;
  // Unix seconds since epoch when the request was issued.
  issued_at?: number;
  // The Meta-internal user identifier whose data should be deleted.
  // Opaque from our side — we only get back what they sent.
  user_id: string;
};

export type SignedRequestResult =
  | { ok: true; payload: MetaSignedRequestPayload }
  | { ok: false; error: string };

/**
 * Parse + verify a signed_request string. Returns `{ ok: true, payload }`
 * on success or `{ ok: false, error }` on any verification failure.
 *
 * In dev (WHATSAPP_APP_SECRET unset) we still parse the payload so the
 * endpoint is testable, but flag the result with `error: "dev"` so the
 * caller can log that signature validation was skipped.
 */
export function verifySignedRequest(signedRequest: string): SignedRequestResult {
  if (!signedRequest || typeof signedRequest !== "string") {
    return { ok: false, error: "Missing signed_request." };
  }
  const parts = signedRequest.split(".");
  if (parts.length !== 2) {
    return { ok: false, error: "Malformed signed_request." };
  }
  const [encodedSig, encodedPayload] = parts;

  let payload: MetaSignedRequestPayload;
  try {
    const json = Buffer.from(base64UrlToBase64(encodedPayload), "base64").toString("utf8");
    payload = JSON.parse(json) as MetaSignedRequestPayload;
  } catch {
    return { ok: false, error: "Payload isn't valid JSON." };
  }
  if (payload.algorithm !== "HMAC-SHA256") {
    return { ok: false, error: `Unsupported algorithm: ${payload.algorithm}` };
  }
  if (!payload.user_id) {
    return { ok: false, error: "Payload missing user_id." };
  }

  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) {
    // Dev mode — accept but tag the result so the caller knows.
    return { ok: true, payload };
  }

  const expected = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest();
  const provided = Buffer.from(base64UrlToBase64(encodedSig), "base64");
  if (expected.length !== provided.length) {
    return { ok: false, error: "Signature length mismatch." };
  }
  try {
    if (!timingSafeEqual(expected, provided)) {
      return { ok: false, error: "Signature mismatch." };
    }
  } catch {
    return { ok: false, error: "Signature compare failed." };
  }

  return { ok: true, payload };
}

// Meta uses base64url (`-` and `_` instead of `+` and `/`, no padding).
// Node's Buffer.from(_, "base64") wants standard base64 with `=` padding.
function base64UrlToBase64(s: string): string {
  const padded = s.padEnd(s.length + ((4 - (s.length % 4)) % 4), "=");
  return padded.replace(/-/g, "+").replace(/_/g, "/");
}
