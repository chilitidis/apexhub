// server/storage.fallback.test.ts - verifies storagePut gracefully falls back
// to a data: URL when the R2 environment variables are absent, which keeps the
// screenshot scanner working on vanilla Railway / Docker deployments without
// extra secrets.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const R2_KEYS = [
  "R2_ENDPOINT",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_REGION",
] as const;

describe("storagePut fallback", () => {
  let snapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    snapshot = {};
    for (const key of R2_KEYS) {
      snapshot[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of R2_KEYS) {
      if (snapshot[key] === undefined) delete process.env[key];
      else process.env[key] = snapshot[key];
    }
  });

  it("returns a data: URL when R2 is not configured", async () => {
    const mod = await import("./storage?no-r2");
    expect(mod.storageConfigured()).toBe(false);
    const payload = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header bytes
    const { key, url } = await mod.storagePut(
      "1/trade-screenshots/test.png",
      payload,
      "image/png",
    );
    expect(key).toMatch(/^1\/trade-screenshots\/test_[a-f0-9]{8}\.png$/);
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    expect(url.endsWith(payload.toString("base64"))).toBe(true);
  });

  it("refuses to sign URLs for legacy objects when R2 is not configured", async () => {
    const mod = await import("./storage?no-r2-sign");
    await expect(mod.storageGetSignedUrl("some-key")).rejects.toThrow(
      /Screenshot storage is not configured/,
    );
  });
});
