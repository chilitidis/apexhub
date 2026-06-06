import { describe, it, expect } from "vitest";
import { COACH_CRITERIA, COACH_CRITERIA_IDS } from "@shared/coach";
import { __test__ } from "./coachRouter";

const {
  parseResult,
  extractJsonObject,
  flattenContent,
  sanitizeSummaryServer,
  extractCriteriaArray,
} = __test__;

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

  it("returns an empty object when no JSON is present", () => {
    expect(extractJsonObject("no json here")).toEqual({});
  });

  it("prefers the analysis object over a stray criterion object", () => {
    const raw =
      'leading {"id":"trend","status":"pass","comment":"x"} ' +
      '{"verdict":"Suitable","score":80,"criteria":[]} trailing';
    const o = extractJsonObject(raw);
    expect(o.verdict).toBe("Suitable");
  });
});

describe("coach sanitizeSummaryServer", () => {
  it("keeps plain prose", () => {
    expect(sanitizeSummaryServer("Καλό setup.")).toBe("Καλό setup.");
  });

  it("suppresses raw JSON arrays/objects", () => {
    expect(sanitizeSummaryServer('[{"id":"trend","status":"pass"}]')).toBe("");
    expect(
      sanitizeSummaryServer('{"verdict":"Suitable","criteria":[]}'),
    ).toBe("");
  });

  it("recovers an embedded summary string", () => {
    expect(
      sanitizeSummaryServer('{"summary":"Ωραίο setup","score":80}'),
    ).toBe("Ωραίο setup");
  });
});

describe("coach extractCriteriaArray", () => {
  it("extracts a criteria array from broken/trailing-prose output", () => {
    const raw =
      '[{"id":"trend","status":"pass","comment":"a"},' +
      '{"id":"rr","status":"warn","comment":"b"}],Αυτό το setup...';
    const arr = extractCriteriaArray(raw);
    expect(arr).toHaveLength(2);
  });
});

describe("coach parseResult — screenshot bug (broken JSON)", () => {
  it("recovers criteria and never leaks raw JSON into summary", () => {
    // Reproduces the reported screenshot: criteria array followed by a stray
    // summary sentence, with no proper top-level object wrapper.
    const raw =
      '{"criteria":[' +
      '{"id":"breakout_retest","status":"pass","comment":"καθαρό breakout"},' +
      '{"id":"ema50","status":"pass","comment":"πάνω από EMA50"},' +
      '{"id":"rr","status":"pass","comment":"καλό RR"}' +
      ']},Αυτό το setup παρουσιάζει ισχυρή τάση.';
    const r = parseResult(raw);
    // criteria recovered
    const breakout = r.criteria.find((c) => c.id === "breakout_retest")!;
    expect(breakout.status).toBe("pass");
    // summary must NOT contain raw JSON
    expect(r.summary.includes('"id"')).toBe(false);
    expect(r.summary.includes("{")).toBe(false);
  });

  it("recovers criteria when wrapper object is entirely missing", () => {
    const raw =
      '[{"id":"trend","status":"pass","comment":"ok"},' +
      '{"id":"stop_loss","status":"warn","comment":"tight"}]';
    const r = parseResult(raw);
    const trend = r.criteria.find((c) => c.id === "trend")!;
    expect(trend.status).toBe("pass");
    const sl = r.criteria.find((c) => c.id === "stop_loss")!;
    expect(sl.status).toBe("warn");
  });

  it("does not mistake a criterion object's own summary for the analysis summary", () => {
    // A single criterion object that happens to carry a `summary` key, followed
    // by the real trailing prose. extractJsonObject must NOT trust that
    // criterion-level summary (it lacks verdict/score/criteria); parseResult
    // should recover the trailing prose instead.
    const raw =
      '[{"id":"breakout_retest","status":"pass","comment":"ok","summary":"comment leak"}] ' +
      "Συνολικά το setup είναι κατάλληλο για είσοδο.";
    const r = parseResult(raw);
    const breakout = r.criteria.find((c) => c.id === "breakout_retest")!;
    expect(breakout.status).toBe("pass");
    expect(r.summary).toBe("Συνολικά το setup είναι κατάλληλο για είσοδο.");
    expect(r.summary.includes("comment leak")).toBe(false);
    expect(r.summary.includes("{")).toBe(false);
  });
});


const {
  parseTradingViewSnapshotId,
  tradingViewSnapshotUrl,
  buildNotesOnlyResult,
  runAnalysis,
} = __test__;

describe("coach TradingView snapshot helpers (BUG 2)", () => {
  it("parses the snapshot id from a /x/ link", () => {
    expect(
      parseTradingViewSnapshotId("https://www.tradingview.com/x/0t0MXumN/"),
    ).toBe("0t0MXumN");
  });

  it("parses the snapshot id from a /chart/ link", () => {
    expect(
      parseTradingViewSnapshotId("https://tradingview.com/chart/AbCdEf12/"),
    ).toBe("AbCdEf12");
  });

  it("returns null for a non-TradingView url", () => {
    expect(parseTradingViewSnapshotId("https://example.com/x/abc")).toBeNull();
  });

  it("builds the s3 snapshot url with lowercased first char", () => {
    expect(tradingViewSnapshotUrl("0t0MXumN")).toBe(
      "https://s3.tradingview.com/snapshots/0/0t0MXumN.png",
    );
    expect(tradingViewSnapshotUrl("AbCdEf12")).toBe(
      "https://s3.tradingview.com/snapshots/a/AbCdEf12.png",
    );
  });
});

describe("coach notes-only mode (BUG 2 anti-hallucination)", () => {
  it("never invents a pair/timeframe/direction when no image", () => {
    const r = buildNotesOnlyResult({
      visionImageUrl: null,
      tvLink: "https://www.tradingview.com/x/0t0MXumN/",
      note: "",
    });
    expect(r.pair).toBe("");
    expect(r.timeframe).toBe("");
    expect(r.direction).toBe("");
    // Every criterion must be unknown (nothing was actually seen).
    expect(r.criteria.every((c) => c.status === "unknown")).toBe(true);
    expect(r.criteria.length).toBe(COACH_CRITERIA.length);
    // Summary must be plain prose asking for a screenshot, never JSON.
    expect(r.summary).toContain("screenshot");
    expect(r.summary).not.toContain("{");
    expect(r.summary).not.toContain("[");
  });

  it("acknowledges trader notes but still asks for a screenshot", () => {
    const r = buildNotesOnlyResult({
      visionImageUrl: null,
      tvLink: "https://www.tradingview.com/x/0t0MXumN/",
      note: "EURUSD short, RR 1:3",
    });
    expect(r.summary).toContain("σημειώσεις");
    expect(r.summary).toContain("screenshot");
    // Critically, it must NOT echo the trader's claimed pair as a detected pair.
    expect(r.pair).toBe("");
  });

  it("runAnalysis short-circuits to notes-only when there is no real image", async () => {
    const r = await runAnalysis({
      visionImageUrl: null,
      tvLink: "https://www.tradingview.com/x/0t0MXumN/",
      note: "",
      imageIsReal: false,
      tvSnapshotFetched: false,
    });
    expect(r.pair).toBe("");
    expect(r.criteria.every((c) => c.status === "unknown")).toBe(true);
    expect(r.summary).not.toContain("{");
  });
});
