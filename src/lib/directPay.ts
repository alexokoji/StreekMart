// Direct-pay privilege (pure helpers). An admin switches `directPayEnabled`
// on for a seller; the seller then adds bank details. Only when BOTH are in
// place does the seller count as a direct-pay seller.

export type DirectPayFields = {
  directPayEnabled?: boolean | null;
  directBankCode?: string | null;
  directAccountNumber?: string | null;
  directAccountName?: string | null;
};

/** True when the seller is enabled by an admin AND has bank details on file. */
export function hasDirectPay(u: DirectPayFields | null | undefined): boolean {
  return !!(
    u &&
    u.directPayEnabled &&
    u.directBankCode?.trim() &&
    /^\d{10}$/.test((u.directAccountNumber ?? "").trim()) &&
    u.directAccountName?.trim()
  );
}

/** Nigerian bank account numbers (NUBAN) are exactly 10 digits. */
export function isValidAccountNumber(n: string): boolean {
  return /^\d{10}$/.test(n.trim());
}

/**
 * What a direct-pay sale pays out, in cents.
 *   product revenue − platform cut  +  the delivery fee the seller charged.
 * The platform cut applies to the product amount only (the delivery fee is
 * the seller's own money for delivering). `feeBps` null = use `defaultBps`.
 */
export function directPayoutBreakdown(args: {
  productCents: number;
  deliveryFeeCents: number;
  feeBps: number | null | undefined;
  defaultBps: number;
}): { feeCents: number; payoutCents: number } {
  const bps = args.feeBps ?? args.defaultBps;
  const feeCents = Math.round((args.productCents * Math.max(0, bps)) / 10_000);
  const payoutCents = Math.max(0, args.productCents - feeCents) + Math.max(0, args.deliveryFeeCents);
  return { feeCents, payoutCents };
}

export function maskAccount(n: string): string {
  return n.length <= 4 ? n : "•••• " + n.slice(-4);
}
