/**
 * End-to-end smoke test of the live subscription wiring against the owner's
 * Stripe (test mode). It:
 *   1. resolves the active €29.99 price,
 *   2. creates a throwaway customer with a test card (pm_card_visa),
 *   3. creates a subscription WITH a 7-day trial (mirrors checkout),
 *   4. creates a second subscription WITHOUT trial that charges immediately,
 *      to prove money actually flows to the account,
 *   5. prints invoice / charge status,
 *   6. cleans up the throwaway customers.
 *
 * Run: node scripts/e2eSubscriptionTest.mjs
 */
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Missing STRIPE_SECRET_KEY");
  process.exit(1);
}
const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

const PRICE_LOOKUP = "ultimate_trading_journal_pro_monthly";

async function resolvePrice() {
  const byKey = await stripe.prices.list({ lookup_keys: [PRICE_LOOKUP], active: true, limit: 1 });
  if (byKey.data[0]) return byKey.data[0];
  // fall back: first recurring EUR price
  const all = await stripe.prices.list({ active: true, limit: 100, type: "recurring" });
  const eur = all.data.find((p) => p.currency === "eur" && p.unit_amount === 2999);
  if (eur) return eur;
  throw new Error("Could not resolve the €29.99 price");
}

async function attachCard(customerId) {
  const pm = await stripe.paymentMethods.attach("pm_card_visa", { customer: customerId });
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: pm.id },
  });
  return pm.id;
}

async function main() {
  const price = await resolvePrice();
  console.log("Price:", price.id, price.unit_amount / 100, price.currency, "/", price.recurring?.interval);

  // ---- (A) Trial subscription (what checkout creates) ----
  const trialCustomer = await stripe.customers.create({
    email: "e2e-trial@example.com",
    name: "E2E Trial",
    metadata: { user_id: "999001" },
  });
  await attachCard(trialCustomer.id);
  const trialSub = await stripe.subscriptions.create({
    customer: trialCustomer.id,
    items: [{ price: price.id }],
    trial_period_days: 7,
    metadata: { user_id: "999001" },
  });
  console.log("\n[A] Trial subscription:", trialSub.id, "status:", trialSub.status, "trial_end:", trialSub.trial_end);

  // ---- (B) Immediate-charge subscription (proves money flows) ----
  const payCustomer = await stripe.customers.create({
    email: "e2e-pay@example.com",
    name: "E2E Pay",
    metadata: { user_id: "999002" },
  });
  await attachCard(payCustomer.id);
  const paySub = await stripe.subscriptions.create({
    customer: payCustomer.id,
    items: [{ price: price.id }],
    metadata: { user_id: "999002" },
    expand: ["latest_invoice.payment_intent"],
  });
  const inv = paySub.latest_invoice;
  const pi = inv && typeof inv === "object" ? inv.payment_intent : null;
  console.log("\n[B] Paid subscription:", paySub.id, "status:", paySub.status);
  if (inv && typeof inv === "object") {
    console.log("    invoice:", inv.id, "amount_paid:", (inv.amount_paid ?? 0) / 100, inv.currency, "paid:", inv.paid);
  }
  if (pi && typeof pi === "object") {
    console.log("    payment_intent:", pi.id, "status:", pi.status);
  }

  // ---- (C) Apply the OWNER-LIFETIME promo to prove €0 due ----
  const promoList = await stripe.promotionCodes.list({ code: "OWNER-LIFETIME", limit: 1 });
  if (promoList.data[0]) {
    const ownerCustomer = await stripe.customers.create({
      email: "e2e-owner@example.com",
      name: "E2E Owner",
      metadata: { user_id: "999003" },
    });
    await attachCard(ownerCustomer.id);
    const ownerSub = await stripe.subscriptions.create({
      customer: ownerCustomer.id,
      items: [{ price: price.id }],
      promotion_code: promoList.data[0].id,
      metadata: { user_id: "999003" },
      expand: ["latest_invoice"],
    });
    const oinv = ownerSub.latest_invoice;
    console.log("\n[C] Owner (promo) subscription:", ownerSub.id, "status:", ownerSub.status);
    if (oinv && typeof oinv === "object") {
      console.log("    amount_due:", (oinv.amount_due ?? 0) / 100, oinv.currency, "(expect 0)");
    }
    await stripe.customers.del(ownerCustomer.id);
  }

  // ---- cleanup ----
  await stripe.customers.del(trialCustomer.id);
  await stripe.customers.del(payCustomer.id);
  console.log("\nCleaned up throwaway customers. DONE.");
}

main().catch((e) => {
  console.error("E2E failed:", e.message);
  process.exit(1);
});
