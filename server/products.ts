/**
 * Centralized subscription product configuration.
 *
 * Prices are created in the owner's Stripe account via:
 *   - scripts/setupStripeProduct.mjs / setupLiveStripe.mjs  (monthly)
 *   - scripts/setupPlanPrices.mjs                           (6-month + 12-month)
 *
 * The correct price ID is selected at runtime based on whether the active
 * STRIPE_SECRET_KEY is a live key (sk_live_...) or a test key (sk_test_...),
 * so switching between test and live keys "just works" without code edits.
 */

const PRODUCT = {
  test: "prod_UdPXNFOtejXfWy",
  live: "prod_UdQKdWU2Cp8Ej6",
} as const;

export type PlanId = "monthly" | "semiannual" | "annual";

type PlanDef = {
  id: PlanId;
  /** Stripe price IDs per mode. */
  test: string;
  live: string;
  lookupKey: string;
  amount: number; // in cents
  currency: "eur";
  /** Billing interval for display logic. */
  intervalMonths: number;
  displayPrice: string;
  /** Equivalent per-month price for comparison UI. */
  perMonth: number; // cents
  /** Number of free months vs paying monthly for the same span. */
  freeMonths: number;
  name: string;
  /** Marketing label. */
  badge?: string;
};

function isLiveKey(): boolean {
  return (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live_");
}

/**
 * LIVE price IDs.
 * monthly is already live. The 6/12-month live prices must be created by running
 *   LIVE_SK=sk_live_... node scripts/setupPlanPrices.mjs
 * and pasting the resulting IDs below. Until then they fall back to the monthly
 * live price so production never breaks (selector will still default to monthly).
 */
const LIVE_MONTHLY = "price_1Te9TcIAIUEpIzIzXbWkwCn9";
const LIVE_SEMIANNUAL = "price_1Tf6r6IAIUEpIzIzGfHFDHRF";
const LIVE_ANNUAL = "price_1Tf6r7IAIUEpIzIzsprqFvUe";

const PLANS: Record<PlanId, PlanDef> = {
  monthly: {
    id: "monthly",
    test: "price_1Te8ij4lJKN2HEWbHprECmPK",
    live: LIVE_MONTHLY,
    lookupKey: "utj_monthly_2999_eur",
    amount: 2999,
    currency: "eur",
    intervalMonths: 1,
    displayPrice: "€29.99",
    perMonth: 2999,
    freeMonths: 0,
    name: "Ultimate Trading Journal — Pro (Μηνιαίο)",
  },
  semiannual: {
    id: "semiannual",
    test: "price_1Tf6jS4lJKN2HEWbRGyaOAgD",
    live: LIVE_SEMIANNUAL,
    lookupKey: "utj_semiannual_14995_eur",
    amount: 14995,
    currency: "eur",
    intervalMonths: 6,
    displayPrice: "€149.95",
    perMonth: 2499, // 149.95 / 6 ≈ 24.99
    freeMonths: 1,
    name: "Ultimate Trading Journal — Pro (Εξάμηνο)",
    badge: "1 μήνας δωρεάν",
  },
  annual: {
    id: "annual",
    test: "price_1Tf6jS4lJKN2HEWbBU1FTzji",
    live: LIVE_ANNUAL,
    lookupKey: "utj_annual_29990_eur",
    amount: 29990,
    currency: "eur",
    intervalMonths: 12,
    displayPrice: "€299.90",
    perMonth: 2499, // 299.90 / 12 ≈ 24.99
    freeMonths: 2,
    name: "Ultimate Trading Journal — Pro (Ετήσιο)",
    badge: "2 μήνες δωρεάν",
  },
};

/** Whether a plan has a real (non-pending) live price configured. */
function liveConfigured(plan: PlanDef): boolean {
  return !plan.live.includes("PENDING");
}

/** Resolve the active Stripe price ID for a plan based on key mode. */
export function resolvePriceId(planId: PlanId): string {
  const plan = PLANS[planId];
  if (isLiveKey()) {
    // Fall back to monthly live price if this plan's live price isn't created yet.
    return liveConfigured(plan) ? plan.live : PLANS.monthly.live;
  }
  return plan.test;
}

export function getPlan(planId: PlanId): PlanDef {
  return PLANS[planId];
}

export function isValidPlanId(value: unknown): value is PlanId {
  return value === "monthly" || value === "semiannual" || value === "annual";
}

/** Plans exposed to the pricing UI (only those whose live price exists in live mode). */
export function listPlansForDisplay(): Array<{
  id: PlanId;
  name: string;
  displayPrice: string;
  perMonthDisplay: string;
  intervalMonths: number;
  freeMonths: number;
  badge?: string;
  available: boolean;
}> {
  const live = isLiveKey();
  return (Object.values(PLANS) as PlanDef[]).map((p) => ({
    id: p.id,
    name: p.name,
    displayPrice: p.displayPrice,
    perMonthDisplay: `€${(p.perMonth / 100).toFixed(2)}`,
    intervalMonths: p.intervalMonths,
    freeMonths: p.freeMonths,
    badge: p.badge,
    // In live mode, a plan is only purchasable if its live price exists.
    available: live ? liveConfigured(p) : true,
  }));
}

/**
 * Back-compat single-plan export (monthly) used by older code paths.
 */
export const SUBSCRIPTION = {
  get priceId() {
    return resolvePriceId("monthly");
  },
  get productId() {
    return isLiveKey() ? PRODUCT.live : PRODUCT.test;
  },
  lookupKey: PLANS.monthly.lookupKey,
  amount: PLANS.monthly.amount,
  currency: PLANS.monthly.currency,
  interval: "month" as const,
  trialDays: 7,
  displayPrice: PLANS.monthly.displayPrice,
  name: "Ultimate Trading Journal — Pro",
} as const;

export const TRIAL_DAYS = 7;

export type SubscriptionConfig = typeof SUBSCRIPTION;
