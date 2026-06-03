/**
 * Creates a "forever 100% off" coupon and an owner-only promotion code so the
 * project owner can subscribe without ever being charged.
 *
 * Idempotent-ish: it looks for an existing promotion code with the same code
 * and reuses it instead of creating duplicates.
 *
 * Run: node scripts/createOwnerPromo.mjs [CODE]
 *   CODE defaults to OWNER-LIFETIME
 */
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Missing STRIPE_SECRET_KEY");
  process.exit(1);
}
const stripe = new Stripe(key);

const CODE = (process.argv[2] || "OWNER-LIFETIME").toUpperCase();

async function getOrCreateCoupon() {
  // Reuse a coupon tagged via metadata if it exists.
  const existing = await stripe.coupons.list({ limit: 100 });
  const found = existing.data.find(
    (c) => c.metadata?.purpose === "owner-lifetime-100" && c.valid,
  );
  if (found) {
    console.log("Reusing coupon:", found.id);
    return found;
  }
  const coupon = await stripe.coupons.create({
    percent_off: 100,
    duration: "forever",
    name: "Owner Lifetime (100% off)",
    metadata: { purpose: "owner-lifetime-100" },
  });
  console.log("Created coupon:", coupon.id);
  return coupon;
}

async function getOrCreatePromo(couponId) {
  const existing = await stripe.promotionCodes.list({ code: CODE, limit: 1 });
  if (existing.data[0]) {
    console.log("Promotion code already exists:", existing.data[0].code, "→", existing.data[0].id);
    return existing.data[0];
  }
  const promo = await stripe.promotionCodes.create({
    coupon: couponId,
    code: CODE,
    metadata: { purpose: "owner-lifetime-100" },
    // Restrict so it is unlikely to be guessed/abused; owner-only by convention.
    max_redemptions: 5,
  });
  console.log("Created promotion code:", promo.code, "→", promo.id);
  return promo;
}

async function main() {
  const coupon = await getOrCreateCoupon();
  const promo = await getOrCreatePromo(coupon.id);
  console.log("\n=== DONE ===");
  console.log("Use this code at checkout (Προσθήκη κωδικού προωθητικής ενέργειας):");
  console.log("  " + promo.code);
  console.log("It applies 100% off forever, so total due = €0.00 every month.");
}

main().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
