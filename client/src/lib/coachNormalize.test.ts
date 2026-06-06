import { describe, it, expect } from "vitest";
import { normalizeAnalysis, sanitizeSummary } from "./coachNormalize";

// Reproduces the exact failure mode from the user's screenshot: the analysis
// result arriving with criteria as a JSON string and/or the whole structured
// payload leaking into the summary. The UI must NEVER render raw JSON.

const SCREENSHOT_CRITERIA = JSON.stringify([
  { id: "breakout_retest", label: "Breakout + Retest", status: "pass", comment: "ok" },
  { id: "ema50", label: "EMA50", status: "pass", comment: "below" },
  { id: "rr", label: "Risk / Reward", status: "warn", comment: "1:1.5" },
]);

describe("normalizeAnalysis", () => {
  it("parses criteria when it arrives as a JSON string", () => {
    const a = normalizeAnalysis({
      pair: "NZDCHF",
      timeframe: "H1",
      direction: "SHORT",
      verdict: "Marginal",
      score: 62,
      summary: "Καλό setup με οριακό RR.",
      criteria: SCREENSHOT_CRITERIA,
    });
    expect(Array.isArray(a.criteria)).toBe(true);
    expect(a.criteria).toHaveLength(3);
    expect(a.criteria[0].id).toBe("breakout_retest");
    expect(a.summary).toBe("Καλό setup με οριακό RR.");
  });

  it("handles criteria already as an array", () => {
    const a = normalizeAnalysis({
      verdict: "Suitable",
      score: 80,
      criteria: [{ id: "trend", label: "Trend", status: "pass", comment: "up" }],
    });
    expect(a.criteria).toHaveLength(1);
    expect(a.verdict).toBe("Suitable");
  });

  it("never lets raw JSON leak into summary", () => {
    const leaked =
      '{"verdict":"Marginal","score":62,"criteria":' +
      SCREENSHOT_CRITERIA +
      ',"summary":"Συνολικά καλό setup."}';
    const a = normalizeAnalysis({
      verdict: "Marginal",
      score: 62,
      summary: leaked,
      criteria: SCREENSHOT_CRITERIA,
    });
    expect(a.summary).toBe("Συνολικά καλό setup.");
    expect(a.summary.startsWith("{")).toBe(false);
  });

  it("clamps score and defaults verdict", () => {
    const a = normalizeAnalysis({ score: 999, verdict: "Nonsense" });
    expect(a.score).toBe(100);
    expect(a.verdict).toBe("Marginal");
  });

  it("returns empty criteria for unparseable string", () => {
    const a = normalizeAnalysis({ criteria: "not json at all" });
    expect(a.criteria).toEqual([]);
  });
});

describe("sanitizeSummary", () => {
  it("passes through normal prose", () => {
    expect(sanitizeSummary("Ωραίο setup.", [])).toBe("Ωραίο setup.");
  });

  it("strips a JSON array that has no usable summary", () => {
    const raw = '[{"id":"breakout_retest","status":"pass"}]';
    expect(sanitizeSummary(raw, [])).toBe("");
  });

  it("extracts the inner summary from a leaked JSON object", () => {
    const raw = '{"score":62,"summary":"Καλό RR.","criteria":[]}';
    expect(sanitizeSummary(raw, [])).toBe("Καλό RR.");
  });

  it("unwraps markdown-fenced JSON", () => {
    const raw = '```json\n{"summary":"From fence."}\n```';
    expect(sanitizeSummary(raw, [])).toBe("From fence.");
  });

  it("returns empty for non-string input", () => {
    expect(sanitizeSummary(null, [])).toBe("");
    expect(sanitizeSummary(undefined, [])).toBe("");
    expect(sanitizeSummary(42, [])).toBe("");
  });
});
