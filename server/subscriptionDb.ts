import { eq } from "drizzle-orm";
import { subscriptions, type SubscriptionRow } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Subscription persistence helpers. We keep these in their own module so the
 * Stripe-facing code (router + webhook) shares one source of truth and the
 * core db.ts stays focused on journal data.
 */

export async function getSubscriptionByUser(userId: number): Promise<SubscriptionRow | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function getSubscriptionByCustomer(
  stripeCustomerId: string,
): Promise<SubscriptionRow | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return rows[0] ?? null;
}

/** Ensure a subscription row exists for the user; returns the row. */
export async function ensureSubscriptionRow(userId: number): Promise<SubscriptionRow | null> {
  const db = await getDb();
  if (!db) return null;
  const existing = await getSubscriptionByUser(userId);
  if (existing) return existing;
  await db.insert(subscriptions).values({ userId, status: "none" });
  return getSubscriptionByUser(userId);
}

export interface SubscriptionPatch {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  status?: string;
  currentPeriodEnd?: Date | null;
  trialEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}

/** Upsert subscription state for a user (creates the row if missing). */
export async function upsertSubscription(
  userId: number,
  patch: SubscriptionPatch,
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const values: Record<string, unknown> = {};
  if (patch.stripeCustomerId !== undefined) values.stripeCustomerId = patch.stripeCustomerId;
  if (patch.stripeSubscriptionId !== undefined)
    values.stripeSubscriptionId = patch.stripeSubscriptionId;
  if (patch.status !== undefined) values.status = patch.status;
  if (patch.currentPeriodEnd !== undefined) values.currentPeriodEnd = patch.currentPeriodEnd;
  if (patch.trialEnd !== undefined) values.trialEnd = patch.trialEnd;
  if (patch.cancelAtPeriodEnd !== undefined)
    values.cancelAtPeriodEnd = patch.cancelAtPeriodEnd ? 1 : 0;

  const existing = await getSubscriptionByUser(userId);
  if (existing) {
    await db.update(subscriptions).set(values).where(eq(subscriptions.userId, userId));
  } else {
    await db.insert(subscriptions).values({ userId, status: "none", ...values });
  }
}

/**
 * Decide whether a subscription row currently grants app access.
 *
 * Access is granted while the subscription is `trialing` or `active`. We also
 * defensively check the period end timestamp: if Stripe says active/trialing
 * but the cached period end is in the past, we still honor the status flag
 * (the webhook is the authority) — the timestamp is informational for the UI.
 */
export function subscriptionHasAccess(row: SubscriptionRow | null): boolean {
  if (!row) return false;
  return row.status === "trialing" || row.status === "active";
}
