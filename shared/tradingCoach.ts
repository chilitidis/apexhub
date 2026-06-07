/**
 * Shared definitions for the Trading Coach feature, used by both client and
 * server so the rubric, output contract, score bands and disclaimer stay in
 * sync between the LLM prompt (server) and the rendering UI (client).
 *
 * The Trading Coach reads one or two TradingView screenshots (via the built-in
 * vision model) and scores the setup 0-100 against the user's documented
 * strategy, returning a short Greek comment plus a checklist of pass/warn/fail
 * criteria, an explicit list of what it observed, a numeric risk/reward and a
 * day/session read of the timestamp.
 *
 * IMPORTANT: We never store or render the raw image bytes / base64 / model
 * JSON. Only the structured fields below ever reach the database or the UI.
 */

export type CriterionStatus = "pass" | "warn" | "fail" | "unknown";

/**
 * A single rubric criterion the model must evaluate.
 *
 * Note: Elliott wave is intentionally NOT a scored criterion — the model reads
 * it wrong too often. It is surfaced only as an optional observation that does
 * not affect the score.
 */
export type CoachCriterionId =
  | "trend"
  | "two_timeframes"
  | "breakout_confirmed"
  | "retest_state"
  | "two_levels_broken"
  | "ema50"
  | "early_entry"
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
 * The scored rubric criteria, derived directly from the user's documented
 * strategy:
 *  - H1 analysis confirmed by H4 (same direction).
 *  - Breakout is only valid once the candle has CLOSED beyond the level.
 *  - Retest: price must return and touch the POI (the broken zone). We
 *    distinguish "retest completed" (entry candle touched the POI) from
 *    "waiting for retest" (broke out but has not returned yet).
 *  - ≥2 levels broken in the trade direction.
 *  - EMA50 (the main MA line on the candles — usually black, may differ by
 *    user): long closes above it, short closes below it.
 *  - Early entry near the start of the move (buy low / sell high), not after
 *    it has already run far.
 *  - RR computed numerically from Entry & SL read on the chart, target ≥ 1:2.
 *  - Stop beyond the last broken level (+ a little wick).
 *  - Ideal time Tue-Thu, NY session 14:00-18:00 Greece time.
 *
 * Elliott wave is deliberately excluded here (optional observation only).
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
    hint: "Όταν υπάρχουν 2 screenshots, H1 και H4 δείχνουν ίδια κατεύθυνση. Με 1 screenshot → unknown.",
  },
  {
    id: "breakout_confirmed",
    label: "Breakout (κλειστό κερί)",
    hint: "Έχει ΚΛΕΙΣΕΙ κερί πέρα από το support/resistance — όχι απλώς άγγιγμα.",
  },
  {
    id: "retest_state",
    label: "Retest στο POI",
    hint: "pass = το κερί εισόδου γύρισε κι ακούμπησε το POI (retest ολοκληρώθηκε) · warn = αναμονή retest (έσπασε αλλά δεν γύρισε ακόμα) · fail = δεν υπάρχει retest/μπήκε κυνηγώντας.",
  },
  {
    id: "two_levels_broken",
    label: "≥2 επίπεδα σπασμένα",
    hint: "Έχουν σπάσει τουλάχιστον 2 supports (long) ή 2 resistances (short).",
  },
  {
    id: "ema50",
    label: "EMA50",
    hint: "Long: κερί κλείνει πάνω από EMA50 (μαύρη γραμμή) · Short: κάτω από EMA50.",
  },
  {
    id: "early_entry",
    label: "Πρώιμη είσοδος",
    hint: "Είσοδος κοντά στην αρχή της κίνησης (αγοράζουμε χαμηλά / πουλάμε ψηλά), όχι αφού έχει ήδη τρέξει.",
  },
  {
    id: "risk_reward",
    label: "RR ≥ 1:2",
    hint: "Υπολογισμένο από Entry & SL που διαβάζονται στο chart. Στόχος τουλάχιστον 1:2.",
  },
  {
    id: "stop_placement",
    label: "Stop Loss",
    hint: "Long: SL κάτω από το τελευταίο support (+λίγο wick) · Short: πάνω από το τελευταίο resistance.",
  },
  {
    id: "session_timing",
    label: "Ώρα/Ημέρα",
    hint: "Διαβάζει την ημερομηνία/ώρα (ώρα Ελλάδας) πάνω από το TradingView. Ιδανικά Τρίτη-Πέμπτη, NY session 14:00-18:00.",
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
  /** Detected timeframe(s), e.g. "H1" or "H1 + H4" (best-effort, may be empty). */
  timeframe: string;
  /** Detected direction. */
  direction: "long" | "short" | "unknown";
  /**
   * What the model literally observed BEFORE judging (observe-before-judge).
   * Short Greek bullet-style sentences. Keeps it honest about what is/ isn't
   * visible on the chart.
   */
  observations: string;
  /**
   * Numeric risk/reward read from Entry & SL on the chart, e.g. "1:2.4".
   * Empty string if Entry/SL/TP can't be read clearly.
   */
  rr: string;
  /**
   * Day-of-week + session read from the TradingView timestamp (Greece time),
   * e.g. "Τετάρτη 16 Απρ 2026, 13:25 — εκτός NY session". Empty if unreadable.
   */
  timeAnalysis: string;
  /**
   * Optional Elliott-wave observation. NOT scored. Empty if not applicable or
   * unclear.
   */
  elliottNote: string;
  /** Short friendly Greek summary (1-3 sentences). */
  comment: string;
  /** Concrete suggestion, especially for weak setups (what you'd do instead). */
  suggestion: string;
  /** Per-criterion checklist (scored criteria only). */
  criteria: CoachCriterionResult[];
};

export const COACH_DISCLAIMER =
  "Ο Trading Coach προσφέρει εκπαιδευτική ανάλυση βάσει της στρατηγικής — δεν αποτελεί επενδυτική συμβουλή ούτε εγγύηση αποτελέσματος. Οι τελικές αποφάσεις είναι δική σου ευθύνη.";

/** Max number of screenshots a single analysis accepts (e.g. H1 + H4). */
export const COACH_MAX_IMAGES = 2;

/** Hard caps to keep any text field from ever exploding the UI. */
export const COACH_LIMITS = {
  comment: 600,
  suggestion: 600,
  note: 240,
  observations: 900,
  rr: 24,
  timeAnalysis: 160,
  elliott: 280,
  pair: 24,
  timeframe: 24,
  chat: 1200,
  knowledgeChat: 2400,
} as const;
