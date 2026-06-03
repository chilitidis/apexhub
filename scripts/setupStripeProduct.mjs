// One-off setup: create (or reuse) the €29.99/month recurring price for the
// Ultimate Trading Journal subscription in the owner's Stripe account.
//
// Idempotent: it looks up an existing product by a stable lookup_key on the
// price first, so re-running won't create duplicates.
//
// Run: node scripts/setupStripeProduct.mjs
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY missing in env");
  process.exit(1);
}

const stripe = new Stripe(key, { typescript: true });

const LOOKUP_KEY = "utj_monthly_2999_eur";

async function main() {
  // 1) Reuse an existing price keyed by our stable lookup_key.
  const existing = await stripe.prices.list({
    lookup_keys: [LOOKUP_KEY],
    active: true,
    expand: ["data.product"],
    limit: 1,
  });

  if (existing.data.length > 0) {
    const p = existing.data[0];
    console.log("REUSING existing price.");
    console.log("PRICE_ID=" + p.id);
    console.log("PRODUCT_ID=" + (typeof p.product === "string" ? p.product : p.product.id));
    return;
  }

  // 2) Create product + recurring monthly EUR price.
  const product = await stripe.products.create({
    name: "Ultimate Trading Journal — Pro",
    description:
      "Full access to the Ultimate Trading Journal: unlimited accounts, MT5 auto-sync, monthly journaling, KPIs and analytics.",
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 2999, // €29.99
    currency: "eur",
    recurring: { interval: "month" },
    lookup_key: LOOKUP_KEY,
  });

  console.log("CREATED new product + price.");
  console.log("PRODUCT_ID=" + product.id);
  console.log("PRICE_ID=" + price.id);
}

main().catch((err) => {
  console.error("Stripe setup failed:", err?.message || err);
  process.exit(1);
});
