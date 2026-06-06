import { describe, it, expect } from "vitest";
import { __test__ } from "./mindsetRouter";
import { MINDSET_KNOWLEDGE } from "./mindsetKnowledge";
import { MINDSET_STARTER_QUESTIONS } from "../shared/mindset";

describe("Mindset Coach system prompt", () => {
  it("embeds the full curated knowledge base as the only source", () => {
    expect(__test__.SYSTEM_PROMPT).toContain(MINDSET_KNOWLEDGE);
    expect(__test__.SYSTEM_PROMPT).toContain("ΒΑΣΗ ΓΝΩΣΗΣ");
  });

  it("forces Greek-only psychology-focused coaching", () => {
    expect(__test__.SYSTEM_PROMPT).toContain("Ελληνικά");
    expect(__test__.SYSTEM_PROMPT.toLowerCase()).toContain("mindset coach");
  });

  it("redirects off-topic (setup/signal) requests to other tools", () => {
    expect(__test__.SYSTEM_PROMPT).toMatch(/Trading Coach|Pre-Market/);
  });

  it("never promises investment advice / guaranteed results", () => {
    expect(__test__.SYSTEM_PROMPT).toContain("ΠΟΤΕ");
  });
});

describe("Mindset Coach fallback reply", () => {
  it("is supportive and references a concrete technique", () => {
    expect(__test__.FALLBACK_REPLY).toContain("STOP");
    expect(__test__.FALLBACK_REPLY).toContain("Διχότομη του Ελέγχου");
  });
});

describe("Mindset knowledge base", () => {
  it("is substantial and covers the core themes", () => {
    expect(MINDSET_KNOWLEDGE.length).toBeGreaterThan(3000);
    // Spot-check a few core concepts synthesised from the source material.
    expect(MINDSET_KNOWLEDGE).toMatch(/Στωικισμ|Διχότομη/);
    expect(MINDSET_KNOWLEDGE).toMatch(/revenge|FOMO|πειθαρχ/i);
  });
});

describe("Mindset starter questions", () => {
  it("exposes 4 distinct starter prompts with non-empty content", () => {
    expect(MINDSET_STARTER_QUESTIONS).toHaveLength(4);
    const ids = new Set(MINDSET_STARTER_QUESTIONS.map((q) => q.id));
    expect(ids.size).toBe(4);
    for (const q of MINDSET_STARTER_QUESTIONS) {
      expect(q.label.trim().length).toBeGreaterThan(0);
      expect(q.prompt.trim().length).toBeGreaterThan(0);
    }
  });
});
