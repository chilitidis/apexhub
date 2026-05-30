import { describe, expect, it, beforeAll } from "vitest";
import { decryptPassword, encryptPassword } from "./_core/cryptoCreds";

beforeAll(() => {
  // Ensure a deterministic JWT_SECRET so the suite can run in any environment.
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    process.env.JWT_SECRET = "test-jwt-secret-1234567890";
  }
});

describe("MT5 credential encryption", () => {
  it("round-trips a typical broker password", () => {
    const pwd = "Tr@d3r!2026Pass";
    const ct = encryptPassword(pwd);
    expect(ct).not.toBe(pwd);
    expect(ct.length).toBeGreaterThan(40);
    expect(decryptPassword(ct)).toBe(pwd);
  });

  it("produces a different ciphertext on each call (random IV)", () => {
    const a = encryptPassword("samepassword");
    const b = encryptPassword("samepassword");
    expect(a).not.toBe(b);
    expect(decryptPassword(a)).toBe("samepassword");
    expect(decryptPassword(b)).toBe("samepassword");
  });

  it("rejects tampered ciphertext via GCM auth tag", () => {
    const ct = encryptPassword("hello");
    // Flip the last byte of the base64 payload after decoding to ensure
    // we are tampering with the actual ciphertext, not just padding.
    const buf = Buffer.from(ct, "base64");
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString("base64");
    expect(() => decryptPassword(tampered)).toThrow();
  });

  it("rejects empty / too-short payloads", () => {
    expect(() => decryptPassword("")).toThrow();
    expect(() => decryptPassword("AAAA")).toThrow();
  });
});
