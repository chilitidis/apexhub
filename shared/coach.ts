// shared/coach.ts
// ----------------------------------------------------------------------------
// Single source of truth for the Trading Coach rubric. Imported by the server
// (to build the LLM prompt + validate output) and the client (to render the
// per-criterion breakdown). Keep ids stable — they are persisted in the DB.
// ----------------------------------------------------------------------------

export type CriterionStatus = "pass" | "warn" | "fail" | "unknown";

export type CoachVerdict = "Suitable" | "Marginal" | "Unsuitable";

export interface CoachCriterion {
  /** Stable id, persisted with each analysis. */
  id: string;
  /** Short Greek label shown in the UI. */
  label: string;
  /** What the model should check (Greek). */
  detail: string;
}

/**
 * The 10 criteria the user described, in evaluation order. The Pre-Trade
 * Checklist alignment is folded in as the final criterion.
 */
export const COACH_CRITERIA: CoachCriterion[] = [
  {
    id: "trend",
    label: "Τάση",
    detail:
      "Υπάρχει καθαρή τάση (higher highs/lows ή lower highs/lows), όχι ranging/πλάγια αγορά.",
  },
  {
    id: "mtf",
    label: "Multi-Timeframe (H1 + H4)",
    detail:
      "Η ανάλυση γίνεται στο H1 και τα H1 & H4 συμφωνούν στην ίδια κατεύθυνση.",
  },
  {
    id: "breakout_retest",
    label: "Breakout + Retest",
    detail:
      "Έχει σπάσει support (για short) ή resistance (για long) και ακολουθεί retest. Τα POIs στο τελευταίο support και στο προηγούμενο resistance.",
  },
  {
    id: "ema50",
    label: "EMA50 (H1 & H4)",
    detail:
      "Για LONG το candle έχει κλείσει ΠΑΝΩ από τον EMA50 σε H1 & H4· για SHORT έχει κλείσει ΚΑΤΩ από τον EMA50 σε H1 & H4.",
  },
  {
    id: "stop_loss",
    label: "Stop Loss",
    detail:
      "LONG: κάτω από το τελευταίο support (+λίγο το wick). SHORT: πάνω από το τελευταίο resistance (+λίγο τα wicks).",
  },
  {
    id: "elliott",
    label: "Elliott Waves (κύμα 4→5)",
    detail: "Ιδανικά η θέση συμφωνεί με το κύμα 4→5 κατά Elliott.",
  },
  {
    id: "rr",
    label: "Risk / Reward",
    detail: "Ελάχιστο RR 1:2 με βάση entry, stop loss και take profit.",
  },
  {
    id: "news",
    label: "News",
    detail:
      "Δεν υπάρχει high-impact news στο επιλεγμένο ζευγάρι ή γενικό market-moving event που να επηρεάζει τη θέση.",
  },
  {
    id: "timing",
    label: "Timing (ημέρα & session)",
    detail:
      "Ιδανικά Τρίτη/Τετάρτη/Πέμπτη (μερικές φορές Παρασκευή) και κυρίως New York session 14:00–18:00.",
  },
  {
    id: "checklist",
    label: "Pre-Trade Checklist",
    detail:
      "Η θέση συμβαδίζει με τους κανόνες του 20-point Pre-Trade Checklist (context, technical, plan, timing, mind).",
  },
];

export const COACH_CRITERIA_IDS = COACH_CRITERIA.map((c) => c.id);

/** One per-criterion result returned by the model + persisted. */
export interface CoachCriterionResult {
  id: string;
  label: string;
  status: CriterionStatus;
  comment: string;
}

/** Full analysis payload (model output, after validation). */
export interface CoachAnalysisResult {
  pair: string;
  timeframe: string;
  direction: string; // "LONG" | "SHORT" | "" (unknown)
  verdict: CoachVerdict;
  score: number; // 0-100
  summary: string;
  criteria: CoachCriterionResult[];
}

export function verdictColor(verdict: CoachVerdict): string {
  switch (verdict) {
    case "Suitable":
      return "#00897B";
    case "Unsuitable":
      return "#E94F37";
    default:
      return "#F4A261";
  }
}

export function verdictLabelGreek(verdict: CoachVerdict): string {
  switch (verdict) {
    case "Suitable":
      return "Κατάλληλο";
    case "Unsuitable":
      return "Ακατάλληλο";
    default:
      return "Οριακό";
  }
}

export function statusColor(status: CriterionStatus): string {
  switch (status) {
    case "pass":
      return "#00897B";
    case "fail":
      return "#E94F37";
    case "warn":
      return "#F4A261";
    default:
      return "#4A6080";
  }
}
