// preTradeChecklist.ts
// ----------------------------------------------------------------------------
// Data model + helpers for the Pre-Trade Checklist.
//
// 20 questions across 5 categories. STRICT MODE: the user must check all 20
// items before the "Continue → log trade" CTA becomes enabled. There is no
// skip path — abandoning the checklist returns to the dashboard.
//
// Every completed run is persisted to localStorage so future analytics can
// answer questions like "how many trades were taken after a full checklist?".
// ----------------------------------------------------------------------------

export type ChecklistCategoryId =
  | "context"
  | "technical"
  | "plan"
  | "timing"
  | "mind";

export interface ChecklistQuestion {
  /** Stable id we persist along with the run; never reorder casually. */
  id: string;
  category: ChecklistCategoryId;
  /** Greek question shown to the user. */
  text: string;
  /** Smaller helper sentence shown under the question. */
  hint: string;
}

export interface ChecklistCategory {
  id: ChecklistCategoryId;
  title: string;
  subtitle: string;
  accent: string; // tailwind-friendly hex tint
}

export const CHECKLIST_CATEGORIES: ChecklistCategory[] = [
  {
    id: "context",
    title: "Market Context",
    subtitle: "Πού βρίσκεται η αγορά;",
    accent: "#0077B6",
  },
  {
    id: "technical",
    title: "Technical Confirmation",
    subtitle: "Έχω σήμα ή μαντεύω;",
    accent: "#5E60CE",
  },
  {
    id: "plan",
    title: "Risk & Reward Plan",
    subtitle: "Έχω σαφές πλάνο;",
    accent: "#F4A261",
  },
  {
    id: "timing",
    title: "Timing & News",
    subtitle: "Είναι η σωστή στιγμή;",
    accent: "#00897B",
  },
  {
    id: "mind",
    title: "Mind & Discipline",
    subtitle: "Είμαι ο εαυτός μου;",
    accent: "#E94F37",
  },
];

export const CHECKLIST_QUESTIONS: ChecklistQuestion[] = [
  // ── Market Context ────────────────────────────────────────────────────────
  {
    id: "ctx-1",
    category: "context",
    text: "Υπάρχει καθαρή τάση στο instrument που κοιτάζω;",
    hint: "Higher highs / higher lows ή το αντίστροφο. Όχι ranging.",
  },
  {
    id: "ctx-2",
    category: "context",
    text: "Είμαι σχετικά στην αρχή αυτής της νέας τάσης;",
    hint: "Όχι κυνήγι κίνησης που έχει ήδη τρέξει 80%.",
  },
  {
    id: "ctx-3",
    category: "context",
    text: "Το H1 και το H4 συμφωνούν στην ίδια κατεύθυνση;",
    hint: "Multi-timeframe confluence — και τα δύο charts μαζί.",
  },
  {
    id: "ctx-4",
    category: "context",
    text: "Στο Daily, το candle είναι μακριά από τον EMA50 για να έχει χώρο;",
    hint: "Mean-reversion margin — περιθώριο να ακουμπήσει τον ΕΜΑ50.",
  },

  // ── Technical Confirmation ────────────────────────────────────────────────
  {
    id: "tech-1",
    category: "technical",
    text: "Έχει γίνει breakout και στη συνέχεια retest;",
    hint: "Όχι first-touch entry — περιμένω το retest.",
  },
  {
    id: "tech-2",
    category: "technical",
    text: "Έχει σπάσει ο EMA50 σε H1 και H4;",
    hint: "Trigger condition — και στα δύο timeframes.",
  },
  {
    id: "tech-3",
    category: "technical",
    text: "Έχω βάλει σωστά τα zones μου (S/R, supply/demand);",
    hint: "Marked & validated — όχι αυθαίρετες γραμμές.",
  },
  {
    id: "tech-4",
    category: "technical",
    text: "Η θέση συμφωνεί με το κύμα 4→5 του Elliott;",
    hint: "Wave 5 impulse, όχι κορεσμένη πέμπτη.",
  },

  // ── Risk & Reward Plan ────────────────────────────────────────────────────
  {
    id: "plan-1",
    category: "plan",
    text: "Το RR είναι τουλάχιστον 1:2;",
    hint: "Minimum reward-to-risk — αλλιώς δεν το παίρνω.",
  },
  {
    id: "plan-2",
    category: "plan",
    text: "Έχει περιθώριο η τιμή να φτάσει στο take-profit;",
    hint: "Όχι TP κολλημένο σε επόμενο major level.",
  },
  {
    id: "plan-3",
    category: "plan",
    text: "Είναι το ιδανικότερο setup που έχω δει σήμερα;",
    hint: "A+ setup, όχι B/C compromise.",
  },
  {
    id: "plan-4",
    category: "plan",
    text: "Έχω στήσει εντολές (entry / SL / TP) με ακρίβεια στο τερματικό;",
    hint: "Pre-set orders, όχι market click.",
  },

  // ── Timing & News ─────────────────────────────────────────────────────────
  {
    id: "time-1",
    category: "timing",
    text: "Είναι Τρίτη, Τετάρτη ή Πέμπτη;",
    hint: "High-quality trading days.",
  },
  {
    id: "time-2",
    category: "timing",
    text: "Είμαι στο New York Session (14:00 – 18:00);",
    hint: "Δικό μου execution window.",
  },
  {
    id: "time-3",
    category: "timing",
    text: "Έκανα σωστή ανάλυση στην προγραμματισμένη ώρα μου;",
    hint: "Όχι ad-hoc analysis της στιγμής.",
  },
  {
    id: "time-4",
    category: "timing",
    text: "Έχω τσεκάρει τα νέα και δεν υπάρχει high-impact event;",
    hint: "Economic calendar clear ±30 λεπτά.",
  },

  // ── Mind & Discipline ─────────────────────────────────────────────────────
  {
    id: "mind-1",
    category: "mind",
    text: "Είναι το πρώτο trade που παίρνω σήμερα;",
    hint: "Όχι revenge ή over-trading.",
  },
  {
    id: "mind-2",
    category: "mind",
    text: "Είμαι 100% σίγουρος ότι δεν κάνω revenge trading;",
    hint: "Καμία προηγούμενη απώλεια δεν επηρεάζει αυτή την απόφαση.",
  },
  {
    id: "mind-3",
    category: "mind",
    text: "Είμαι ψύχραιμος και ψυχικά ήρεμος;",
    hint: "Heart rate ok. Όχι θυμός, όχι άγχος.",
  },
  {
    id: "mind-4",
    category: "mind",
    text:
      "Πήρα 3 βαθιές ανάσες, έκλεισα τον υπολογιστή για 5 λεπτά και επιβεβαιώνω ότι ακολούθησα 100% το πλάνο;",
    hint: "Final discipline gate — execute μόνο αν το πιστεύεις.",
  },
];

if (CHECKLIST_QUESTIONS.length !== 20) {
  // Defensive guard — if someone ever drops a question the constant blows up
  // at module load time, before any UI mounts.
  throw new Error(
    `Pre-trade checklist must contain exactly 20 questions (got ${CHECKLIST_QUESTIONS.length})`,
  );
}

export const CHECKLIST_TOTAL = CHECKLIST_QUESTIONS.length; // 20

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

export function questionsInCategory(id: ChecklistCategoryId): ChecklistQuestion[] {
  return CHECKLIST_QUESTIONS.filter(q => q.category === id);
}
