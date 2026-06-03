import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the db helpers so we can assert on the patch passed to upsertSubscription
// without needing a live database.
const upsertSubscription = vi.fn();
const getSubscriptionByCustomer = vi.fn();

vi.mock("./subscriptionDb", () => ({
  upsertSubscription: (...args: unknown[]) => upsertSubscription(...args),
  getSubscriptionByCustomer: (...args: unknown[]) => getSubscriptionByCustomer(...args),
  getSubscriptionByUser: vi.fn(),
}));

// Avoid constructing a real Stripe client (no key in test env).
vi.mock("./_core/stripe", () => ({
  getStripe: () => ({
    customers: { retrieve: vi.fn() },
  }),
}));

import { syncSubscription } from "./stripeWebhook";

const TRIAL_END = Math.floor(Date.now() / 1000) + 7 * 86400;
const PERIOD_END = Math.floor(Date.now() / 1000) + 30 * 86400;

function makeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_123",
    status: "trialing",
    customer: "cus_123",
    cancel_at_period_end: false,
    trial_end: TRIAL_END,
    metadata: { user_id: "42" },
    items: { data: [{ current_period_end: PERIOD_END }] },
    ...overrides,
  } as never;
}

describe("syncSubscription", () => {
  beforeEach(() => {
    upsertSubscription.mockReset();
    getSubscriptionByCustomer.mockReset();
  });

  it("resolves userId from subscription metadata and maps trialing state", async () => {
    await syncSubscription(makeSub());

    expect(upsertSubscription).toHaveBeenCalledTimes(1);
    const [userId, patch] = upsertSubscription.mock.calls[0];
    expect(userId).toBe(42);
    expect(patch.stripeCustomerId).toBe("cus_123");
    expect(patch.stripeSubscriptionId).toBe("sub_123");
    expect(patch.status).toBe("trialing");
    expect(patch.cancelAtPeriodEnd).toBe(false);
    expect(patch.trialEnd).toBeInstanceOf(Date);
    expect(patch.currentPeriodEnd).toBeInstanceOf(Date);
    // trialEnd should reflect the unix seconds → ms conversion
    expect(patch.trialEnd!.getTime()).toBe(TRIAL_END * 1000);
  });

  it("falls back to the customer row when metadata is missing", async () => {
    getSubscriptionByCustomer.mockResolvedValue({ userId: 99 });
    await syncSubscription(makeSub({ metadata: {} }));

    expect(getSubscriptionByCustomer).toHaveBeenCalledWith("cus_123");
    const [userId] = upsertSubscription.mock.calls[0];
    expect(userId).toBe(99);
  });

  it("maps canceled status through unchanged", async () => {
    await syncSubscription(makeSub({ status: "canceled", cancel_at_period_end: true }));
    const [, patch] = upsertSubscription.mock.calls[0];
    expect(patch.status).toBe("canceled");
    expect(patch.cancelAtPeriodEnd).toBe(true);
  });

  it("does not upsert when no userId can be resolved", async () => {
    getSubscriptionByCustomer.mockResolvedValue(null);
    await syncSubscription(makeSub({ metadata: {} }));
    expect(upsertSubscription).not.toHaveBeenCalled();
  });

  it("reads current_period_end from the top-level field when item lacks it", async () => {
    await syncSubscription(
      makeSub({
        items: { data: [{}] },
        current_period_end: PERIOD_END,
      }),
    );
    const [, patch] = upsertSubscription.mock.calls[0];
    expect(patch.currentPeriodEnd!.getTime()).toBe(PERIOD_END * 1000);
  });
});
