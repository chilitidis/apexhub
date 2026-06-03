import Stripe from "stripe";
import { ENV } from "./env";

/**
 * Shared Stripe client.
 *
 * The secret key is injected by the platform (STRIPE_SECRET_KEY). When the
 * owner swaps in live keys via Settings → Payment, this same client picks
 * them up — no code change required.
 *
 * We intentionally do NOT pin an apiVersion so the account's default version
 * is used; this keeps us forward-compatible with the dashboard-configured
 * version and avoids type drift between the SDK and the account.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!ENV.stripeSecretKey) {
      throw new Error(
        "Stripe is not configured: STRIPE_SECRET_KEY is missing. Add it in Settings → Payment.",
      );
    }
    _stripe = new Stripe(ENV.stripeSecretKey, {
      // Let the SDK use its bundled pinned version; this keeps us
      // forward-compatible with the account's dashboard-configured version.
      typescript: true,
    });
  }
  return _stripe;
}

/** True when a usable secret key is present (used to gate procedures cleanly). */
export function isStripeConfigured(): boolean {
  return Boolean(ENV.stripeSecretKey);
}
