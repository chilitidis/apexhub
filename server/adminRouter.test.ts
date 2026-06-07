import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { mergeByEmail, type RawRow } from "./adminRouter";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeCtx(role: "user" | "admin"): TrpcContext {
  const user: AuthenticatedUser = {
    id: role === "admin" ? 1 : 2,
    openId: `sample-${role}`,
    email: `${role}@example.com`,
    name: `Sample ${role}`,
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

function row(overrides: Partial<RawRow>): RawRow {
  return {
    id: 1,
    name: "Test",
    email: "a@example.com",
    loginMethod: "google",
    role: "user",
    createdAt: new Date("2026-01-01"),
    lastSignedIn: new Date("2026-01-01"),
    subscriptionStatus: "none",
    trialEnd: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

describe("admin.listUsers access control", () => {
  it("rejects non-admin users with FORBIDDEN", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(caller.admin.listUsers()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows admins to call the procedure (returns a roster shape)", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.admin.listUsers();
    expect(result).toHaveProperty("users");
    expect(Array.isArray(result.users)).toBe(true);
    expect(result).toHaveProperty("totals");
    expect(result.totals).toHaveProperty("registered");
    expect(result.totals).toHaveProperty("trialing");
    expect(result.totals).toHaveProperty("active");
    expect(result.totals).toHaveProperty("noPlan");
    expect(result.totals).toHaveProperty("merged");
  });
});

describe("mergeByEmail (display-only dedupe)", () => {
  it("collapses two rows with the same email into one logical user", () => {
    const merged = mergeByEmail([
      row({
        id: 1,
        loginMethod: "google",
        role: "admin",
        createdAt: new Date("2025-12-01"),
        lastSignedIn: new Date("2025-12-10"),
        subscriptionStatus: "none",
      }),
      row({
        id: 630001,
        loginMethod: "clerk",
        role: "user",
        createdAt: new Date("2026-02-01"),
        lastSignedIn: new Date("2026-03-01"),
        subscriptionStatus: "trialing",
        trialEnd: new Date("2026-03-15"),
      }),
    ]);

    expect(merged).toHaveLength(1);
    const u = merged[0];
    // Admin wins if any merged row is admin.
    expect(u.role).toBe("admin");
    // Strongest subscription (trialing > none) is used.
    expect(u.subscriptionStatus).toBe("trialing");
    expect(u.trialEnd).toEqual(new Date("2026-03-15"));
    // Earliest registration, latest activity.
    expect(u.createdAt).toEqual(new Date("2025-12-01"));
    expect(u.lastSignedIn).toEqual(new Date("2026-03-01"));
    // Transparency fields.
    expect(u.accountCount).toBe(2);
    expect(u.mergedIds).toEqual([1, 630001]);
    expect(u.loginMethods.sort()).toEqual(["clerk", "google"]);
  });

  it("prefers active over trialing when picking the plan source", () => {
    const merged = mergeByEmail([
      row({ id: 10, email: "b@example.com", subscriptionStatus: "trialing" }),
      row({ id: 11, email: "b@example.com", subscriptionStatus: "active", currentPeriodEnd: new Date("2026-05-01") }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].subscriptionStatus).toBe("active");
    expect(merged[0].currentPeriodEnd).toEqual(new Date("2026-05-01"));
  });

  it("does not merge rows that have no email", () => {
    const merged = mergeByEmail([
      row({ id: 20, email: null }),
      row({ id: 21, email: null }),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.every((u) => u.accountCount === 1)).toBe(true);
  });

  it("is case-insensitive on email when grouping", () => {
    const merged = mergeByEmail([
      row({ id: 30, email: "Mixed@Example.com" }),
      row({ id: 31, email: "mixed@example.com" }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].accountCount).toBe(2);
  });
});
