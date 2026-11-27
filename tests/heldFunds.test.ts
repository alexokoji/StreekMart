import { describe, expect, it } from "vitest";
import { heldCentsFor, productCentsOf } from "../src/lib/wallet";

const order = (o: Partial<{ totalPrice: number; deliveryFeeCents: number; directPayout: boolean; heldCents: number }> = {}) => ({
  totalPrice: 12000, deliveryFeeCents: 200000, directPayout: false, heldCents: 0, ...o,
});

describe("held (escrow) amounts", () => {
  it("never include the delivery fee", () => {
    // ₦12,000 paid = ₦10,000 goods + ₦2,000 delivery.
    expect(productCentsOf(order())).toBe(1_000_000);
    expect(heldCentsFor(order(), false)).toBe(1_000_000); // platform cut is 0 today
  });
  it("use the exact amount recorded at payment when there is one", () => {
    expect(heldCentsFor(order({ heldCents: 950_000 }), false)).toBe(950_000);
  });
  it("are zero for sellers who bypass escrow (affiliated) and for direct-pay orders", () => {
    expect(heldCentsFor(order(), true)).toBe(0);
    expect(heldCentsFor(order({ directPayout: true }), false)).toBe(0);
    expect(heldCentsFor(order({ heldCents: 5 }), true)).toBe(0);
  });
});
