import { describe, it, expect } from "vitest";
import { runBootstrap } from "./_core/bootstrap";

/**
 * Pure-function smoke tests: bootstrap must never throw, even when
 * DATABASE_URL is missing. That guarantees the Express server still
 * boots on Railway when env vars are partially configured (e.g. user
 * forgot to set DATABASE_URL) so the SPA can render the error toast.
 */
describe("server bootstrap", () => {
  it("does not throw when DATABASE_URL is empty", async () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      await expect(runBootstrap()).resolves.toBeUndefined();
    } finally {
      if (original !== undefined) process.env.DATABASE_URL = original;
    }
  });

  it("does not throw when DATABASE_URL points at an unreachable host", async () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL =
      "mysql://root:nope@127.0.0.1:1/does_not_exist?connectTimeout=200";
    try {
      await expect(runBootstrap()).resolves.toBeUndefined();
    } finally {
      if (original === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = original;
    }
  });
});
