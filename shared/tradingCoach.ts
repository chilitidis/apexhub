/**
 * Shared definitions for the Trading Coach feature, used by both client and
 * server so the rubric, output contract, score bands and disclaimer stay in
 * sync between the LLM prompt (server) and the rendering UI (client).
 *
 * The Trading Coach reads a TradingView screenshot (via the built-in vision
 * model) and scores the setup 0-100 against the Titans / APEXHUB strategy,
 * returning a short Greek comment plus a checklist of pass/warn/fail criteria.
 *
 * IMPORTANT: We never store or render the raw image bytes / base64 / model
 * JSON. Only the structured fields below ever reach the database or the UI.
 */

export type CriterionStatus = "pass" | "warn" | "fail" | "unknown";

/** A single rubric criterion the model must evaluate. */
export type CoachCriterionId =
  | "trend"
  | "two_timeframes"
  | "breakout_retest"
  | "two_levels_broken"
  | "ema50"
  | "early_entry"
  | "elliott_wave"
  | "risk_reward"
  | "stop_placement"
  | "session_timing";

export type CoachCriterion = {
  id: CoachCriterionId;
  /** Greek label shown in the UI checklist. */
  label: string;
  /** Short Greek helper describing what a "pass" looks like. */
  hint: string;
};

/**
 * The 10 rubric criteria, derived directly from the user's documented strategy
 * (H1 analysis confirmed by H4, breakout + retest, EMA50, early entry near the
 * start of the move after ≥2 levels broken to catch Elliott wave 4-5, RR ≥ 1:2,
 * stop beyond the last level + a bit of wick, NY session Tue-Thu).
 */
export const COACH_CRITERIA: ReadonlyArray<CoachCriterion> = [
  {
    id: "trend",
    label: "Τάση",
    hint: "Υπάρχει καθαρή τάση/δομή στην κατεύθυνση του trade.",
  },
  {
    id: "two_timeframes",
    label: "H1 + H4 συμφωνούν",
    hint: "Η ανάλυση H1 επιβεβαιώνεται και από το H4 (ίδια κατεύθυνση).",
  },
  {
    id: "breakout_retest",
    label: "Breakout & Retest",
    hint: "Έσπασε support/resistance και έγινε retest πριν την είσοδο.",
  },
  {
    id: "two_levels_broken",
    label: "≥2 επίπεδα σπασμένα",
    hint: "Έχουν σπάσει τουλάχιστον 2 supports (long) ή 2 resistances (short).",
  },
  {
    id: "ema50",
    label: "EMA50",
    hint: "Long: κερί κλείνει πάνω από EMA50 · Short: κάτω από EMA50 (H1 & H4).",
  },
  {
    id: "early_entry",
    label: "Πρώιμη είσοδος",
    hint: "Είσοδος κοντά στην αρχή της κίνησης (αγοράζουμε χαμηλά / πουλάμε ψηλά), όχι αφού έχει ήδη τρέξει.",
  },
  {
    id: "elliott_wave",
    label: "Elliott 4-5",
    hint: "Η θέση στοχεύει το κύμα 4-5 του Elliott (η μεγαλύτερη κίνηση).",
  },
  {
    id: "risk_reward",
    label: "RR ≥ 1:2",
    hint: "Η σχέση κινδύνου/απόδοσης είναι τουλάχιστον 1 προς 2.",
  },
  {
    id: "stop_placement",
    label: "Stop Loss",
    hint: "Long: SL κάτω από το τελευταίο support (+λίγο wick) · Short: πάνω από το τελευταίο resistance.",
  },
  {
    id: "session_timing",
    label: "Ώρα/Ημέρα",
    hint: "Ιδανικά Τρίτη-Πέμπτη, NY session 14:00-18:00 (ώρα Ελλάδας).",
  },
];

export const COACH_CRITERIA_IDS: ReadonlyArray<CoachCriterionId> =
  COACH_CRITERIA.map((c) => c.id);

/** Verdict buckets derived from the numeric score. */
export type CoachVerdict = "suitable" | "marginal" | "unsuitable";

export type CoachScoreBand = {
  verdict: CoachVerdict;
  /** Greek label for the verdict badge. */
  label: string;
  /** Tailwind-friendly token used by the UI to pick colors. */
  tone: "profit" | "gold" | "loss";
  min: number;
  max: number;
};

export const COACH_SCORE_BANDS: ReadonlyArray<CoachScoreBand> = [
  { verdict: "suitable", label: "Κατάλληλο", tone: "profit", min: 70, max: 100 },
  { verdict: "marginal", label: "Οριακό", tone: "gold", min: 45, max: 69 },
  { verdict: "unsuitable", label: "Ακατάλληλο", tone: "loss", min: 0, max: 44 },
];

/** Maps a 0-100 score to its verdict band. */
export function scoreToBand(score: number): CoachScoreBand {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  for (const band of COACH_SCORE_BANDS) {
    if (clamped >= band.min && clamped <= band.max) return band;
  }
  // Defensive fallback (should never hit because bands cover 0-100).
  return COACH_SCORE_BANDS[COACH_SCORE_BANDS.length - 1];
}

/** One evaluated criterion as returned to the UI. */
export type CoachCriterionResult = {
  id: CoachCriterionId;
  label: string;
  status: CriterionStatus;
  /** Short Greek note on why it passed / warned / failed. */
  note: string;
};

/** The full structured analysis surfaced to the UI and stored in the DB. */
export type CoachAnalysisResult = {
  /** 0-100 */
  score: number;
  verdict: CoachVerdict;
  /** Detected instrument, e.g. "NZDCHF" (best-effort, may be empty). */
  pair: string;
  /** Detected timeframe, e.g. "H1" (best-effort, may be empty). */
  timeframe: string;
  /** Detected direction. */
  direction: "long" | "short" | "unknown";
  /** Short friendly Greek summary (1-3 sentences). */
  comment: string;
  /** Concrete suggestion, especially for weak setups (what you'd do instead). */
  suggestion: string;
  /** Per-criterion checklist. */
  criteria: CoachCriterionResult[];
};

export const COACH_DISCLAIMER =
  "Ο Trading Coach προσφέρει εκπαιδευτική ανάλυση βάσει της στρατηγικής Titans — δεν αποτελεί επενδυτική συμβουλή ούτε εγγύηση αποτελέσματος. Οι τελικές αποφάσεις είναι δική σου ευθύνη.";

/** Hard caps to keep any text field from ever exploding the UI. */
export const COACH_LIMITS = {
  comment: 600,
  suggestion: 600,
  note: 240,
  pair: 24,
  timeframe: 12,
} as const;
