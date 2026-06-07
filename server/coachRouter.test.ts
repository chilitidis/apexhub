import { describe, expect, it } from "vitest";
import { __test__ } from "./coachRouter";
import { COACH_CRITERIA_IDS, COACH_LIMITS } from "../shared/tradingCoach";

const {
  stripBase64Blobs,
  stripSourceRefs,
  clean,
  cleanProse,
  buildResult,
  parseModelJson,
  buildKnowledgeSystemPrompt,
} = __test__;

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

describe("stripSourceRefs", () => {
  it("removes parenthetical lesson/guide citations", () => {
    const input =
      'Καλό RR (φαίνεται πάνω από 1:2), κάτι απαραίτητο σύμφωνα με το checklist μας ("ApexHub VIP — Συμπληρωματικός Οδηγός", ενότητα 2).';
    const out = stripSourceRefs(input);
    expect(out).not.toContain("ApexHub");
    expect(out).not.toContain("ενότητα 2");
    expect(out).not.toContain("Συμπληρωματικός");
    expect(out).toContain("Καλό RR");
  });

  it("removes bare lesson numbers", () => {
    expect(stripSourceRefs("Αυτό είναι Role Reversal που συζητάμε στο Μάθημα 10 και 11.")).not.toMatch(
      /Μάθημα\s*1[01]/,
    );
    expect(stripSourceRefs("Όπως εξηγείται στο Μάθημα 12.")).not.toContain("Μάθημα 12");
  });

  it("removes inline 'όπως περιγράφεται στον ApexHub VIP' lead-ins", () => {
    const out = stripSourceRefs(
      "Ακολούθησε αυτά τα βήματα, όπως περιγράφεται στον ApexHub VIP — Οδηγό Σύνδεσης MT5: άνοιξε την εφαρμογή.",
    );
    expect(out).not.toContain("ApexHub");
    expect(out).not.toContain("Οδηγό Σύνδεσης");
    expect(out).toContain("Ακολούθησε αυτά τα βήματα");
  });

  it("removes the ApexHub brand name anywhere", () => {
    expect(stripSourceRefs("Η στρατηγική ApexHub VIP λέει...")).not.toContain("ApexHub");
  });

  it("leaves normal trading prose intact", () => {
    const prose = "Το breakout θεωρείται έγκυρο όταν ένα κερί κλείσει πέρα από τη ζώνη.";
    expect(stripSourceRefs(prose)).toBe(prose);
  });

  it("is applied by cleanProse end-to-end", () => {
    const out = cleanProse("Καλό setup, όπως λέει το Μάθημα 8.", 2400);
    expect(out).not.toContain("Μάθημα 8");
    expect(out).toContain("Καλό setup");
  });
});

describe("cleanProse", () => {
  it("preserves markdown formatting (lists, bold, headings)", () => {
    const md = "## Τίτλος\n\n- Πρώτο **bold**\n- Δεύτερο";
    const out = cleanProse(md, 2400);
    expect(out).toContain("## Τίτλος");
    expect(out).toContain("**bold**");
    expect(out).toContain("- Πρώτο");
  });

  it("strips data: URIs but keeps surrounding prose", () => {
    const input =
      "Αρχή data:image/png;base64,iVBORw0KGgoAAAANSUhEUg== τέλος";
    const out = cleanProse(input, 2400);
    expect(out).not.toContain("base64");
    expect(out).not.toContain("iVBOR");
    expect(out).toContain("Αρχή");
    expect(out).toContain("τέλος");
  });

  it("collapses 3+ newlines down to a paragraph break", () => {
    const out = cleanProse("a\n\n\n\n\nb", 2400);
    expect(out).toBe("a\n\nb");
  });

  it("caps length and appends an ellipsis", () => {
    const out = cleanProse("λέξη ".repeat(2000), 100);
    expect(out.length).toBeLessThanOrEqual(101);
    expect(out.endsWith("…")).toBe(true);
  });

  it("returns empty string for non-string input", () => {
    expect(cleanProse(undefined, 100)).toBe("");
    expect(cleanProse(null, 100)).toBe("");
    expect(cleanProse(42 as unknown, 100)).toBe("");
  });
});

