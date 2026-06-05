// Creates the 6-month and 12-month recurring prices for Ultimate Trading Journal — Pro.
// Works for BOTH test and live: it auto-detects the product from the active key's mode.
//   - TEST product: prod_UdPXNFOtejXfWy
//   - LIVE product: prod_UdQKdWU2Cp8Ej6
//
// 6-month  = €149.95 (5 x 29.99) -> save 1 month
// 12-month = €299.90 (10 x 29.99) -> save 2 months
//
// Idempotent via lookup_key. Re-running reuses existing prices.
//
// Run (test): node scripts/setupPlanPrices.mjs
// Run (live): LIVE_SK=sk_live_... node scripts/setupPlanPrices.mjs
import Stripe from "stripe";

const liveKey = process.env.LIVE_SK;
const key = liveKey || process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("No Stripe key (set LIVE_SK or STRIPE_SECRET_KEY)");
  process.exit(1);
}
const isLive = key.startsWith("sk_live_");
const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

const PRODUCT = isLive ? "prod_UdQKdWU2Cp8Ej6" : "prod_UdPXNFOtejXfWy";

const PLANS = [
  {
    lookup_key: "utj_semiannual_14995_eur",
    nickname: "UTJ Pro — 6 months",
    unit_amount: 14995,
    recurring: { interval: "month", interval_count: 6 },
  },
  {
    lookup_key: "utj_annual_29990_eur",
    nickname: "UTJ Pro — 12 months",
    unit_amount: 29990,
    recurring: { interval: "year", interval_count: 1 },
  },
];

async function ensurePrice(plan) {
  const existing = await stripe.prices.list({
    lookup_keys: [plan.lookup_key],
    active: true,
    limit: 1,
  });
  if (existing.data.length > 0) {
    return { id: existing.data[0].id, reused: true };
  }
  const price = await stripe.prices.create({
    product: PRODUCT,
    unit_amount: plan.unit_amount,
    currency: "eur",
    recurring: plan.recurring,
    lookup_key: plan.lookup_key,
    nickname: plan.nickname,
  });
  return { id: price.id, reused: false };
}

async function main() {
  const out = { mode: isLive ? "LIVE" : "TEST", product: PRODUCT, prices: {} };
  for (const plan of PLANS) {
    const res = await ensurePrice(plan);
    out.prices[plan.lookup_key] = res;
  }
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
