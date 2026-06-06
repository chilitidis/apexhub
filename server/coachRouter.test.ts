import { describe, expect, it } from "vitest";
import { __test__ } from "./coachRouter";
import { COACH_CRITERIA_IDS, COACH_LIMITS } from "../shared/tradingCoach";

const { stripBase64Blobs, clean, buildResult, parseModelJson } = __test__;

describe("stripBase64Blobs", () => {
  it("removes data: URIs", () => {
    const input = "before data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk after";
    const out = stripBase64Blobs(input);
    expect(out).not.toContain("base64");
    expect(out).not.toContain("iVBOR");
    expect(out).toContain("before");
    expect(out).toContain("after");
  });

  it("removes standalone long base64-ish runs", () => {
    const blob = "A".repeat(120) + "==";
    const out = stripBase64Blobs(`text ${blob} more`);
    expect(out).not.toContain(blob);
    expect(out).toContain("text");
    expect(out).toContain("more");
  });

  it("leaves normal prose untouched", () => {
    const prose = "Καλό setup, έσπασε δύο supports.";
    expect(stripBase64Blobs(prose)).toBe(prose);
  });

  it("returns empty string for empty input", () => {
    expect(stripBase64Blobs("")).toBe("");
  });
});

describe("clean", () => {
  it("strips braces/brackets that hint at leaked JSON", () => {
    const out = clean('{"score": 85, "criteria": [ ] }', 600);
    expect(out).not.toContain("{");
    expect(out).not.toContain("[");
    expect(out).not.toContain("]");
    expect(out).not.toContain("}");
  });

  it("removes a base64 blob embedded in a field", () => {
    const out = clean("Σχόλιο data:image/png;base64,iVBORw0KGgoAAAANSUhEUg== τέλος", 600);
    expect(out).not.toContain("base64");
    expect(out).toContain("Σχόλιο");
    expect(out).toContain("τέλος");
  });

  it("collapses whitespace and caps length", () => {
    const long = "x ".repeat(500);
    const out = clean(long, 50);
    expect(out.length).toBeLessThanOrEqual(51); // 50 + ellipsis
    expect(out.endsWith("…")).toBe(true);
  });

  it("returns empty string for non-string input", () => {
    expect(clean(undefined, 100)).toBe("");
    expect(clean(123 as unknown, 100)).toBe("");
    expect(clean(null, 100)).toBe("");
  });
});

describe("parseModelJson", () => {
  it("parses raw JSON", () => {
    const v = parseModelJson('{"score":80,"pair":"EURUSD"}');
    expect(v).toMatchObject({ score: 80, pair: "EURUSD" });
  });

  it("parses JSON inside markdown code fences", () => {
    const v = parseModelJson("```json\n{\"score\":70}\n```");
    expect(v).toMatchObject({ score: 70 });
  });

  it("extracts the first balanced object from surrounding prose", () => {
    const v = parseModelJson('Εδώ είναι η ανάλυση: {"score":55,"direction":"long"} ευχαριστώ');
    expect(v).toMatchObject({ score: 55, direction: "long" });
  });

  it("returns null for garbage", () => {
    expect(parseModelJson("totally not json at all")).toBeNull();
    expect(parseModelJson("")).toBeNull();
  });
});

describe("buildResult", () => {
  it("returns the full criteria list in canonical order, filling gaps with unknown", () => {
    const result = buildResult({
      score: 82,
      pair: "NZDCHF",
      timeframe: "H1",
      direction: "short",
      comment: "Καθαρό short setup.",
      suggestion: "Κράτα το SL πάνω από το τελευταίο resistance.",
      criteria: [
        { id: "trend", status: "pass", note: "Καθοδική τάση." },
        { id: "ema50", status: "fail", note: "Πάνω από EMA50." },
      ],
    });

    expect(result.score).toBe(82);
    expect(result.verdict).toBe("suitable");
    expect(result.pair).toBe("NZDCHF");
    expect(result.timeframe).toBe("H1");
    expect(result.direction).toBe("short");
    expect(result.criteria).toHaveLength(COACH_CRITERIA_IDS.length);
    // Order matches the canonical criteria list.
    expect(result.criteria.map((c) => c.id)).toEqual([...COACH_CRITERIA_IDS]);
    // Provided ones keep their status; missing ones default to unknown.
    expect(result.criteria.find((c) => c.id === "trend")?.status).toBe("pass");
    expect(result.criteria.find((c) => c.id === "ema50")?.status).toBe("fail");
    expect(result.criteria.find((c) => c.id === "risk_reward")?.status).toBe("unknown");
  });

  it("never leaks a base64 blob into any text field", () => {
    const blob = "data:image/png;base64," + "iVBORw0KGgo".repeat(40) + "==";
    const result = buildResult({
      score: 60,
      pair: blob,
      timeframe: blob,
      direction: "long",
      comment: `Σχόλιο ${blob} τέλος`,
      suggestion: `Πρόταση ${blob}`,
      criteria: [{ id: "trend", status: "pass", note: `note ${blob}` }],
    });

    const all =
      result.pair +
      result.timeframe +
      result.comment +
      result.suggestion +
      result.criteria.map((c) => c.note).join(" ");
    expect(all).not.toContain("base64");
    expect(all).not.toContain("iVBOR");
  });

  it("clamps the score to 0-100 and derives the verdict band", () => {
    expect(buildResult({ score: 999, criteria: [] }).score).toBe(100);
    expect(buildResult({ score: -50, criteria: [] }).score).toBe(0);
    expect(buildResult({ score: 30, criteria: [] }).verdict).toBe("unsuitable");
    expect(buildResult({ score: 55, criteria: [] }).verdict).toBe("marginal");
    expect(buildResult({ score: 90, criteria: [] }).verdict).toBe("suitable");
  });

  it("handles missing/invalid fields without throwing", () => {
    const result = buildResult({});
    expect(result.score).toBe(0);
    expect(result.pair).toBe("");
    expect(result.direction).toBe("unknown");
    expect(result.criteria).toHaveLength(COACH_CRITERIA_IDS.length);
    expect(result.criteria.every((c) => c.status === "unknown")).toBe(true);
  });

  it("ignores criteria with unknown ids", () => {
    const result = buildResult({
      score: 50,
      criteria: [
        { id: "not_a_real_id", status: "pass", note: "should be dropped" },
        { id: "trend", status: "warn", note: "kept" },
      ],
    });
    expect(result.criteria.find((c) => c.id === "trend")?.status).toBe("warn");
    // The bogus id must not appear.
    expect(result.criteria.some((c) => (c.id as string) === "not_a_real_id")).toBe(false);
  });

  it("normalizes an invalid status to unknown", () => {
    const result = buildResult({
      score: 50,
      criteria: [{ id: "trend", status: "definitely-bad", note: "" }],
    });
    expect(result.criteria.find((c) => c.id === "trend")?.status).toBe("unknown");
  });

  it("caps note length to the configured limit", () => {
    const result = buildResult({
      score: 50,
      criteria: [{ id: "trend", status: "pass", note: "ν".repeat(1000) }],
    });
    const note = result.criteria.find((c) => c.id === "trend")?.note ?? "";
    expect(note.length).toBeLessThanOrEqual(COACH_LIMITS.note + 1);
  });
});
