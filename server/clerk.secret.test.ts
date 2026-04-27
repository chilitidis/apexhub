import { describe, it, expect } from "vitest";

/**
 * Lightweight health check for the configured Clerk credentials.
 *
 * - Hits the public endpoint `GET https://api.clerk.com/v1/jwks`
 *   with the server-side `CLERK_SECRET_KEY`. Clerk accepts this
 *   authenticated request and returns the JWKS used to verify session
 *   tokens. A 200 means the key is valid; 401/403 means it's wrong.
 *
 * - Also asserts that `VITE_CLERK_PUBLISHABLE_KEY` has the expected
 *   `pk_test_` / `pk_live_` shape so we fail loudly on typos before
 *   the frontend renders.
 */
describe("Clerk credentials", () => {
  const sk = process.env.CLERK_SECRET_KEY ?? "";
  const pk = process.env.VITE_CLERK_PUBLISHABLE_KEY ?? "";

  it("has a well-formed publishable key", () => {
    expect(pk).toMatch(/^pk_(test|live)_/);
  });

  it("has a well-formed secret key", () => {
    expect(sk).toMatch(/^sk_(test|live)_/);
  });

  it("can call the Clerk Backend API with the secret key", async () => {
    if (!sk) {
      // If the secret isn't configured, skip rather than fail the suite.
      return;
    }
    const resp = await fetch("https://api.clerk.com/v1/jwks", {
      headers: { Authorization: `Bearer ${sk}` },
    });
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { keys?: Array<unknown> };
    expect(Array.isArray(body.keys)).toBe(true);
    expect((body.keys ?? []).length).toBeGreaterThan(0);
  }, 10_000);
});
