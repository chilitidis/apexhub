import { describe, it, expect } from "vitest";
import { buildAskPrompt, findRules, fallbackText } from "./propFirmRouter";
import { FIRMS } from "@shared/propFirms";

describe("propFirmRouter — findRules", () => {
  it("resolves a known firm + program for the eval stage", () => {
    const firm = FIRMS[0];
    const program = firm.programs[0];
    const rules = findRules(firm.name, program.name, "eval");
    expect(rules).not.toBeNull();
    expect(rules!.firm.name).toBe(firm.name);
    expect(rules!.stage).toBe(program.eval);
  });

  it("returns the funded stage when phase is funded", () => {
    const firm = FIRMS[0];
    const program = firm.programs[0];
    const rules = findRules(firm.name, program.name, "funded");
    expect(rules!.stage).toBe(program.funded);
  });

  it("returns null for an unknown firm", () => {
    expect(findRules("Does Not Exist", "Whatever", "eval")).toBeNull();
  });
});

describe("propFirmRouter — buildAskPrompt language", () => {
  const firm = FIRMS[0];
  const program = firm.programs[0];

  it("emits an English directive and grounds on the fact sheet when lang=en", () => {
    const prompt = buildAskPrompt({
      firmName: firm.name,
      programName: program.name,
      phase: "eval",
      lang: "en",
    });
    expect(prompt).not.toBeNull();
    expect(prompt!.system).toContain("Reply STRICTLY in English.");
    expect(prompt!.system).toContain("==== FACT SHEET ====");
    expect(prompt!.system).toContain(`Firm: ${firm.name}`);
    // No Greek directive leaking into the English prompt.
    expect(prompt!.system).not.toContain("Απάντησε ΑΥΣΤΗΡΑ");
  });

  it("emits a Greek directive when lang=el", () => {
    const prompt = buildAskPrompt({
      firmName: firm.name,
      programName: program.name,
      phase: "eval",
      lang: "el",
    });
    expect(prompt!.system).toContain("Απάντησε ΑΥΣΤΗΡΑ στα Ελληνικά.");
    expect(prompt!.system).not.toContain("Reply STRICTLY in English.");
  });

  it("uses the trader's question verbatim when provided", () => {
    const prompt = buildAskPrompt({
      firmName: firm.name,
      programName: program.name,
      phase: "eval",
      lang: "en",
      question: "Can I hold over the weekend?",
    });
    expect(prompt!.user).toBe("Can I hold over the weekend?");
  });

  it("returns null prompt for an unknown firm", () => {
    expect(
      buildAskPrompt({ firmName: "Nope", programName: "Nope", phase: "eval", lang: "en" }),
    ).toBeNull();
  });
});

describe("propFirmRouter — fallback localization", () => {
  it("returns English fallback for en", () => {
    expect(fallbackText("en")).toContain("temporarily unavailable");
  });
  it("returns Greek fallback for el", () => {
    expect(fallbackText("el")).toContain("δεν είναι προσωρινά διαθέσιμος");
  });
});

describe("propFirms dataset integrity", () => {
  it("has firms, each with at least one program and both stages", () => {
    expect(FIRMS.length).toBeGreaterThan(0);
    for (const f of FIRMS) {
      expect(f.name.length).toBeGreaterThan(0);
      expect(f.programs.length).toBeGreaterThan(0);
      for (const p of f.programs) {
        expect(p.eval).toBeTruthy();
        expect(p.funded).toBeTruthy();
      }
      expect(f.copy).toBeTruthy();
      expect(f.alloc).toBeTruthy();
    }
  });

  it("has unique firm names", () => {
    const names = FIRMS.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
