import { describe, it, expect } from "vitest";
import {
  CHECKLIST_CATEGORIES,
  CHECKLIST_QUESTIONS,
  CHECKLIST_TOTAL,
  countConfirmed,
  isComplete,
  questionsInCategory,
} from "./preTradeChecklist";

describe("preTradeChecklist", () => {
  it("has exactly 20 questions split into 5 categories", () => {
    expect(CHECKLIST_QUESTIONS.length).toBe(20);
    expect(CHECKLIST_TOTAL).toBe(20);
    expect(CHECKLIST_CATEGORIES.length).toBe(5);
  });

  it("has 4 questions per category, no orphan ids, no duplicates", () => {
    for (const cat of CHECKLIST_CATEGORIES) {
      expect(questionsInCategory(cat.id).length).toBe(4);
    }
    const ids = CHECKLIST_QUESTIONS.map(q => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("isComplete is true only when every question is true", () => {
    expect(isComplete({})).toBe(false);
    const partial: Record<string, boolean> = {};
    for (const q of CHECKLIST_QUESTIONS.slice(0, 19)) partial[q.id] = true;
    expect(isComplete(partial)).toBe(false);

    const full: Record<string, boolean> = {};
    for (const q of CHECKLIST_QUESTIONS) full[q.id] = true;
    expect(isComplete(full)).toBe(true);
  });

  it("countConfirmed only counts true entries", () => {
    const mix: Record<string, boolean> = {
      [CHECKLIST_QUESTIONS[0].id]: true,
      [CHECKLIST_QUESTIONS[1].id]: false,
      [CHECKLIST_QUESTIONS[2].id]: true,
    };
    expect(countConfirmed(mix)).toBe(2);
  });
});
