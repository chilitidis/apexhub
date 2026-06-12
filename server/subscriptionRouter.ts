import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getStripe, isStripeConfigured } from "./_core/stripe";
import {
  SUBSCRIPTION,
  TRIAL_DAYS,
  getPlan,
  isValidPlanId,
  listPlansForDisplay,
  resolvePriceId as resolvePlanPriceId,
  type PlanId,
} from "./products";
import {
  ensureSubscriptionRow,
  getSubscriptionByUser,
  subscriptionHasAccess,
  upsertSubscription,
} from "./subscriptionDb";

/**
 * Resolve the active Stripe price id for a given plan. Prefer the configured id
 * from products.ts, but fall back to a lookup_key search so the app keeps
 * working if the owner recreates the price (e.g. when switching to live keys).
 */
async function resolvePriceId(planId: PlanId): Promise<string> {
  const stripe = getStripe();
  const plan = getPlan(planId);
  const configuredId = resolvePlanPriceId(planId);
  try {
    const direct = await stripe.prices.retrieve(configuredId);
    if (direct && direct.active) return direct.id;
  } catch {
    // fall through to lookup_key search
  }
  const byKey = await stripe.prices.list({
    lookup_keys: [plan.lookupKey],
    active: true,
    limit: 1,
  });
  if (byKey.data[0]) return byKey.data[0].id;

  // Last resort: monthly price, so checkout never hard-fails.
  if (planId !== "monthly") {
    return resolvePriceId("monthly");
  }
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "Subscription price not found in Stripe. Run scripts/setupStripeProduct.mjs.",
  });
}

/**
 * True when a Stripe error indicates the referenced customer does not exist in
 * the current account/mode. This happens when a customer was created under
 * test keys but the app is now running with live keys (or vice versa).
 */
export function isMissingCustomerError(err: unknown): boolean {
  const e = err as { code?: string; message?: string; statusCode?: number };
  if (!e) return false;
  if (e.code === "resource_missing") return true;
  return typeof e.message === "string" && /No such customer/i.test(e.message);
}

/** Create a fresh Stripe customer and persist its id for the user. */
async function createCustomer(
  userId: number,
  email: string | null,
  name: string | null,
): Promise<string> {
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    name: name ?? undefined,
    metadata: { user_id: String(userId) },
  });
  await upsertSubscription(userId, { stripeCustomerId: customer.id });
  return customer.id;
}

/**
 * Find or create the Stripe customer for a user, persisting the id.
 *
 * If a stored customer id no longer resolves in Stripe (e.g. it was created in
 * test mode and we now run live), we transparently create a new one and update
 * the stored id so the user is never blocked.
 */
async function getOrCreateCustomer(
  userId: number,
  email: string | null,
  name: string | null,
): Promise<string> {
  const stripe = getStripe();
  const existing = await getSubscriptionByUser(userId);
  if (existing?.stripeCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(existing.stripeCustomerId);
      if (customer && !(customer as { deleted?: boolean }).deleted) {
        return existing.stripeCustomerId;
      }
    } catch (err) {
      if (!isMissingCustomerError(err)) throw err;
      // stale customer id — fall through and create a fresh one
    }
  }
  return createCustomer(userId, email, name);
}

