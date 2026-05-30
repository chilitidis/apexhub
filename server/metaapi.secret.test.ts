import { describe, expect, it } from "vitest";
import { isTokenValid } from "./_core/metaapiClient";

const HAS_TOKEN = typeof process.env.METAAPI_TOKEN === "string" && process.env.METAAPI_TOKEN.length > 0;

/**
 * Validates that the configured METAAPI_TOKEN can authenticate against the
 * MetaApi provisioning REST endpoint. Skipped in environments where the
 * secret has not been provided so the suite still runs locally.
 */
describe("METAAPI_TOKEN credential", () => {
  it.skipIf(!HAS_TOKEN)("authenticates against MetaApi provisioning API", async () => {
    const ok = await isTokenValid(process.env.METAAPI_TOKEN!);
    expect(ok).toBe(true);
  }, 20_000);

  it("rejects an empty token", async () => {
    const ok = await isTokenValid("");
    expect(ok).toBe(false);
  });
});
