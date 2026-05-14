// Monnify payment + disbursement adapter.
//
// This module sits behind the wallet/checkout/payout endpoints and offers a
// uniform interface regardless of whether MONNIFY_LIVE is on or off.
//
//   MONNIFY_LIVE !== "1"  → STUB MODE  (default — used in dev / CI)
//     Calls return synthetic success responses. The wallet ledger records
//     transactions exactly as if Monnify processed them. Lets the UI flow
//     work end-to-end without real credentials.
//
//   MONNIFY_LIVE === "1"  → LIVE MODE
//     Calls hit the real Monnify API using the env vars below. You'll also
//     need to expose /api/monnify/webhook and configure it in the Monnify
//     dashboard for asynchronous payment / disbursement events.
//
// Required env (live mode):
//   MONNIFY_API_KEY        — public API key
//   MONNIFY_SECRET_KEY     — secret key used for the auth Basic header
//   MONNIFY_CONTRACT_CODE  — contract code from the dashboard
//   MONNIFY_WALLET_ID      — funding wallet for disbursements
//   MONNIFY_BASE_URL       — defaults to https://sandbox.monnify.com
//   MONNIFY_WEBHOOK_HASH   — secret used to verify webhook signatures

import { randomBytes } from "node:crypto";

export const PLATFORM_FEE_BPS = 0;       // 2.50% of every sale → platform
export const WITHDRAWAL_FEE_FLAT_CENTS = 0;   // No flat fee.
export const WITHDRAWAL_FEE_BPS = 200;        // 2.00% of withdrawn amount

export type InitTransactionInput = {
  amountCents: number;
  customerEmail: string;
  customerName: string;
  description: string;
  paymentReference: string; // your idempotency key
  redirectUrl: string;
};

export type InitTransactionResult = {
  transactionReference: string;
  paymentReference: string;
  checkoutUrl: string;
};

export type DisburseInput = {
  amountCents: number;
  destinationAccountNumber: string;
  destinationBankCode: string;
  reference: string;        // your idempotency key
  narration: string;
};

export type DisburseResult = {
  reference: string;
  externalReference: string;
  status: "PENDING" | "PROCESSING" | "PAID" | "FAILED";
  message?: string;
};

export function isLiveMode(): boolean {
  return process.env.MONNIFY_LIVE === "1";
}

// --------------------- Public API ---------------------

export async function initTransaction(
  input: InitTransactionInput,
): Promise<InitTransactionResult> {
  if (!isLiveMode()) return stubInit(input);
  const token = await getAccessToken();
  const res = await monnifyFetch("/api/v1/merchant/transactions/init-transaction", {
    method: "POST",
    token,
    body: {
      amount: input.amountCents / 100,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      paymentReference: input.paymentReference,
      paymentDescription: input.description,
      currencyCode: "NGN",
      contractCode: requireEnv("MONNIFY_CONTRACT_CODE"),
      redirectUrl: input.redirectUrl,
      paymentMethods: ["CARD", "ACCOUNT_TRANSFER", "USSD"],
    },
  });
  const body = res.responseBody;
  return {
    transactionReference: body.transactionReference,
    paymentReference: body.paymentReference,
    checkoutUrl: body.checkoutUrl,
  };
}

export async function disburse(input: DisburseInput): Promise<DisburseResult> {
  if (!isLiveMode()) return stubDisburse(input);
  const token = await getAccessToken();
  const res = await monnifyFetch("/api/v2/disbursements/single", {
    method: "POST",
    token,
    body: {
      amount: input.amountCents / 100,
      reference: input.reference,
      narration: input.narration,
      destinationBankCode: input.destinationBankCode,
      destinationAccountNumber: input.destinationAccountNumber,
      currency: "NGN",
      sourceAccountNumber: requireEnv("MONNIFY_WALLET_ID"),
    },
  });
  const body = res.responseBody;
  return {
    reference: input.reference,
    externalReference: body.reference ?? body.transactionReference,
    status: mapDisburseStatus(body.status),
    message: body.message,
  };
}

// Verify a Monnify webhook signature (TRANSACTION-HASH header).
// In live mode call this from /api/monnify/webhook before trusting the body.
export function verifyWebhookHash(rawBody: string, headerHash: string): boolean {
  const secret = process.env.MONNIFY_WEBHOOK_HASH;
  if (!secret) return false;
  // Monnify uses SHA-512 HMAC.
  const crypto = require("node:crypto") as typeof import("node:crypto");
  const expected = crypto
    .createHmac("sha512", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  return timingSafeEqual(expected, headerHash);
}

// --------------------- Internals ---------------------

let _cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (_cachedToken && _cachedToken.expiresAt - 30_000 > Date.now()) return _cachedToken.token;
  const apiKey = requireEnv("MONNIFY_API_KEY");
  const secret = requireEnv("MONNIFY_SECRET_KEY");
  const auth = Buffer.from(`${apiKey}:${secret}`).toString("base64");
  const url = `${baseUrl()}/api/v1/auth/login`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Monnify auth failed: ${res.status}`);
  const data = (await res.json()) as { responseBody: { accessToken: string; expiresIn: number } };
  _cachedToken = {
    token: data.responseBody.accessToken,
    expiresAt: Date.now() + data.responseBody.expiresIn * 1000,
  };
  return _cachedToken.token;
}

async function monnifyFetch(path: string, init: { method: string; token: string; body: unknown }) {
  const url = `${baseUrl()}${path}`;
  const res = await fetch(url, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${init.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(init.body),
  });
  const json = (await res.json().catch(() => ({}))) as { responseBody?: any; responseMessage?: string };
  if (!res.ok || !json.responseBody) {
    throw new Error(json.responseMessage ?? `Monnify request failed (${res.status})`);
  }
  return json as { responseBody: any; responseMessage: string };
}

function baseUrl(): string {
  return process.env.MONNIFY_BASE_URL ?? "https://sandbox.monnify.com";
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function mapDisburseStatus(s: string | undefined): DisburseResult["status"] {
  switch (s) {
    case "SUCCESS":
    case "PAID":
      return "PAID";
    case "FAILED":
    case "REJECTED":
      return "FAILED";
    case "PROCESSING":
      return "PROCESSING";
    default:
      return "PENDING";
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// --------------------- Stub mode ---------------------

function stubInit(input: InitTransactionInput): InitTransactionResult {
  const ref = `STUB_${randomBytes(6).toString("hex").toUpperCase()}`;
  return {
    transactionReference: ref,
    paymentReference: input.paymentReference,
    // Local "checkout simulator" page — see /api/monnify/stub-confirm.
    checkoutUrl: `/cart/checkout?stubRef=${encodeURIComponent(ref)}`,
  };
}

function stubDisburse(input: DisburseInput): DisburseResult {
  return {
    reference: input.reference,
    externalReference: `STUB_DIS_${randomBytes(6).toString("hex").toUpperCase()}`,
    status: "PAID",
    message: "Stub disbursement — no real funds moved.",
  };
}
