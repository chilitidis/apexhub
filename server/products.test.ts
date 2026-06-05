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

  it("resolves each plan's own LIVE price when using a live key (all configured)", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_x";
    expect(resolvePriceId("monthly")).toBe(getPlan("monthly").live);
    expect(resolvePriceId("semiannual")).toBe(getPlan("semiannual").live);
    expect(resolvePriceId("annual")).toBe(getPlan("annual").live);
  });

  it("never returns a PENDING placeholder for any live price", () => {
    expect(getPlan("semiannual").live.includes("PENDING")).toBe(false);
    expect(getPlan("annual").live.includes("PENDING")).toBe(false);
  });

  it("in live mode, all plans with a real live price are available", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_x";
    const plans = listPlansForDisplay();
    expect(plans.every((p) => p.available)).toBe(true);
  });

  it("in test mode, all plans are available", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    const plans = listPlansForDisplay();
    expect(plans.every((p) => p.available)).toBe(true);
  });
});
