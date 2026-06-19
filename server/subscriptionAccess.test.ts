import { describe, it, expect } from "vitest";
import { subscriptionHasAccess } from "./subscriptionDb";
import type { SubscriptionRow } from "../drizzle/schema";

/**
 * Access-control contract for the paywall gate.
 *
 * Only `trialing` and `active` subscriptions grant access. Every other status —
 * crucially `past_due`, `unpaid`, `canceled`, `incomplete` and `none` — must be
 * denied so those users are redirected to /pricing and cannot reach any tool
 * until they pay. This test locks that behavior so a future refactor can't
 * silently let a past-due user back into the app.
 */
function row(status: string): SubscriptionRow {
  return {
    id: 1,
    userId: 1,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    status,
    currentPeriodEnd: null,
    trialEnd: null,
    cancelAtPeriodEnd: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as SubscriptionRow;
}

describe("subscriptionHasAccess", () => {
  it("grants access for active and trialing", () => {
    expect(subscriptionHasAccess(row("active"))).toBe(true);
    expect(subscriptionHasAccess(row("trialing"))).toBe(true);
  });

  it("denies access for lapsed / owed / new statuses", () => {
    for (const status of [
      "past_due",
      "unpaid",
      "canceled",
      "incomplete",
      "incomplete_expired",
      "none",
      "paused",
    ]) {
      expect(subscriptionHasAccess(row(status))).toBe(false);
    }
  });

  it("denies access when there is no subscription row", () => {
    expect(subscriptionHasAccess(null)).toBe(false);
  });
});
