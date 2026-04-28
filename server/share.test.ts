import { describe, expect, it } from "vitest";

import { generateShareToken } from "./db";

describe("generateShareToken", () => {
  it("produces 10-character URL-safe tokens", () => {
    for (let i = 0; i < 20; i += 1) {
      const tok = generateShareToken();
      expect(tok).toHaveLength(10);
      // Only lowercase alnum allowed by the alphabet.
      expect(tok).toMatch(/^[a-z0-9]{10}$/);
    }
  });

  it("has high uniqueness across a batch of 500 tokens", () => {
    const batch = new Set<string>();
    for (let i = 0; i < 500; i += 1) batch.add(generateShareToken());
    // ~52 bits of entropy; 0 collisions is overwhelmingly likely.
    expect(batch.size).toBe(500);
  });
});
