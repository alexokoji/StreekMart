// Korapay bank services: the list of banks, account-name verification, and
// payouts (disbursements) to a bank account.
//
// Everything here runs only when Korapay is live (KORAPAY_LIVE=1 with a
// secret key). In test mode the functions report that verification isn't
// available and payouts are simulated by the caller, so development keeps
// working without real credentials.

const FALLBACK_TTL_MS = 6 * 60 * 60 * 1000;

export function isKorapayLive(): boolean {
  return process.env.KORAPAY_LIVE === "1" && !!process.env.KORAPAY_SECRET_KEY;
}

function base(): string {
  return process.env.KORAPAY_BASE_URL ?? "https://api.korapay.com/merchant/api/v1";
}

async function kora(path: string, init: { method?: string; body?: unknown } = {}): Promise<any> {
  const res = await fetch(`${base()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${process.env.KORAPAY_SECRET_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* handled below */
  }
  if (!res.ok || json?.status === false) {
    const msg = json?.message ?? `Korapay ${res.status}`;
    const err = new Error(String(msg).slice(0, 200)) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return json;
}

export type Bank = { code: string; name: string };

let bankCache: { at: number; banks: Bank[] } | null = null;

/** Banks Korapay can pay out to, A to Z. Cached for a few hours. */
export async function listKorapayBanks(): Promise<Bank[]> {
  if (bankCache && Date.now() - bankCache.at < FALLBACK_TTL_MS) return bankCache.banks;
  const json = await kora("/misc/banks");
  const rows: any[] = Array.isArray(json?.data) ? json.data : [];
  const banks = rows
    .filter((b) => b?.code && b?.name && (!b.country || String(b.country).toUpperCase().startsWith("NG")))
    .map((b) => ({ code: String(b.code), name: String(b.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (banks.length > 0) bankCache = { at: Date.now(), banks };
  return banks;
}

export type ResolveResult =
  | { ok: true; accountName: string; bankName?: string }
  | { ok: false; error: string; unavailable?: boolean };

/**
 * Ask the bank (through Korapay) who owns an account. Returns the name the
 * BANK has on file, so the account name never has to be typed.
 */
export async function resolveBankAccount(bankCode: string, accountNumber: string): Promise<ResolveResult> {
  if (!isKorapayLive()) {
    return { ok: false, unavailable: true, error: "Account verification isn't available in test mode." };
  }
  if (!/^\d{10}$/.test(accountNumber)) return { ok: false, error: "Account numbers are 10 digits." };
  try {
    const json = await kora("/misc/banks/resolve", {
      method: "POST",
      body: { bank: bankCode, account: accountNumber, currency: "NGN" },
    });
    const name = String(json?.data?.account_name ?? "").trim();
    if (!name) return { ok: false, error: "We couldn't find an account with those details." };
    return { ok: true, accountName: name, bankName: json?.data?.bank_name };
  } catch (e) {
    const err = e as Error & { status?: number };
    if (err.status && err.status >= 500) {
      return { ok: false, unavailable: true, error: "The bank didn't respond. Try again in a moment." };
    }
    return { ok: false, error: "We couldn't find an account with those details. Check the bank and number." };
  }
}

export type TransferResult = { status: "PAID" | "PROCESSING" | "FAILED"; externalReference?: string; message?: string };

/** Send money to a bank account. `reference` must be unique per transfer. */
export async function korapayDisburse(input: {
  amountCents: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  reference: string;
  narration: string;
  customerEmail: string;
}): Promise<TransferResult> {
  const json = await kora("/transactions/disburse", {
    method: "POST",
    body: {
      reference: input.reference,
      destination: {
        type: "bank_account",
        amount: input.amountCents / 100,
        currency: "NGN",
        narration: input.narration.slice(0, 100),
        bank_account: { bank: input.bankCode, account: input.accountNumber },
        customer: { name: input.accountName, email: input.customerEmail },
      },
    },
  });
  const d = json?.data ?? {};
  return {
    status: mapTransferStatus(d.status),
    externalReference: d.reference ?? input.reference,
    message: json?.message,
  };
}

export function mapTransferStatus(s: unknown): "PAID" | "PROCESSING" | "FAILED" {
  const v = String(s ?? "").toLowerCase();
  if (v === "success" || v === "successful" || v === "completed") return "PAID";
  if (v === "failed" || v === "declined" || v === "reversed") return "FAILED";
  return "PROCESSING";
}
