/**
 * Centralized subscription product configuration.
 *
 * The price is created once in the owner's Stripe account via
 * `scripts/setupStripeProduct.mjs` (idempotent, keyed by lookup_key
 * "utj_monthly_2999_eur"). We keep the resolved IDs here so the rest of the
 * server references a single source of truth.
 *
 * If the owner ever recreates the price (e.g. moving to live mode), update
 * SUBSCRIPTION_PRICE_ID — or rely on resolvePriceId() which falls back to a
 * lookup_key search at runtime.
 */
export const SUBSCRIPTION = {
  /** Resolved test-mode price (€29.99 / month). */
  priceId: "price_1Te8ij4lJKN2HEWbHprECmPK",
  productId: "prod_UdPXNFOtejXfWy",
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