export const subscriptionRouter = router({
  /** Plan info for the pricing UI. Public so the marketing page can render it. */
  plan: publicProcedure.query(() => ({
    displayPrice: SUBSCRIPTION.displayPrice,
    interval: SUBSCRIPTION.interval,
    trialDays: SUBSCRIPTION.trialDays,
    name: SUBSCRIPTION.name,
    currency: SUBSCRIPTION.currency,
    configured: isStripeConfigured(),
  })),

  /** All available plans (monthly / 6-month / 12-month) for the plan selector. */
  plans: publicProcedure.query(() => ({
    trialDays: TRIAL_DAYS,
    configured: isStripeConfigured(),
    plans: listPlansForDisplay(),
  })),

  /**
   * Current user's subscription status. Drives the paywall + trial banner.
   * Returns a normalized shape regardless of whether a row exists yet.
   */
  status: protectedProcedure.query(async ({ ctx }) => {
    const row = await getSubscriptionByUser(ctx.user.id);
    // Admins (the owner) are never gated behind billing so they can always
    // reach the dashboard and the admin tools.
    const isAdmin = ctx.user.role === "admin";
    return {
      status: row?.status ?? "none",
      hasAccess: isAdmin || subscriptionHasAccess(row),
      isAdmin,
      trialEnd: row?.trialEnd ?? null,
      currentPeriodEnd: row?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: Boolean(row?.cancelAtPeriodEnd),
      isConfigured: isStripeConfigured(),
    };
  }),

  /**
   * Create a Checkout Session in subscription mode.
   * Accepts a plan id (monthly / semiannual / annual); defaults to monthly.
   * When `withTrial` is true (default) a 7-day free trial is attached;
   * when false the customer is charged immediately (no trial).
   * Returns the hosted Checkout URL; the frontend opens it in a new tab.
   */
  createCheckout: protectedProcedure
    .input(
      z.object({
        origin: z.string().url(),
        plan: z.enum(["monthly", "semiannual", "annual"]).optional(),
        // When false, the customer is charged immediately (no free trial).
        // Defaults to true so existing callers keep the 7-day trial behavior.
        withTrial: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isStripeConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Stripe is not configured yet. Add keys in Settings → Payment.",
        });
      }
      const planId: PlanId = isValidPlanId(input.plan) ? input.plan : "monthly";
      // Default to the free trial unless the caller explicitly opts out.
      const withTrial = input.withTrial !== false;
      const stripe = getStripe();
      const priceId = await resolvePriceId(planId);
      await ensureSubscriptionRow(ctx.user.id);
      const customerId = await getOrCreateCustomer(ctx.user.id, ctx.user.email, ctx.user.name);

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: String(ctx.user.id),
        allow_promotion_codes: true,
        subscription_data: {
          // Only attach the trial when requested; omitting the field charges now.
          ...(withTrial ? { trial_period_days: TRIAL_DAYS } : {}),
          metadata: { user_id: String(ctx.user.id), plan: planId, with_trial: String(withTrial) },
        },
        metadata: {
          user_id: String(ctx.user.id),
          customer_email: ctx.user.email ?? "",
          customer_name: ctx.user.name ?? "",
          plan: planId,
          with_trial: String(withTrial),
        },
        success_url: `${input.origin}/?subscription=success`,
        cancel_url: `${input.origin}/pricing?subscription=cancelled`,
      });

      if (!session.url) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Checkout URL missing" });
      }
      return { url: session.url };
    }),

  /**
   * Create a Customer Portal session so the user can manage / cancel their
   * subscription and update payment methods.
   */
  createPortal: protectedProcedure
    .input(z.object({ origin: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      if (!isStripeConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Stripe is not configured yet. Add keys in Settings → Payment.",
        });
      }
      const stripe = getStripe();
      // Resolve a valid customer id, healing a stale (wrong-mode/deleted) one.
      const customerId = await getOrCreateCustomer(
        ctx.user.id,
        ctx.user.email,
        ctx.user.name,
      );

      const buildPortal = (customer: string) =>
        stripe.billingPortal.sessions.create({
          customer,
          return_url: `${input.origin}/`,
        });

      let portal;
      try {
        portal = await buildPortal(customerId);
      } catch (err) {
        if (!isMissingCustomerError(err)) throw err;
        // Extremely rare race: id went stale between resolve and create.
        const fresh = await createCustomer(ctx.user.id, ctx.user.email, ctx.user.name);
        portal = await buildPortal(fresh);
      }

      if (!portal.url) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Customer Portal URL missing. Enable the Customer Portal in Stripe → Settings → Billing.",
        });
      }
      return { url: portal.url };
    }),
});
