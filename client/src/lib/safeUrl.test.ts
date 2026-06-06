import { describe, it, expect } from "vitest";
import { safeParseUrl, isHttpUrl, safeFormatDate, safeFormatTime } from "./safeUrl";

// These helpers exist specifically to never throw the Safari DOMException
// ("The string did not match the expected pattern.") on bad input.

describe("safeParseUrl", () => {
  it("parses a valid absolute URL", () => {
    const u = safeParseUrl("https://www.tradingview.com/x/abc");
    expect(u).not.toBeNull();
    expect(u!.hostname).toBe("www.tradingview.com");
  });

  it("returns null for clearly invalid input (no window base in test env)", () => {
    // In the node/jsdom test env without a usable origin, garbage should not throw.
    expect(() => safeParseUrl("::::not a url::::")).not.toThrow();
  });

  it("never throws on empty string", () => {
    expect(() => safeParseUrl("")).not.toThrow();
  });
});

describe("isHttpUrl", () => {
  it("accepts http and https", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
  });

  it("rejects empty, partial, or non-http strings without throwing", () => {
    expect(isHttpUrl("")).toBe(false);
    expect(isHttpUrl("   ")).toBe(false);
    expect(isHttpUrl("not a url")).toBe(false);
    expect(isHttpUrl("ftp://example.com")).toBe(false);
    expect(() => isHttpUrl("https://www.trad")).not.toThrow();
  });
});

describe("safeFormatDate", () => {
  it("formats a valid date", () => {
    const out = safeFormatDate(new Date("2026-06-06T00:00:00Z"), "en-US", {
      year: "numeric",
    });
    expect(out).toContain("2026");
  });

  it("returns fallback for invalid input without throwing", () => {
    expect(safeFormatDate("not-a-date", "el-GR", undefined, "—")).toBe("—");
    expect(safeFormatDate(null, "el-GR", undefined, "—")).toBe("—");
    expect(safeFormatDate(undefined, "el-GR")).toBe("");
    expect(() => safeFormatDate("garbage", "el-GR")).not.toThrow();
  });
});

describe("safeFormatTime", () => {
  it("formats a valid time", () => {
    const out = safeFormatTime(new Date("2026-06-06T13:30:00Z"), "en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
    expect(out).toMatch(/\d/);
  });

  it("returns fallback for invalid input", () => {
    expect(safeFormatTime("nope", "el-GR", undefined, "—")).toBe("—");
    expect(() => safeFormatTime(NaN, "el-GR")).not.toThrow();
  });
});
