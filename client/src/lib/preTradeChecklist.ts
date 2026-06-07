// preTradeChecklist.ts
// ----------------------------------------------------------------------------
// Pre-Trade Checklist helpers (client-side).
//
// The categories + 20 questions now live in a shared, browser-free module
// (@shared/preTradeChecklistData) so the server-side Trading Coach prompt can
// reuse the exact same data. This file re-exports them for existing imports and
// keeps the localStorage persistence + completion helpers that only make sense
// in the browser.
// ----------------------------------------------------------------------------

import {
  CHECKLIST_QUESTIONS,
  type ChecklistCategoryId,
} from "@shared/preTradeChecklistData";

export {
  CHECKLIST_CATEGORIES,
  CHECKLIST_QUESTIONS,
  CHECKLIST_TOTAL,
} from "@shared/preTradeChecklistData";
export type {
  ChecklistCategoryId,
  ChecklistQuestion,
  ChecklistCategory,
} from "@shared/preTradeChecklistData";

/** A single checklist run, persisted to localStorage. */
export interface ChecklistRun {
  startedAt: number; // unix ms
  completedAt: number; // unix ms
  answers: Record<string, boolean>; // question id → answer
  /** Strict mode = all-true. We persist anyway for analytics. */
  allConfirmed: boolean;
}

const STORAGE_KEY = "apexhub:preTradeChecklist:runs";
const MAX_PERSISTED_RUNS = 50;

export function getPersistedRuns(): ChecklistRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChecklistRun[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistRun(run: ChecklistRun): ChecklistRun[] {
  if (typeof window === "undefined") return [];
  const next = [run, ...getPersistedRuns()].slice(0, MAX_PERSISTED_RUNS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Silently ignore quota errors — checklist is not mission-critical data.
  }
  return next;
}

/** True iff every required question is checked. */
export function isComplete(answers: Record<string, boolean>): boolean {
  return CHECKLIST_QUESTIONS.every(q => answers[q.id] === true);
}

export function countConfirmed(answers: Record<string, boolean>): number {
  return CHECKLIST_QUESTIONS.reduce(
    (acc, q) => acc + (answers[q.id] === true ? 1 : 0),
    0,
  );
}

export function questionsInCategory(id: ChecklistCategoryId) {
  return CHECKLIST_QUESTIONS.filter(q => q.category === id);
}
