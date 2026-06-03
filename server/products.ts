/**
 * Centralized subscription product configuration.
 *
 * Prices are created in the owner's Stripe account via scripts/setupStripeProduct.mjs
 * (test mode) and scripts/setupLiveStripe.mjs (live mode). We keep the resolved IDs
 * here so the rest of the server references a single source of truth.
 *
 * The correct price ID is selected at runtime based on whether the active
 * STRIPE_SECRET_KEY is a live key (sk_live_...) or a test key (sk_test_...).
 * This way switching between test and live keys "just works" without code edits.
 */

const TEST_PRICE_ID = "price_1Te8ij4lJKN2HEWbHprECmPK";
const TEST_PRODUCT_ID = "prod_UdPXNFOtejXfWy";

const LIVE_PRICE_ID = "price_1Te9TcIAIUEpIzIzXbWkwCn9";
const LIVE_PRODUCT_ID = "prod_UdQKdWU2Cp8Ej6";

function isLiveKey(): boolean {
  return (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live_");
}

export const SUBSCRIPTION = {
  /** Resolved price (€29.99 / month) — picks live vs test automatically. */
  get priceId() {
    return isLiveKey() ? LIVE_PRICE_ID : TEST_PRICE_ID;
  },
  get productId() {
    return isLiveKey() ? LIVE_PRODUCT_ID : TEST_PRODUCT_ID;
  },
  lookupKey: "utj_monthly_2999_eur",
  /** Display copy used by the pricing UI. */
  amount: 2999,
  currency: "eur",
  interval: "month" as const,
  trialDays: 7,
  displayPrice: "€29.99",
  name: "Ultimate Trading Journal — Pro",
} as const;

export type SubscriptionConfig = typeof SUBSCRIPTION;
