// Round 51: create the NEW subscription prices for Ultimate Trading Journal — Pro.
// Works for BOTH test and live: auto-detects the product from the active key's mode.
//   - TEST product: prod_UdPXNFOtejXfWy
//   - LIVE product: prod_UdQKdWU2Cp8Ej6
//
// Monthly    = €39.99  (interval: month)
// 6-month    = €199.99 (interval: month x6)  -> save 1 month vs 6x39.99
// 12-month   = €399.99 (interval: year x1)    -> save 2 months vs 12x39.99
//
// Idempotent via lookup_key. Re-running reuses existing prices.
//
// Run (test): node scripts/setupNewPrices2026.mjs
// Run (live): LIVE_SK=sk_live_... node scripts/setupNewPrices2026.mjs
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
    lookup_key: "utj_monthly_3999_eur",
    nickname: "UTJ Pro — Monthly (€39.99)",
    unit_amount: 3999,
    recurring: { interval: "month" },
  },
  {
    lookup_key: "utj_semiannual_19999_eur",
    nickname: "UTJ Pro — 6 months (€199.99)",
    unit_amount: 19999,
    recurring: { interval: "month", interval_count: 6 },
  },
  {
    lookup_key: "utj_annual_39999_eur",
    nickname: "UTJ Pro — 12 months (€399.99)",
    unit_amount: 39999,
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
