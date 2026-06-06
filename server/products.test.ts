import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getPlan,
  isValidPlanId,
  listPlansForDisplay,
  resolvePriceId,
} from "./products";

const ORIGINAL_KEY = process.env.STRIPE_SECRET_KEY;

afterEach(() => {
  process.env.STRIPE_SECRET_KEY = ORIGINAL_KEY;
});

describe("subscription plans", () => {
  it("exposes three plans", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    const plans = listPlansForDisplay();
    expect(plans.map((p) => p.id).sort()).toEqual(["annual", "monthly", "semiannual"]);
  });

  it("semiannual saves 1 month, annual saves 2 months", () => {
    expect(getPlan("semiannual").freeMonths).toBe(1);
    expect(getPlan("annual").freeMonths).toBe(2);
  });

  it("has the new pricing: monthly 3999, semiannual 19999, annual 39999 (cents)", () => {
    expect(getPlan("monthly").amount).toBe(3999); // €39.99
    expect(getPlan("semiannual").amount).toBe(19999); // €199.99 (save 1 month)
    expect(getPlan("annual").amount).toBe(39999); // €399.99 (save 2 months)
  });

  it("exposes the new display prices", () => {
    expect(getPlan("monthly").displayPrice).toBe("€39.99");
    expect(getPlan("semiannual").displayPrice).toBe("€199.99");
    expect(getPlan("annual").displayPrice).toBe("€399.99");
  });

  it("validates plan ids", () => {
    expect(isValidPlanId("monthly")).toBe(true);
    expect(isValidPlanId("semiannual")).toBe(true);
    expect(isValidPlanId("annual")).toBe(true);
    expect(isValidPlanId("weekly")).toBe(false);
    expect(isValidPlanId(undefined)).toBe(false);
  });

  it("resolves TEST price ids when using a test key", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    expect(resolvePriceId("monthly")).toBe(getPlan("monthly").test);
    expect(resolvePriceId("semiannual")).toBe(getPlan("semiannual").test);
    expect(resolvePriceId("annual")).toBe(getPlan("annual").test);
  });

  it("resolves each plan's own LIVE price when configured, else falls back to monthly live", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_x";
    // Round 51: new live prices are PENDING until created on the live account,
    // so non-monthly plans fall back to the monthly live price.
    for (const id of ["monthly", "semiannual", "annual"] as const) {
      const plan = getPlan(id);
      const expected = plan.live.includes("PENDING")
        ? getPlan("monthly").live
        : plan.live;
      expect(resolvePriceId(id)).toBe(expected);
    }
  });

  it("in live mode, a plan is available only if its live price is not PENDING", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_x";
    const plans = listPlansForDisplay();
    for (const p of plans) {
      const live = getPlan(p.id).live;
      expect(p.available).toBe(!live.includes("PENDING"));
    }
  });

  it("in test mode, all plans are available", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    const plans = listPlansForDisplay();
    expect(plans.every((p) => p.available)).toBe(true);
  });
});
