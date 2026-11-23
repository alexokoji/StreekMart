import { describe, expect, it } from "vitest";
import {
  effectiveMarkup,
  marginPercent,
  sellPrice,
} from "../src/lib/suppliers/pricing";

describe("sellPrice", () => {
  it("adds a percentage markup and rounds up", () => {
    expect(sellPrice(1000, { type: "PERCENT", value: 25 })).toBe(1250);
    expect(sellPrice(999, { type: "PERCENT", value: 25 })).toBe(1249); // 1248.75 -> 1249
  });
  it("adds a fixed naira markup", () => {
    expect(sellPrice(4500, { type: "FIXED", value: 1500 })).toBe(6000);
  });
  it("never goes below cost on bad input", () => {
    expect(sellPrice(1000, { type: "PERCENT", value: -50 })).toBe(1000);
    expect(sellPrice(-5, { type: "PERCENT", value: 10 })).toBe(0);
  });
  it("is not thrown off by float noise", () => {
    expect(sellPrice(100, { type: "PERCENT", value: 10 })).toBe(110);
  });
});

describe("effectiveMarkup", () => {
  const supplier = { markupType: "PERCENT", markupValue: 20 };
  it("uses supplier default", () => {
    expect(effectiveMarkup(supplier)).toEqual({ type: "PERCENT", value: 20 });
  });
  it("prefers a complete per-product override", () => {
    expect(effectiveMarkup(supplier, { markupType: "FIXED", markupValue: 500 })).toEqual({
      type: "FIXED",
      value: 500,
    });
  });
  it("ignores an incomplete override", () => {
    expect(effectiveMarkup(supplier, { markupType: "FIXED", markupValue: null })).toEqual({
      type: "PERCENT",
      value: 20,
    });
  });
});

describe("marginPercent", () => {
  it("is profit over price", () => {
    expect(marginPercent(750, 1000)).toBe(25);
    expect(marginPercent(0, 0)).toBe(0);
  });
});
