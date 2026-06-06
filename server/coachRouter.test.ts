import { describe, it, expect } from "vitest";
import { COACH_CRITERIA, COACH_CRITERIA_IDS } from "@shared/coach";
import { __test__ } from "./coachRouter";

const { parseResult, extractJsonObject, flattenContent } = __test__;

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

  it("recovers JSON with leading/trailing prose around the object", () => {
    const payload = {
      pair: "NZDCHF",
      timeframe: "H1",
      direction: "SHORT",
      verdict: "Marginal",
      score: 64,
      summary: "ok",
      criteria: [],
    };
    const raw =
      "Εδώ είναι η ανάλυση:\n" +
      JSON.stringify(payload) +
      "\nΕλπίζω να βοηθάει.";
    const r = parseResult(raw);
    expect(r.pair).toBe("NZDCHF");
    expect(r.verdict).toBe("Marginal");
    expect(r.score).toBe(64);
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

describe("coach flattenContent", () => {
  it("returns plain strings as-is", () => {
    expect(flattenContent('{"a":1}')).toBe('{"a":1}');
  });

  it("joins an array of text parts", () => {
    const parts = [
      { type: "text", text: '{"pair":' },
      { type: "text", text: '"EURUSD"}' },
    ];
    expect(flattenContent(parts)).toBe('{"pair":"EURUSD"}');
  });

  it("handles nested text.value parts", () => {
    const parts = [{ type: "text", text: { value: "hello" } }];
    expect(flattenContent(parts)).toBe("hello");
  });

  it("reads .text from a single object", () => {
    expect(flattenContent({ text: "x" })).toBe("x");
  });

  it("returns empty string for null/undefined/number", () => {
    expect(flattenContent(null)).toBe("");
    expect(flattenContent(undefined)).toBe("");
    expect(flattenContent(42)).toBe("");
  });

  it("a flattened array of parts still parses through parseResult", () => {
    const payload = JSON.stringify({
      pair: "EURUSD",
      timeframe: "H1",
      direction: "LONG",
      verdict: "Suitable",
      score: 80,
      summary: "ok",
      criteria: [],
    });
    const half = Math.floor(payload.length / 2);
    const parts = [
      { type: "text", text: payload.slice(0, half) },
      { type: "text", text: payload.slice(half) },
    ];
    const r = parseResult(flattenContent(parts));
    expect(r.pair).toBe("EURUSD");
    expect(r.verdict).toBe("Suitable");
  });
});

describe("coach extractJsonObject", () => {
  it("parses a plain JSON object", () => {
    const o = extractJsonObject('{"a":1,"b":"x"}');
    expect(o.a).toBe(1);
    expect(o.b).toBe("x");
  });

  it("parses a fenced JSON object", () => {
    const o = extractJsonObject('```json\n{"a":2}\n```');
    expect(o.a).toBe(2);
  });

  it("extracts the first balanced object from surrounding prose", () => {
    const o = extractJsonObject('before {"a":{"nested":true},"b":3} after');
    expect((o.a as Record<string, unknown>).nested).toBe(true);
    expect(o.b).toBe(3);
  });

  it("is not confused by braces inside strings", () => {
    const o = extractJsonObject('{"text":"a } b { c","n":5}');
    expect(o.text).toBe("a } b { c");
    expect(o.n).toBe(5);
  });

  it("throws when no JSON object is present", () => {
    expect(() => extractJsonObject("no json here")).toThrow();
  });
});