describe("buildKnowledgeSystemPrompt", () => {
  it("includes the knowledge base content and the grounding rules", () => {
    const prompt = buildKnowledgeSystemPrompt();
    expect(prompt).toContain("KNOWLEDGE BASE");
    expect(prompt).toContain("ApexHub");
    // Must instruct Greek replies.
    expect(prompt).toContain("Ελληνικά");
    // Must be substantial (the KB is embedded).
    expect(prompt.length).toBeGreaterThan(2000);
  });

  it("embeds the Setup-analysis criteria block", () => {
    const prompt = buildKnowledgeSystemPrompt();
    expect(prompt).toContain("ΚΡΙΤΗΡΙΑ");
    expect(prompt).toContain("ΑΝΑΛΥΣΗΣ SETUP");
  });

  it("embeds the pre-trade checklist categories and a sample question", () => {
    const prompt = buildKnowledgeSystemPrompt();
    expect(prompt).toContain("PRE-TRADE CHECKLIST");
    // One representative category title and one question hint.
    expect(prompt).toContain("Market Context");
    expect(prompt).toContain("retest");
  });

  it("instructs the coach to give fuller, connected answers", () => {
    const prompt = buildKnowledgeSystemPrompt();
    expect(prompt).toContain("ΠΛΗΡΟΤΗΤΑ ΑΠΑΝΤΗΣΗΣ");
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

  it("surfaces the new structured fields (observations, rr, timeAnalysis, elliottNote)", () => {
    const result = buildResult({
      score: 75,
      observations: "Breakout αντίστασης, αναμονή retest στο POI.",
      rr: "1:4",
      timeAnalysis: "Τετάρτη 16 Απρ 2026, 13:25 — πριν το NY session",
      elliottNote: "Πιθανό κύμα 3 σε εξέλιξη.",
      criteria: [],
    });
    expect(result.observations).toContain("retest");
    expect(result.rr).toBe("1:4");
    expect(result.timeAnalysis).toContain("NY session");
    expect(result.elliottNote).toContain("κύμα");
  });

  it("defaults the new fields to empty strings when absent", () => {
    const result = buildResult({ score: 10, criteria: [] });
    expect(result.observations).toBe("");
    expect(result.rr).toBe("");
    expect(result.timeAnalysis).toBe("");
    expect(result.elliottNote).toBe("");
  });

  it("never leaks a base64 blob into the new fields and caps their length", () => {
    const blob = "data:image/png;base64," + "iVBORw0KGgo".repeat(50) + "==";
    const result = buildResult({
      score: 50,
      observations: `Παρατήρηση ${blob} τέλος`,
      rr: blob,
      timeAnalysis: `Ώρα ${blob}`,
      elliottNote: `Elliott ${blob}`,
      criteria: [],
    });
    const all =
      result.observations + result.rr + result.timeAnalysis + result.elliottNote;
    expect(all).not.toContain("base64");
    expect(all).not.toContain("iVBOR");
    expect(result.observations.length).toBeLessThanOrEqual(COACH_LIMITS.observations + 1);
    expect(result.rr.length).toBeLessThanOrEqual(COACH_LIMITS.rr + 1);
    expect(result.timeAnalysis.length).toBeLessThanOrEqual(COACH_LIMITS.timeAnalysis + 1);
    expect(result.elliottNote.length).toBeLessThanOrEqual(COACH_LIMITS.elliott + 1);
  });

  it("excludes Elliott from the scored criteria list", () => {
    const result = buildResult({ score: 50, criteria: [] });
    expect(result.criteria.some((c) => (c.id as string) === "elliott")).toBe(false);
  });
});
