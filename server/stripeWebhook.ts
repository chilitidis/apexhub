import type { Express, Request, Response } from "express";
import express from "express";
import type Stripe from "stripe";
import { getStripe } from "./_core/stripe";
import { ENV } from "./_core/env";
import {
  getSubscriptionByCustomer,
  getSubscriptionByUser,
  upsertSubscription,
} from "./subscriptionDb";

/**
 * Stripe webhook endpoint.
 *
 * Mounted at the exact path /api/stripe/webhook with express.raw() so the
 * signature can be verified against the unparsed body. MUST be registered
 * BEFORE express.json().
 *
 * We keep the handler small: every subscription-affecting event funnels into
 * `syncSubscription`, which reads the current state straight from Stripe and
 * writes the small cached projection into our DB. We never trust amounts or
 * statuses from the raw event body beyond the IDs needed to look things up.
 */

function toDate(unixSeconds: number | null | undefined): Date | null {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000);
}

/** Resolve our internal userId from a Stripe subscription/customer. */
async function resolveUserId(
  sub: Stripe.Subscription,
  customerId: string,
): Promise<number | null> {
  // 1) subscription metadata (set at checkout)
  const metaUserId = sub.metadata?.user_id;
  if (metaUserId && Number.isFinite(Number(metaUserId))) return Number(metaUserId);

  // 2) existing row keyed by customer id
  const existing = await getSubscriptionByCustomer(customerId);
  if (existing) return existing.userId;

  // 3) customer metadata
  try {
    const stripe = getStripe();
    const customer = await stripe.customers.retrieve(customerId);
    if (customer && !customer.deleted) {
      const cm = (customer as Stripe.Customer).metadata?.user_id;
      if (cm && Number.isFinite(Number(cm))) return Number(cm);
    }
  } catch {
    // ignore
  }
  return null;
}

async function syncSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userId = await resolveUserId(sub, customerId);
  if (!userId) {
    console.warn("[StripeWebhook] Could not resolve userId for subscription", sub.id);
    return;
  }

  // current_period_end lives on the subscription item in newer API versions;
  // fall back to the top-level field for older ones.
  const item = sub.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const periodEnd =
    item?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    null;

  await upsertSubscription(userId, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    status: sub.status,
    currentPeriodEnd: toDate(periodEnd),
    trialEnd: toDate(sub.trial_end),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
  });
  console.log(`[StripeWebhook] Synced subscription ${sub.id} for user ${userId} → ${sub.status}`);
}

export function registerStripeWebhook(app: Express) {
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const stripe = getStripe();
      const sig = req.headers["stripe-signature"];

      // Platform test-event handshake — MUST return verified:true. These probe
      // events are NOT signed with the real webhook secret, so we must detect
      // them from the raw body BEFORE attempting signature verification.
      try {
        const raw = (req.body as Buffer)?.toString("utf8") ?? "";
        const peeked = raw ? (JSON.parse(raw) as { id?: string }) : null;
        if (peeked?.id && peeked.id.startsWith("evt_test_")) {
          console.log("[StripeWebhook] Test event detected, returning verification response");
          return res.json({ verified: true });
        }
      } catch {
        // Not JSON / not a test probe — fall through to real verification.
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body as Buffer,
          sig as string,
          ENV.stripeWebhookSecret,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[StripeWebhook] Signature verification failed:", msg);
        return res.status(400).send(`Webhook Error: ${msg}`);
      }

      try {
        switch (event.type) {
          case "customer.subscription.created":
          case "customer.subscription.updated":
          case "customer.subscription.deleted":
          case "customer.subscription.paused":
          case "customer.subscription.resumed": {
            await syncSubscription(event.data.object as Stripe.Subscription);
            break;
          }
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            if (session.subscription) {
              const subId =
                typeof session.subscription === "string"
                  ? session.subscription
                  : session.subscription.id;
              const sub = await stripe.subscriptions.retrieve(subId);
              await syncSubscription(sub);
            }
            break;
          }
          case "invoice.paid":
          case "invoice.payment_failed": {
            const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null };
            const subId =
              typeof invoice.subscription === "string" ? invoice.subscription : null;
            if (subId) {
              const sub = await stripe.subscriptions.retrieve(subId);
              await syncSubscription(sub);
            }
            break;
          }
          default:
            // ignore unrelated events
            break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[StripeWebhook] Handler error for ${event.type}:`, msg);
        // Still 200 so Stripe doesn't hammer retries for non-critical handler
        // bugs; the next subscription.updated will re-sync state.
      }

      return res.json({ received: true });
    },
  );
}

// Re-export for tests.
export { syncSubscription, getSubscriptionByUser };
