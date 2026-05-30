import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

/**
 * Smoke test for the MT5 router. We don't exercise the live MetaApi roundtrip
 * here — that's covered by `metaapi.secret.test.ts` which validates the token
 * against MetaApi's provisioning API. Here we just confirm the router is
 * mounted and that the procedure inputs reject obviously bad values so the
 * contract stays stable for the frontend.
 */
type AnyRouter = { _def: { procedures: Record<string, unknown> } };
type AnyProc = { _def: { inputs?: Array<{ safeParse: (v: unknown) => { success: boolean } }> } };

describe("mt5 router", () => {
  const procs = (appRouter as unknown as AnyRouter)._def.procedures;

  it("mounts mt5.list / mt5.upsert / mt5.sync / mt5.delete on appRouter", () => {
    expect(procs).toHaveProperty("mt5.list");
    expect(procs).toHaveProperty("mt5.upsert");
    expect(procs).toHaveProperty("mt5.sync");
    expect(procs).toHaveProperty("mt5.delete");
  });

  it("upsert input schema enforces required fields and rejects empty password", () => {
    const upsert = procs["mt5.upsert"] as AnyProc;
    const input = upsert._def.inputs?.[0];
    expect(input).toBeDefined();
    if (!input) return;
    expect(input.safeParse({}).success).toBe(false);
    expect(
      input.safeParse({
        accountId: 1,
        platform: "mt5",
        server: "ICMarkets-Live02",
        login: "123456",
        password: "",
      }).success,
    ).toBe(false);
    expect(
      input.safeParse({
        accountId: 1,
        platform: "mt5",
        server: "ICMarkets-Live02",
        login: "123456",
        password: "secret-investor",
      }).success,
    ).toBe(true);
  });

  it("sync input schema requires a positive integer id", () => {
    const sync = procs["mt5.sync"] as AnyProc;
    const input = sync._def.inputs?.[0];
    expect(input).toBeDefined();
    if (!input) return;
    expect(input.safeParse({ id: 0 }).success).toBe(false);
    expect(input.safeParse({ id: -3 }).success).toBe(false);
    expect(input.safeParse({ id: 7 }).success).toBe(true);
    expect(input.safeParse({ id: 7, sinceMs: 1700000000000 }).success).toBe(true);
  });
});
