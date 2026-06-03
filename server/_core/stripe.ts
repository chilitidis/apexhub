import Stripe from "stripe";
import { ENV } from "./env";

/**
 * Shared Stripe client.
 *
 * The secret key is injected by the platform (STRIPE_SECRET_KEY). When the
 * owner swaps in live keys via Settings → Payment, this same client picks
 * them up — no code change required.
 *
 * We pin a stable classic API version (2024-06-20). The sandbox account's
 * default is a newer preview version (v2277) where some classic params (e.g.
 * promotion_codes `coupon`) were reshaped; pinning keeps request/response
 * shapes aligned with this SDK and our code.
 */
export const STRIPE_API_VERSION = "2024-06-20";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!ENV.stripeSecretKey) {
      throw new Error(
        "Stripe is not configured: STRIPE_SECRET_KEY is missing. Add it in Settings → Payment.",
      );
    }
    // Cast config: we deliberately pin an older stable version than the SDK's
    // bundled type literal, so the apiVersion string won't match the union.
    const config = { apiVersion: STRIPE_API_VERSION, typescript: true };
    _stripe = new Stripe(ENV.stripeSecretKey, config as ConstructorParameters<typeof Stripe>[1]);
  }
  return _stripe;
}

/** True when a usable secret key is present (used to gate procedures cleanly). */
export function isStripeConfigured(): boolean {
  return Boolean(ENV.stripeSecretKey);
}
