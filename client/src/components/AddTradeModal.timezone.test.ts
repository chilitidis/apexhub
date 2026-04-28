/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Regression test for the "screenshot scanner shifts the trade time by 3 hours"
 * bug:
 *
 *   The MT5 screenshot showed `2026.04.28 05:09:22 -> 13:25:48`. The LLM
 *   responded with `2026-04-28T05:09:22Z` (UTC) and the form re-rendered it as
 *   `08:09 πμ` in Athens (UTC+3). The fix: the AddTradeModal must strip any
 *   `Z` / `+HH:MM` suffix before parsing the timestamp so the digits are
 *   interpreted as local wall-clock time.
 */
describe("AddTradeModal — MT5 wall-clock timestamps", () => {
  const src = readFileSync(
    resolve(__dirname, "AddTradeModal.tsx"),
    "utf-8",
  );

  it("declares a stripTimezoneSuffix helper", () => {
    expect(src).toMatch(/function\s+stripTimezoneSuffix\s*\(/);
  });

  it("parseFlexibleDate routes through stripTimezoneSuffix", () => {
    expect(src).toMatch(/parseFlexibleDate[\s\S]{0,400}?stripTimezoneSuffix/);
  });

  it("convertMT5Time returns a wall-clock string (no Z, no toISOString)", () => {
    // The convertMT5Time function block must NOT call toISOString anymore
    // because that would pin the Date to UTC and lose the broker timezone.
    const block = src.match(/convertMT5Time = \([\s\S]{0,800}?\n  \};/);
    expect(block).not.toBeNull();
    expect(block![0]).not.toContain("toISOString");
    // It must build the YYYY-MM-DDTHH:MM:SS template directly.
    expect(block![0]).toContain("${year}-${month}-${day}T");
  });

  it("matches and strips a trailing Z via the regex", () => {
    const re = /(Z|[+\-]\d{2}:?\d{2})$/i;
    expect("2026-04-28T05:09:22Z".replace(re, "")).toBe("2026-04-28T05:09:22");
    expect("2026-04-28T05:09:22+03:00".replace(re, "")).toBe(
      "2026-04-28T05:09:22",
    );
    expect("2026-04-28T05:09:22-0500".replace(re, "")).toBe(
      "2026-04-28T05:09:22",
    );
    // Plain wall-clock strings stay unchanged.
    expect("2026-04-28T05:09:22".replace(re, "")).toBe("2026-04-28T05:09:22");
  });
});
