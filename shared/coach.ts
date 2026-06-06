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
      "Υπάρχει καθαρή τάση. Καθοδική = lower highs/lower lows και τιμή κάτω από κατερχόμενη EMA. Ανοδική = higher highs/higher lows και τιμή πάνω από ανερχόμενη EMA. Μόνο αν η τιμή κινείται οριζόντια χωρίς κατεύθυνση είναι ranging. PASS αν η τάση συμφωνεί με την κατεύθυνση της θέσης.",
  },
  {
    id: "mtf",
    label: "Multi-Timeframe (H1 + H4)",
    detail:
      "Η ανάλυση γίνεται στο H1 και ιδανικά H1 & H4 συμφωνούν. Αν φαίνεται μόνο το H1 (συνηθισμένο σε ένα screenshot), βάλε 'warn' και ζήτησε επιβεβαίωση H4 — ΟΧΙ fail. 'unknown' μόνο αν δεν φαίνεται το timeframe καθόλου.",
  },
  {
    id: "breakout_retest",
    label: "Breakout + Retest",
    detail:
      "Έχει σπάσει επίπεδο (support για short, resistance για long). Το retest μπορεί να έχει ΗΔΗ γίνει Ή να ΑΝΑΜΕΝΕΤΑΙ — και τα δύο είναι έγκυρα setups, ΟΧΙ fail. PASS όταν υπάρχει καθαρό breakout και η είσοδος βασίζεται σε retest της ζώνης (POI). Τα πράσινα ορθογώνια στο chart είναι τα POIs.",
  },
  {
    id: "ema50",
    label: "EMA50",
    detail:
      "Για SHORT η τιμή/κεριά βρίσκονται ΚΑΤΩ από την EMA50 (έχει σπάσει προς τα κάτω). Για LONG πάνω από την EMA50. Η ΑΠΟΣΤΑΣΗ από την EMA ΔΕΝ έχει σημασία — αρκεί να είναι στη σωστή πλευρά. PASS όταν η τιμή είναι στη σωστή πλευρά της EMA για την κατεύθυνση. (Αν δεν φαίνεται το H4, μην το βάζεις fail — αξιολόγησε το H1 που φαίνεται.)",
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
      "Έλεγξε ότι δεν υπάρχει high-impact news στο ζευγάρι. Αν δεν φαίνονται εικονίδια news στο chart, θεώρησε ότι δεν υπάρχει εμφανές γεγονός (status 'pass' με σημείωση ότι καλό είναι να επιβεβαιωθεί από το Market News). Μην βάζεις fail χωρίς ορατή ένδειξη.",
  },
  {
    id: "timing",
    label: "Timing (ημέρα & session)",
    detail:
      "Διάβασε ημέρα & ώρα από το header του TradingView (π.χ. 'created with TradingView.com, <ημερομηνία> <ώρα> UTC+X'). Ιδανικά Τρι/Τετ/Πεμ (μερικές φορές Παρ) και κυρίως New York session 14:00–18:00 ώρα Ελλάδας. Αν φαίνεται η ώρα, αξιολόγησέ την — μην βάζεις unknown.",
  },
  {
    id: "checklist",
    label: "Pre-Trade Checklist",
    detail:
      "Βάσει όλων των παραπάνω, πόσο καλά συμβαδίζει το setup με τους κανόνες (context, technical, plan, timing, mind). Δώσε μια συνολική εκτίμηση (pass/warn/fail) — όχι unknown — βάσει των άλλων κριτηρίων.",
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
