import { describe, expect, it } from "vitest";
import { directPayoutBreakdown, hasDirectPay, isValidAccountNumber, maskAccount } from "../src/lib/directPay";

const ok = { directPayEnabled: true, directBankCode: "058", directAccountNumber: "0123456789", directAccountName: "Ada Atelier" };

describe("hasDirectPay", () => {
  it("needs the admin switch AND complete bank details", () => {
    expect(hasDirectPay(ok)).toBe(true);
    expect(hasDirectPay({ ...ok, directPayEnabled: false })).toBe(false); // seller can't self-enable
    expect(hasDirectPay({ ...ok, directBankCode: "" })).toBe(false);
    expect(hasDirectPay({ ...ok, directAccountNumber: "12345" })).toBe(false);
    expect(hasDirectPay({ ...ok, directAccountName: " " })).toBe(false);
    expect(hasDirectPay(null)).toBe(false);
  });
});

describe("account numbers", () => {
  it("must be 10 digits", () => {
    expect(isValidAccountNumber("0123456789")).toBe(true);
    expect(isValidAccountNumber("012345678")).toBe(false);
    expect(isValidAccountNumber("01234567890")).toBe(false);
    expect(isValidAccountNumber("01234abcde")).toBe(false);
    expect(maskAccount("0123456789")).toBe("•••• 6789");
  });
});

describe("directPayoutBreakdown", () => {
  it("pays product revenue minus the cut, plus the whole delivery fee", () => {
    // ₦10,000 of goods + ₦1,500 delivery, 5% cut on goods only.
    expect(directPayoutBreakdown({ productCents: 1_000_000, deliveryFeeCents: 150_000, feeBps: 500, defaultBps: 0 }))
      .toEqual({ feeCents: 50_000, payoutCents: 1_100_000 });
  });
  it("uses the platform default when the seller has no override", () => {
    expect(directPayoutBreakdown({ productCents: 200_000, deliveryFeeCents: 0, feeBps: null, defaultBps: 250 }))
      .toEqual({ feeCents: 5_000, payoutCents: 195_000 });
  });
  it("an override of 0 means no cut, not the default", () => {
    expect(directPayoutBreakdown({ productCents: 200_000, deliveryFeeCents: 0, feeBps: 0, defaultBps: 250 }).feeCents).toBe(0);
  });
  it("never pays out a negative amount", () => {
    expect(directPayoutBreakdown({ productCents: 0, deliveryFeeCents: 0, feeBps: 1000, defaultBps: 0 }).payoutCents).toBe(0);
  });
});
