import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
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
  });
});
