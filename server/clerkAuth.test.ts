// server/clerkAuth.test.ts — verifies the Clerk auth bridge does not regress.
//
// Goals:
//   1. When Clerk is not configured (no secret key), `clerkConfigured()` is
//      false and `authenticateClerkRequest` returns null without throwing.
//   2. Invalid tokens return null (never throw).
//   3. Missing Authorization header + no __session cookie → null.
//   4. Malformed Authorization header → null.
//
// We deliberately don't hit Clerk's real API here — those flows are covered
// by `clerk.secret.test.ts` which validates that CLERK_SECRET_KEY is live.
// This file runs without network.

import { describe, expect, it, beforeEach } from "vitest";

async function withEnv(
  env: Partial<Record<string, string | undefined>>,
  fn: () => Promise<void>
) {
  const snapshot: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) snapshot[k] = process.env[k];
  Object.assign(process.env, env);
  try {
    await fn();
  } finally {
    for (const [k, v] of Object.entries(snapshot)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

function fakeReq(headers: Record<string, string> = {}) {
  return { headers } as unknown as import("http").IncomingMessage;
}

describe("clerkAuth", () => {
  beforeEach(() => {
    // Ensure no leftover module cache holds stale env pointers.
  });

  it("reports not-configured when CLERK_SECRET_KEY is empty", async () => {
    await withEnv(
      { CLERK_SECRET_KEY: "", VITE_CLERK_PUBLISHABLE_KEY: "" },
      async () => {
        const mod = await import("./_core/clerkAuth?not-configured");
        expect(mod.clerkConfigured()).toBe(false);
        const user = await mod.authenticateClerkRequest(fakeReq());
        expect(user).toBeNull();
      }
    );
  });

  it("returns null when no token is present on the request", async () => {
    await withEnv(
      {
        CLERK_SECRET_KEY: "sk_test_dummy_for_shape_only",
        VITE_CLERK_PUBLISHABLE_KEY: "pk_test_dummy_for_shape_only",
      },
      async () => {
        const mod = await import("./_core/clerkAuth?no-token");
        // clerkConfigured() is true here because both env vars are truthy,
        // but without a token we should short-circuit to null before hitting
        // Clerk's API.
        expect(mod.clerkConfigured()).toBe(true);
        const user = await mod.authenticateClerkRequest(fakeReq());
        expect(user).toBeNull();
      }
    );
  });

  it("returns null when Authorization is malformed", async () => {
    await withEnv(
      {
        CLERK_SECRET_KEY: "sk_test_dummy_for_shape_only",
        VITE_CLERK_PUBLISHABLE_KEY: "pk_test_dummy_for_shape_only",
      },
      async () => {
        const mod = await import("./_core/clerkAuth?malformed");
        const user = await mod.authenticateClerkRequest(
          fakeReq({ authorization: "NotBearer abc" })
        );
        expect(user).toBeNull();
      }
    );
  });

  it("returns null when __session cookie is empty", async () => {
    await withEnv(
      {
        CLERK_SECRET_KEY: "sk_test_dummy_for_shape_only",
        VITE_CLERK_PUBLISHABLE_KEY: "pk_test_dummy_for_shape_only",
      },
      async () => {
        const mod = await import("./_core/clerkAuth?empty-cookie");
        const user = await mod.authenticateClerkRequest(
          fakeReq({ cookie: "other=foo; __session=" })
        );
        expect(user).toBeNull();
      }
    );
  });

  it("returns null when token verification fails (invalid jwt)", async () => {
    await withEnv(
      {
        CLERK_SECRET_KEY: "sk_test_dummy_for_shape_only",
        VITE_CLERK_PUBLISHABLE_KEY: "pk_test_dummy_for_shape_only",
      },
      async () => {
        const mod = await import("./_core/clerkAuth?bad-jwt");
        const user = await mod.authenticateClerkRequest(
          fakeReq({ authorization: "Bearer not.a.jwt" })
        );
        expect(user).toBeNull();
      }
    );
  });
});
