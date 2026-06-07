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
}

export interface AdminUsersResult {
  users: AdminUserRow[];
  totals: {
    registered: number;
    trialing: number;
    active: number;
    /** Registered users with no trial/subscription started yet. */
    noPlan: number;
  };
}

export const adminRouter = router({
  /**
   * Full roster of users joined with their subscription status. Newest
   * registrations first. Returns aggregate totals for the dashboard header.
   */
  listUsers: adminProcedure.query(async (): Promise<AdminUsersResult> => {
    const db = await getDb();
    if (!db) {
      return { users: [], totals: { registered: 0, trialing: 0, active: 0, noPlan: 0 } };
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

    const mapped: AdminUserRow[] = rows.map((r) => ({
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

    const totals = {
      registered: mapped.length,
      trialing: mapped.filter((u) => u.subscriptionStatus === "trialing").length,
      active: mapped.filter((u) => u.subscriptionStatus === "active").length,
      noPlan: mapped.filter(
        (u) => u.subscriptionStatus !== "trialing" && u.subscriptionStatus !== "active",
      ).length,
    };

    return { users: mapped, totals };
  }),
});
