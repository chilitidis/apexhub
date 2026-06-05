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

  it("6-month price equals 5x monthly, 12-month equals 10x monthly", () => {
    expect(getPlan("semiannual").amount).toBe(2999 * 5); // 14995
    expect(getPlan("annual").amount).toBe(2999 * 10); // 29990
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

  it("falls back to monthly live price when a plan's live price is still pending", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_x";
    // semiannual/annual live prices are PENDING until created -> fall back to monthly live
    expect(resolvePriceId("semiannual")).toBe(getPlan("monthly").live);
    expect(resolvePriceId("annual")).toBe(getPlan("monthly").live);
    expect(resolvePriceId("monthly")).toBe(getPlan("monthly").live);
  });

  it("in live mode, only plans with a real live price are marked available", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_x";
    const plans = listPlansForDisplay();
    const monthly = plans.find((p) => p.id === "monthly")!;
    const semi = plans.find((p) => p.id === "semiannual")!;
    expect(monthly.available).toBe(true);
    // pending live price -> not available in live mode yet
    expect(semi.available).toBe(false);
  });

  it("in test mode, all plans are available", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    const plans = listPlansForDisplay();
    expect(plans.every((p) => p.available)).toBe(true);
  });
});
