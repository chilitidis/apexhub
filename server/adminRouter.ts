import { desc, eq } from "drizzle-orm";
import { subscriptions, users } from "../drizzle/schema";
import { getDb } from "./db";
import { adminProcedure, router } from "./_core/trpc";

/**
 * Admin-only router. Every procedure here is gated by `adminProcedure`, which
 * throws FORBIDDEN unless `ctx.user.role === "admin"`. Only the owner account
 * (role=admin) can reach these endpoints, so the user/subscription roster is
 * never exposed to regular members.
 */

export interface AdminUserRow {
  id: number;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  createdAt: Date;
  lastSignedIn: Date;
  /** Subscription status: "none" | "trialing" | "active" | "canceled" | ... */
  subscriptionStatus: string;
  trialEnd: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  /**
   * How many underlying DB user rows were merged into this logical user.
   * 1 means a single account; >1 means the same email signed in through
   * multiple methods (e.g. Google + Clerk) and we collapsed them for display.
   */
  accountCount: number;
  /** The underlying users.id values that were merged (for transparency). */
  mergedIds: number[];
  /** All distinct login methods seen across the merged rows. */
  loginMethods: string[];
}

export interface AdminUsersResult {
  users: AdminUserRow[];
  totals: {
    /** Distinct people (deduped by email). */
    registered: number;
    trialing: number;
    active: number;
    /** Registered users with no trial/subscription started yet. */
    noPlan: number;
    /** Number of logical users that were collapsed from multiple rows. */
    merged: number;
  };
}

/**
 * Rank a subscription status so we can pick the "strongest" plan when merging
 * duplicate rows. Higher wins.
 */
function statusRank(status: string): number {
  switch (status) {
    case "active":
      return 4;
    case "trialing":
      return 3;
    case "past_due":
      return 2;
    case "canceled":
      return 1;
    default:
      return 0; // "none" and unknown
  }
}

export type RawRow = {
  id: number;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  createdAt: Date;
  lastSignedIn: Date;
  subscriptionStatus: string;
  trialEnd: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

/**
 * Collapse multiple DB rows that belong to the same person (same email) into a
 * single logical AdminUserRow. This is a display-only merge — it never mutates
 * the database. Rows without an email cannot be deduped reliably, so each is
 * kept as its own logical user.
 */
export function mergeByEmail(rows: RawRow[]): AdminUserRow[] {
  const groups = new Map<string, RawRow[]>();

  for (const row of rows) {
    // Group only when we have a usable email; otherwise keep the row unique by id.
    const key =
      row.email && row.email.trim()
        ? `email:${row.email.trim().toLowerCase()}`
        : `id:${row.id}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  const merged: AdminUserRow[] = [];

  for (const bucket of Array.from(groups.values())) {
    if (bucket.length === 1) {
      const r = bucket[0];
      merged.push({
        ...r,
        accountCount: 1,
        mergedIds: [r.id],
        loginMethods: r.loginMethod ? [r.loginMethod] : [],
      });
      continue;
    }

    // Pick the row carrying the strongest subscription as the plan source.
    const planSource = [...bucket].sort((a: RawRow, b: RawRow) => {
      const rank = statusRank(b.subscriptionStatus) - statusRank(a.subscriptionStatus);
      if (rank !== 0) return rank;
      // Tie-breaker: most recent activity.
      return b.lastSignedIn.getTime() - a.lastSignedIn.getTime();
    })[0];

    const earliestCreated = bucket.reduce((min: RawRow, r: RawRow) =>
      r.createdAt.getTime() < min.createdAt.getTime() ? r : min,
    );
    const latestSignedIn = bucket.reduce((max: RawRow, r: RawRow) =>
      r.lastSignedIn.getTime() > max.lastSignedIn.getTime() ? r : max,
    );
    const displayName =
      bucket.find((r: RawRow) => r.name && r.name.trim())?.name ?? planSource.name;
    const isAdmin = bucket.some((r: RawRow) => r.role === "admin");
    const loginMethods: string[] = Array.from(
      new Set(
        bucket
          .map((r: RawRow) => r.loginMethod)
          .filter((m: string | null): m is string => Boolean(m)),
      ),
    );

    merged.push({
      // Use the plan source id as the canonical id for the merged view.
      id: planSource.id,
      name: displayName,
      email: planSource.email,
      loginMethod: planSource.loginMethod,
      role: isAdmin ? "admin" : "user",
      createdAt: earliestCreated.createdAt,
      lastSignedIn: latestSignedIn.lastSignedIn,
      subscriptionStatus: planSource.subscriptionStatus,
      trialEnd: planSource.trialEnd,
      currentPeriodEnd: planSource.currentPeriodEnd,
      cancelAtPeriodEnd: planSource.cancelAtPeriodEnd,
      accountCount: bucket.length,
      mergedIds: bucket.map((r: RawRow) => r.id).sort((a: number, b: number) => a - b),
      loginMethods,
    });
  }

  // Newest registrations first.
  merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return merged;
}

export const adminRouter = router({
  /**
   * Full roster of users joined with their subscription status. Rows that share
   * the same email (e.g. Google + Clerk logins for the same person) are merged
   * into a single logical user so the admin panel never shows duplicates. This
   * is purely a read/display concern — no database rows are modified.
   */
  listUsers: adminProcedure.query(async (): Promise<AdminUsersResult> => {
    const db = await getDb();
    if (!db) {
      return {
        users: [],
        totals: { registered: 0, trialing: 0, active: 0, noPlan: 0, merged: 0 },
      };
    }

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        loginMethod: users.loginMethod,
        role: users.role,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
        subStatus: subscriptions.status,
        trialEnd: subscriptions.trialEnd,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      })
      .from(users)
      .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
      .orderBy(desc(users.createdAt));

    const raw: RawRow[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      loginMethod: r.loginMethod,
      role: r.role,
      createdAt: r.createdAt,
      lastSignedIn: r.lastSignedIn,
      subscriptionStatus: r.subStatus ?? "none",
      trialEnd: r.trialEnd ?? null,
      currentPeriodEnd: r.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: Boolean(r.cancelAtPeriodEnd),
    }));

    const mergedUsers = mergeByEmail(raw);

    const totals = {
      registered: mergedUsers.length,
      trialing: mergedUsers.filter((u) => u.subscriptionStatus === "trialing").length,
      active: mergedUsers.filter((u) => u.subscriptionStatus === "active").length,
      noPlan: mergedUsers.filter(
        (u) => u.subscriptionStatus !== "trialing" && u.subscriptionStatus !== "active",
      ).length,
      merged: mergedUsers.filter((u) => u.accountCount > 1).length,
    };

    return { users: mergedUsers, totals };
  }),
});
