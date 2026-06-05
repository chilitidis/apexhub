import { describe, expect, it, vi, beforeEach } from "vitest";
import { subscriptionHasAccess } from "./subscriptionDb";
import type { SubscriptionRow } from "../drizzle/schema";

function makeRow(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: 1,
    userId: 1,
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: "sub_1",
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 86400000),
    trialEnd: null,
    cancelAtPeriodEnd: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as SubscriptionRow;
}

describe("subscriptionHasAccess", () => {
  it("grants access while active", () => {
    expect(subscriptionHasAccess(makeRow({ status: "active" }))).toBe(true);
  });

  it("grants access while trialing", () => {
    expect(subscriptionHasAccess(makeRow({ status: "trialing" }))).toBe(true);
  });

  it("denies access when canceled", () => {
    expect(subscriptionHasAccess(makeRow({ status: "canceled" }))).toBe(false);
  });

  it("denies access when past_due", () => {
    expect(subscriptionHasAccess(makeRow({ status: "past_due" }))).toBe(false);
  });

  it("denies access when unpaid / incomplete", () => {
    expect(subscriptionHasAccess(makeRow({ status: "unpaid" }))).toBe(false);
    expect(subscriptionHasAccess(makeRow({ status: "incomplete" }))).toBe(false);
  });

  it("denies access when there is no row at all", () => {
    expect(subscriptionHasAccess(null)).toBe(false);
  });

  it("denies access for the default 'none' status", () => {
    expect(subscriptionHasAccess(makeRow({ status: "none" }))).toBe(false);
  });
});

import { isMissingCustomerError } from "./subscriptionRouter";

describe("isMissingCustomerError", () => {
  it("detects Stripe resource_missing code", () => {
    expect(isMissingCustomerError({ code: "resource_missing" })).toBe(true);
  });

  it("detects 'No such customer' message (wrong-mode customer id)", () => {
    expect(
      isMissingCustomerError({ message: "No such customer: 'cus_UdPnmpV0XPAVgN'" }),
    ).toBe(true);
  });

  it("is case-insensitive on the message", () => {
    expect(isMissingCustomerError({ message: "no such CUSTOMER: cus_x" })).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isMissingCustomerError({ code: "rate_limit" })).toBe(false);
    expect(isMissingCustomerError({ message: "Some other failure" })).toBe(false);
    expect(isMissingCustomerError(null)).toBe(false);
    expect(isMissingCustomerError(undefined)).toBe(false);
  });
});
