import { describe, it, expect } from "vitest";
import { fmtUSD, fmtUSDnoSign, fmtPct } from "./trading";

// These are the helpers used across KPI cards, drawer banner, desktop/mobile
// trade rows, and the Symbol Performance table to render P/L in both $ and %.
// The Home.tsx surfaces concatenate these formatters, so covering them here
// guards against regressions in the displayed $/% text.

describe("P/L formatters (used for both $ and % displays)", () => {
  it("fmtUSD returns a signed dollar string for positive values", () => {
    const s = fmtUSD(1234.5);
    expect(s.startsWith("+$")).toBe(true);
    expect(s).toMatch(/1\D?234/); // locale separator agnostic
  });

  it("fmtUSD returns a signed dollar string for negative values", () => {
    const s = fmtUSD(-42);
    expect(s.startsWith("-$")).toBe(true);
    expect(s).toMatch(/42/);
  });

  it("fmtUSD shows placeholder for null/undefined", () => {
    expect(fmtUSD(null)).toBe("—");
    expect(fmtUSD(undefined)).toBe("—");
  });

  it("fmtUSDnoSign drops the sign", () => {
    const s = fmtUSDnoSign(5000);
    expect(s.startsWith("$")).toBe(true);
    expect(s).not.toMatch(/^[+-]/);
  });

  it("fmtPct renders a signed percentage", () => {
    expect(fmtPct(0.0524)).toMatch(/^\+5[.,]24%$/);
    expect(fmtPct(-0.01)).toMatch(/^-1[.,]00%$/);
  });

  it("fmtPct placeholder for null/undefined", () => {
    expect(fmtPct(null)).toBe("—");
    expect(fmtPct(undefined)).toBe("—");
  });

  it("a typical KPI cell combines $ and %", () => {
    const pnl = 123.45;
    const starting = 10_000;
    const combined = `${fmtUSD(pnl)} (${fmtPct(pnl / starting)})`;
    expect(combined.startsWith("+$")).toBe(true);
    expect(combined).toContain("(+1");
    expect(combined).toContain("%)");
  });
});
