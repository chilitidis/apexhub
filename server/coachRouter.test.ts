import { describe, it, expect } from "vitest";
import { COACH_CRITERIA, COACH_CRITERIA_IDS } from "@shared/coach";
import { __test__ } from "./coachRouter";

const { parseResult } = __test__;

describe("coach parseResult", () => {
  it("normalises a complete valid model response", () => {
    const raw = JSON.stringify({
      pair: "EURUSD",
      timeframe: "H1",
      direction: "long",
      verdict: "Suitable",
      score: 82,
      summary: "Καθαρό setup με breakout και retest.",
      criteria: COACH_CRITERIA.map((c) => ({
        id: c.id,
        status: "pass",
        comment: "ok",
      })),
    });
    const r = parseResult(raw);
    expect(r.pair).toBe("EURUSD");
    expect(r.timeframe).toBe("H1");
    expect(r.direction).toBe("LONG");
    expect(r.verdict).toBe("Suitable");
    expect(r.score).toBe(82);
    expect(r.criteria).toHaveLength(COACH_CRITERIA.length);
    expect(r.criteria.every((c) => c.status === "pass")).toBe(true);
  });

  it("fills missing criteria with 'unknown' and keeps known ids only", () => {
    const raw = JSON.stringify({
      pair: "USDJPY",
      timeframe: "H4",
      direction: "SHORT",
      verdict: "Marginal",
      score: 60,
      summary: "",
      criteria: [
        { id: "trend", status: "pass", comment: "uptrend" },
        { id: "not_a_real_criterion", status: "fail", comment: "ignored" },
      ],
    });
    const r = parseResult(raw);
    // one entry per known criterion
    expect(r.criteria).toHaveLength(COACH_CRITERIA.length);
    const trend = r.criteria.find((c) => c.id === "trend")!;
    expect(trend.status).toBe("pass");
    const rest = r.criteria.filter((c) => c.id !== "trend");
    expect(rest.every((c) => c.status === "unknown")).toBe(true);
    // bogus id is never present
    expect(
      r.criteria.some((c) => !COACH_CRITERIA_IDS.includes(c.id)),
    ).toBe(false);
  });

  it("clamps score to 0-100 and maps Greek verdicts", () => {
    const raw = JSON.stringify({
      pair: "",
      timeframe: "",
      direction: "",
      verdict: "Ακατάλληλο",
      score: 250,
      summary: "x",
      criteria: [],
    });
    const r = parseResult(raw);
    expect(r.score).toBe(100);
    expect(r.verdict).toBe("Unsuitable");
  });

  it("normalises invalid status values to 'unknown'", () => {
    const raw = JSON.stringify({
      pair: "GBPUSD",
      timeframe: "H1",
      direction: "LONG",
      verdict: "Marginal",
      score: 55,
      summary: "x",
      criteria: [{ id: "rr", status: "maybe", comment: "?" }],
    });
    const r = parseResult(raw);
    const rr = r.criteria.find((c) => c.id === "rr")!;
    expect(rr.status).toBe("unknown");
  });

  it("recovers JSON wrapped in markdown fences", () => {
    const raw =
      "```json\n" +
      JSON.stringify({
        pair: "XAUUSD",
        timeframe: "H1",
        direction: "LONG",
        verdict: "Suitable",
        score: 90,
        summary: "ok",
        criteria: [],
      }) +
      "\n```";
    const r = parseResult(raw);
    expect(r.pair).toBe("XAUUSD");
    expect(r.verdict).toBe("Suitable");
  });

  it("defaults to Marginal for unrecognised verdicts", () => {
    const raw = JSON.stringify({
      pair: "",
      timeframe: "",
      direction: "",
      verdict: "whatever",
      score: 40,
      summary: "",
      criteria: [],
    });
    const r = parseResult(raw);
    expect(r.verdict).toBe("Marginal");
  });
});
