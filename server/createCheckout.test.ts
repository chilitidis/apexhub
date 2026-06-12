import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";
import { TRIAL_DAYS } from "./products";

/**
 * Tests for subscription.createCheckout's trial handling.
 *
 * We mock the Stripe client and the subscription DB helpers so the procedure
 * runs end-to-end without a live Stripe account or database. The single thing
 * under test is whether `subscription_data.trial_period_days` is attached based
 * on the `withTrial` input.
 */

// Capture the params passed to checkout.sessions.create so we can assert on them.
const createSession = vi.fn(async () => ({ url: "https://checkout.stripe.test/session" }));

vi.mock("./_core/stripe", () => ({
  isStripeConfigured: () => true,
  getStripe: () => ({
    // resolvePriceId: configured id resolves directly and is active.
    prices: {
      retrieve: vi.fn(async (id: string) => ({ id, active: true })),
      list: vi.fn(async () => ({ data: [] })),
    },
    // getOrCreateCustomer: existing customer resolves cleanly.
    customers: {
      retrieve: vi.fn(async () => ({ id: "cus_test", deleted: false })),
      create: vi.fn(async () => ({ id: "cus_test" })),
    },
    checkout: {
      sessions: { create: (...args: unknown[]) => createSession(...args) },
    },
  }),
}));

vi.mock("./subscriptionDb", () => ({
  ensureSubscriptionRow: vi.fn(async () => undefined),
  getSubscriptionByUser: vi.fn(async () => ({ stripeCustomerId: "cus_test" })),
  upsertSubscription: vi.fn(async () => undefined),
  subscriptionHasAccess: vi.fn(() => true),
}));

// Import AFTER mocks are registered.
import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 7,
    openId: "checkout-user",
    email: "buyer@example.com",
    name: "Buyer",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function lastSessionArgs() {
  const call = createSession.mock.calls.at(-1);
  return (call?.[0] ?? {}) as {
    subscription_data?: { trial_period_days?: number; metadata?: Record<string, string> };
    metadata?: Record<string, string>;
  };
}

describe("subscription.createCheckout — trial handling", () => {
  beforeEach(() => {
    createSession.mockClear();
  });

  it("attaches the free trial by default (no withTrial flag)", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const res = await caller.subscription.createCheckout({
      origin: "https://ultimatradingjournal.com",
      plan: "monthly",
    });
    expect(res.url).toContain("checkout.stripe.test");

    const args = lastSessionArgs();
    expect(args.subscription_data?.trial_period_days).toBe(TRIAL_DAYS);
    expect(args.subscription_data?.metadata?.with_trial).toBe("true");
    expect(args.metadata?.with_trial).toBe("true");
  });

  it("attaches the free trial when withTrial: true", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await caller.subscription.createCheckout({
      origin: "https://ultimatradingjournal.com",
      plan: "annual",
      withTrial: true,
    });

    const args = lastSessionArgs();
    expect(args.subscription_data?.trial_period_days).toBe(TRIAL_DAYS);
    expect(args.subscription_data?.metadata?.with_trial).toBe("true");
  });

  it("omits the trial entirely when withTrial: false (pay now)", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await caller.subscription.createCheckout({
      origin: "https://ultimatradingjournal.com",
      plan: "semiannual",
      withTrial: false,
    });

    const args = lastSessionArgs();
    expect(args.subscription_data).toBeDefined();
    expect(args.subscription_data?.trial_period_days).toBeUndefined();
    expect("trial_period_days" in (args.subscription_data ?? {})).toBe(false);
    expect(args.subscription_data?.metadata?.with_trial).toBe("false");
    expect(args.metadata?.with_trial).toBe("false");
  });
});
