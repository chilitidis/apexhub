// Sets up the LIVE Stripe environment for Ultimate Trading Journal on the owner's APEXHUB account.
// Creates: product, €29.99/mo recurring price (7-day trial handled at checkout),
// a forever-100%-off coupon + unlimited OWNER-LIFETIME promo code, and the live webhook endpoint.
// Does NOT touch the existing 99€ APEXHUB product.

import Stripe from "stripe";

const KEY = process.env.LIVE_SK;
if (!KEY) {
  console.error("Missing LIVE_SK env");
  process.exit(1);
}

const stripe = new Stripe(KEY, { apiVersion: "2024-06-20" });

const PROD_DOMAIN = "https://ultimatradingjournal.com";

async function main() {
  // 1) Product
  const product = await stripe.products.create({
    name: "Ultimate Trading Journal — Pro",
    description:
      "Full access to the Ultimate Trading Journal: unlimited accounts, MT5 auto-sync, monthly journaling, KPIs and analytics.",
  });
  console.log("PRODUCT_ID:", product.id);

  // 2) Price €29.99/month
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 2999,
    currency: "eur",
    recurring: { interval: "month" },
  });
  console.log("PRICE_ID:", price.id);

  // 3) Forever 100%-off coupon + unlimited OWNER-LIFETIME promo code
  const coupon = await stripe.coupons.create({
    percent_off: 100,
    duration: "forever",
    name: "Owner Lifetime (UTJ)",
  });
  console.log("COUPON_ID:", coupon.id);

  const promo = await stripe.promotionCodes.create({
    coupon: coupon.id,
    code: "OWNER-LIFETIME",
    // no max_redemptions => unlimited
  });
  console.log("PROMO_ID:", promo.id, "code:", promo.code, "max_redemptions:", promo.max_redemptions);

  // 4) Webhook endpoint -> production domain
  const webhook = await stripe.webhookEndpoints.create({
    url: `${PROD_DOMAIN}/api/stripe/webhook`,
    enabled_events: [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.paid",
      "invoice.payment_failed",
      "customer.subscription.paused",
      "customer.subscription.resumed",
    ],
  });
  console.log("WEBHOOK_ID:", webhook.id);
  console.log("WEBHOOK_SECRET:", webhook.secret);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
