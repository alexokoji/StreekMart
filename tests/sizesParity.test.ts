import { describe, expect, it } from "vitest";
import * as web from "../src/lib/sizes";
import * as app from "../mobile/src/lib/sizes";

// The app keeps its own copy of the size rules; this fails if it drifts from
// the website's, so a category can never need sizes on one and not the other.
describe("size rules: website and app agree", () => {
  it("same scales", () => expect(app.SIZE_SCALES).toEqual(web.SIZE_SCALES));
  it("same sized categories", () => expect(app.SIZED_CATEGORIES).toEqual(web.SIZED_CATEGORIES));
  it("shoes get shoe sizes, clothes get clothing sizes", () => {
    expect(app.defaultScaleFor("Shoes")).toBe("shoe-eu");
    expect(app.scaleByValue("shoe-eu").sizes).toContain("42");
    expect(app.defaultScaleFor("Dresses")).toBe("alpha");
    expect(app.defaultScaleFor("Ankara")).toBeNull();
  });
});
