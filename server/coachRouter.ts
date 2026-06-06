import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import {
  createCoachAnalysis,
  listCoachAnalyses,
  getCoachAnalysisById,
  deleteCoachAnalysis,
  listCoachMessages,
  createCoachMessage,
} from "./db";
import {
  COACH_CRITERIA,
  COACH_CRITERIA_IDS,
  COACH_LIMITS,
  COACH_MAX_IMAGES,
  scoreToBand,
  type CoachAnalysisResult,
  type CoachCriterionId,
  type CoachCriterionResult,
  type CriterionStatus,
} from "../shared/tradingCoach";

// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------

// Base64 data URL of a screenshot: "data:image/png;base64,AAAA..."
// Sent to the vision model in-flight only; never stored or echoed back.
const dataUrlSchema = z.string().min(32).max(20_000_000);

const analyzeInputSchema = z.object({
  // One or two screenshots (e.g. H1 + H4) for the same trade.
  images: z.array(dataUrlSchema).min(1).max(COACH_MAX_IMAGES),
  // Optional account the analysis is associated with (0 = none).
  accountId: z.number().int().nonnegative().default(0),
});

// -----------------------------------------------------------------------------
// LLM JSON schema (strict) — the model can only ever return these fields.
// -----------------------------------------------------------------------------

const criterionSchema = {
  type: "object",
  properties: {
    id: { type: "string", enum: [...COACH_CRITERIA_IDS] },
    status: { type: "string", enum: ["pass", "warn", "fail", "unknown"] },
    note: {
      type: "string",
      description: "Σύντομο ελληνικό σχόλιο (<= 200 χαρακτήρες) για το κριτήριο.",
    },
  },
  required: ["id", "status", "note"],
  additionalProperties: false,
} as const;

const analysisSchema = {
  type: "object",
  properties: {
    observations: {
      type: "string",
      description:
        "ΠΡΩΤΑ περίγραψε ΤΙ ΒΛΕΠΕΙΣ στο/στα screenshot πριν κρίνεις: σύμβολο, timeframe(s), ημερομηνία/ώρα πάνω από το TradingView, αν το κερί breakout έκλεισε, αν η τιμή γύρισε κι ακούμπησε το POI (retest) ή αν ΠΕΡΙΜΕΝΟΥΜΕ retest, θέση σε σχέση με EMA50, τιμές Entry/SL/TP αν φαίνονται. 2-5 σύντομες προτάσεις στα Ελληνικά.",
    },
    pair: { type: "string", description: "Σύμβολο, π.χ. NZDCHF. Κενό αν δεν διαβάζεται." },
    timeframe: {
      type: "string",
      description: "Timeframe(s), π.χ. 'H1' ή 'H1 + H4'. Κενό αν δεν διαβάζεται.",
    },
    direction: { type: "string", enum: ["long", "short", "unknown"] },
    timeAnalysis: {
      type: "string",
      description:
        "Διάβασε την ημερομηνία/ώρα πάνω-πάνω δίπλα στο 'TradingView' (είναι ώρα Ελλάδας). Βγάλε την ημέρα της εβδομάδας μόνος σου και πες αν είναι εντός NY session (14:00-18:00 ώρα Ελλάδας) και αν είναι Τρι-Πεμ. Π.χ. 'Τετάρτη 16 Απρ 2026, 13:25 — πριν το NY session'. Κενό αν δεν διαβάζεται.",
    },
    rr: {
      type: "string",
      description:
        "Υπολόγισε αριθμητικά το RR από Entry & SL (και TP αν φαίνεται) που διαβάζεις στο chart: RR = απόσταση(Entry→TP) / απόσταση(Entry→SL). Μορφή '1:2.4'. Κενό αν δεν διαβάζονται καθαρά Entry και SL.",
    },
    elliottNote: {
      type: "string",
      description:
        "ΠΡΟΑΙΡΕΤΙΚΟ και ΔΕΝ βαθμολογείται. Μόνο αν είσαι σχετικά σίγουρος, σύντομη παρατήρηση για Elliott. Αλλιώς κενό. ΜΗΝ μαντεύεις κύματα.",
    },
    score: {
      type: "integer",
      description: "Βαθμολογία 0-100 για το πόσο ταιριάζει στη στρατηγική (ΧΩΡΙΣ το Elliott).",
    },
    comment: { type: "string", description: "Φιλικό ελληνικό σχόλιο 1-3 προτάσεων." },
    suggestion: {
      type: "string",
      description: "Πρακτική πρόταση, ειδικά για αδύναμα setups (τι θα έκανες διαφορετικά).",
    },
    criteria: {
      type: "array",
      items: criterionSchema,
      description: "Ένα στοιχείο για ΚΑΘΕ κριτήριο της στρατηγικής (όχι Elliott).",
    },
  },
  required: [
    "observations",
    "pair",
    "timeframe",
    "direction",
    "timeAnalysis",
    "rr",
    "elliottNote",
    "score",
    "comment",
    "suggestion",
    "criteria",
  ],
  additionalProperties: false,
} as const;

// -----------------------------------------------------------------------------
// System prompt — the strategy, written so the model OBSERVES before it JUDGES
// and never invents details it cannot read from the chart.
// -----------------------------------------------------------------------------

function buildSystemPrompt(imageCount: number): string {
  const criteriaLines = COACH_CRITERIA.map(
    (c) => `- ${c.id} (${c.label}): ${c.hint}`,
  ).join("\n");

  const multi =
    imageCount >= 2
      ? "Σου δίνονται ΔΥΟ screenshots για το ΙΔΙΟ trade (π.χ. H1 και H4). Σύγκρινέ τα: το κριτήριο 'two_timeframes' γίνεται pass μόνο αν H1 και H4 δείχνουν ΙΔΙΑ κατεύθυνση, warn αν είναι ασαφές, fail αν διαφωνούν."
      : "Σου δίνεται ΕΝΑ screenshot. Το κριτήριο 'two_timeframes' πρέπει να είναι 'unknown' (δεν υπάρχει 2ο timeframe για σύγκριση).";

  return [
    "Είσαι ο «Trading Coach». Αναλύεις screenshot(s) από το TradingView και αξιολογείς το setup με βάση μια συγκεκριμένη στρατηγική breakout-retest.",
    multi,
    "",
    "==== ΚΡΙΣΙΜΟΣ ΚΑΝΟΝΑΣ: ΠΑΡΑΤΗΡΗΣΕ ΠΡΙΝ ΚΡΙΝΕΙΣ ====",
    "Στο πεδίο 'observations' γράψε ΠΡΩΤΑ τι ΒΛΕΠΕΙΣ πραγματικά στο γράφημα, ΠΡΙΝ βγάλεις οποιοδήποτε συμπέρασμα. ΜΗΝ επινοείς στοιχεία. Αν κάτι δεν φαίνεται καθαρά, πες ρητά 'δεν φαίνεται' και βάλε το αντίστοιχο κριτήριο 'unknown'. ΠΟΤΕ μην υποθέτεις ότι έγινε κάτι (π.χ. retest) αν δεν το βλέπεις.",
    "",
    "==== ΟΡΙΣΜΟΙ ΤΗΣ ΣΤΡΑΤΗΓΙΚΗΣ (τήρησέ τους ΑΥΣΤΗΡΑ) ====",
    "BREAKOUT: θεωρείται έγκυρο ΜΟΝΟ όταν ένα κερί έχει ΚΛΕΙΣΕΙ πέρα από το support/resistance. Αν απλώς ακούμπησε/τρύπησε αλλά δεν έκλεισε, ΔΕΝ είναι breakout.",
    "RETEST (POI): μετά το breakout, η τιμή πρέπει να ΓΥΡΙΣΕΙ ΠΙΣΩ και να ΑΚΟΥΜΠΗΣΕΙ το POI (τη σπασμένη ζώνη). Η είσοδος γίνεται στο retest.",
    "  • retest_state = 'pass' ΜΟΝΟ αν βλέπεις ότι η τιμή ΗΔΗ γύρισε κι ακούμπησε το POI (το retest ΟΛΟΚΛΗΡΩΘΗΚΕ / γίνεται τώρα στο σημείο εισόδου).",
    "  • retest_state = 'warn' αν έγινε breakout αλλά η τιμή ΔΕΝ έχει γυρίσει ακόμα (ΠΕΡΙΜΕΝΟΥΜΕ retest — π.χ. εκκρεμεί buy/sell limit στο POI). Γράψε ρητά 'αναμονή retest'.",
    "  • retest_state = 'fail' αν μπήκε κυνηγώντας την κίνηση χωρίς retest, ή αν δεν υπάρχει καθόλου retest.",
    "  ΜΗΝ πεις ποτέ ότι 'έγινε retest' αν βλέπεις μόνο breakout χωρίς επιστροφή στο POI.",
    "EMA50: η κύρια γραμμή κινητού μέσου πάνω στα κεριά (συνήθως ΜΑΥΡΗ, αλλά μπορεί να έχει άλλο χρώμα σε άλλους χρήστες). Long: κερί κλείνει ΠΑΝΩ από EMA50. Short: ΚΑΤΩ.",
    "≥2 ΕΠΙΠΕΔΑ: πρέπει να έχουν σπάσει τουλάχιστον 2 supports (long) ή 2 resistances (short).",
    "ΠΡΩΙΜΗ ΕΙΣΟΔΟΣ: αγοράζουμε χαμηλά / πουλάμε ψηλά, κοντά στην αρχή της κίνησης. Αν η κίνηση έχει ήδη τρέξει πολύ, είναι αργά.",
    "RR: υπολόγισέ το ΑΡΙΘΜΗΤΙΚΑ από τις τιμές Entry και SL (και TP) που διαβάζεις στο chart. RR = απόσταση(Entry→TP)/απόσταση(Entry→SL). Αν δεν διαβάζονται καθαρά, βάλε rr='' και κριτήριο risk_reward='unknown'. ΜΗΝ βγάζεις τυχαίο νούμερο.",
    "STOP LOSS: long κάτω από το τελευταίο support (+λίγο wick), short πάνω από το τελευταίο resistance.",
    "ΩΡΑ/ΗΜΕΡΑ: η ημερομηνία/ώρα είναι πάνω-πάνω δίπλα στο 'TradingView' και είναι ΩΡΑ ΕΛΛΑΔΑΣ. Βγάλε μόνος σου την ημέρα της εβδομάδας. Ιδανικά Τρίτη-Πέμπτη, NY session 14:00-18:00 ώρα Ελλάδας.",
    "",
    "==== ΤΑ ΒΑΘΜΟΛΟΓΟΥΜΕΝΑ ΚΡΙΤΗΡΙΑ ====",
    criteriaLines,
    "",
    "==== ELLIOTT (ΠΡΟΑΙΡΕΤΙΚΟ, ΔΕΝ ΒΑΘΜΟΛΟΓΕΙΤΑΙ) ====",
    "Το Elliott ΔΕΝ είναι κριτήριο και ΔΕΝ επηρεάζει το score. Γράψε κάτι στο 'elliottNote' ΜΟΝΟ αν είσαι σχετικά σίγουρος· αλλιώς άφησέ το κενό. ΜΗΝ μαντεύεις αριθμούς κυμάτων.",
    "",
    "==== ΟΔΗΓΙΕΣ ΒΑΘΜΟΛΟΓΗΣΗΣ ====",
    "- Να είσαι δίκαιος αλλά ΑΚΡΙΒΗΣ. Ό,τι δεν διαβάζεται → 'unknown' (όχι 'fail', όχι 'pass').",
    "- status: 'pass' = πληροί καθαρά, 'warn' = οριακό/μερικώς, 'fail' = σαφώς όχι, 'unknown' = δεν διαβάζεται.",
    "- score 0-100: συνολική καταλληλότητα βάσει ΜΟΝΟ των βαθμολογούμενων κριτηρίων. 70-100 καλό, 45-69 οριακό, 0-44 προς αποφυγή.",
    "- comment: 1-3 σύντομες, φιλικές προτάσεις στα Ελληνικά.",
    "- suggestion: πρακτική συμβουλή, ειδικά για αδύναμα setups.",
    "",
    "ΠΟΛΥ ΣΗΜΑΝΤΙΚΟ: Επίστρεψε ΜΟΝΟ ένα JSON αντικείμενο που ταιριάζει στο schema. Καθόλου markdown, καθόλου base64, καθόλου επανάληψη της εικόνας, κανένα κείμενο εκτός του JSON.",
  ].join("\n");
}

// -----------------------------------------------------------------------------
// Sanitization helpers — defense in depth. Even if the model misbehaves, only
// clean, length-capped, prose text ever leaves this module.
// -----------------------------------------------------------------------------

/** Strip data: URIs and any long base64-looking run from a text field. */
function stripBase64Blobs(input: string): string {
  if (!input) return "";
  let out = input;
  out = out.replace(/data:[a-zA-Z0-9.+/-]+;base64,[A-Za-z0-9+/=]+/g, " ");
  out = out.replace(/[A-Za-z0-9+/]{80,}={0,2}/g, " ");
  return out;
}

/** Collapse whitespace and hard-cap length. */
function clean(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  let s = stripBase64Blobs(input);
  s = s.replace(/[{}\[\]]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > max) s = s.slice(0, max).trim() + "…";
  return s;
}

function normalizeStatus(v: unknown): CriterionStatus {
  return v === "pass" || v === "warn" || v === "fail" || v === "unknown"
    ? v
    : "unknown";
}

function normalizeDirection(v: unknown): "long" | "short" | "unknown" {
  return v === "long" || v === "short" ? v : "unknown";
}

/**
 * Build the final, fully-sanitized result. Always returns the full criteria
 * list in the canonical order, filling any missing criterion with "unknown".
 */
function buildResult(parsed: Record<string, unknown>): CoachAnalysisResult {
  const rawCriteria = Array.isArray(parsed.criteria) ? parsed.criteria : [];
  const byId = new Map<CoachCriterionId, CoachCriterionResult>();
  for (const raw of rawCriteria) {
    if (!raw || typeof raw !== "object") continue;
    const id = (raw as { id?: unknown }).id as CoachCriterionId;
    if (!COACH_CRITERIA_IDS.includes(id)) continue;
    const def = COACH_CRITERIA.find((c) => c.id === id)!;
    byId.set(id, {
      id,
      label: def.label,
      status: normalizeStatus((raw as { status?: unknown }).status),
      note: clean((raw as { note?: unknown }).note, COACH_LIMITS.note),
    });
  }
  const criteria: CoachCriterionResult[] = COACH_CRITERIA.map((def) => {
    return (
      byId.get(def.id) ?? {
        id: def.id,
        label: def.label,
        status: "unknown" as CriterionStatus,
        note: "",
      }
    );
  });

  const scoreNum = Number((parsed as { score?: unknown }).score);
  const score = Number.isFinite(scoreNum)
    ? Math.max(0, Math.min(100, Math.round(scoreNum)))
    : 0;
  const band = scoreToBand(score);

  return {
    score,
    verdict: band.verdict,
    pair: clean((parsed as { pair?: unknown }).pair, COACH_LIMITS.pair),
    timeframe: clean((parsed as { timeframe?: unknown }).timeframe, COACH_LIMITS.timeframe),
    direction: normalizeDirection((parsed as { direction?: unknown }).direction),
    observations: clean((parsed as { observations?: unknown }).observations, COACH_LIMITS.observations),
    rr: clean((parsed as { rr?: unknown }).rr, COACH_LIMITS.rr),
    timeAnalysis: clean((parsed as { timeAnalysis?: unknown }).timeAnalysis, COACH_LIMITS.timeAnalysis),
    elliottNote: clean((parsed as { elliottNote?: unknown }).elliottNote, COACH_LIMITS.elliott),
    comment: clean((parsed as { comment?: unknown }).comment, COACH_LIMITS.comment),
    suggestion: clean((parsed as { suggestion?: unknown }).suggestion, COACH_LIMITS.suggestion),
    criteria,
  };
}

/** Best-effort JSON parse that tolerates code fences / surrounding prose. */
function parseModelJson(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  try {
    const v = JSON.parse(trimmed);
    if (v && typeof v === "object") return v as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      const v = JSON.parse(fence[1].trim());
      if (v && typeof v === "object") return v as Record<string, unknown>;
    } catch {
      /* fall through */
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const v = JSON.parse(trimmed.slice(start, end + 1));
      if (v && typeof v === "object") return v as Record<string, unknown>;
    } catch {
      /* fall through */
    }
  }
  return null;
}

function extractText(message: unknown): string {
  if (typeof message === "string") return message;
  if (Array.isArray(message)) {
    return message
      .map((c) => {
        if (typeof c === "string") return c;
        if (c && typeof c === "object" && "text" in c) {
          const t = (c as { text?: unknown }).text;
          return typeof t === "string" ? t : "";
        }
        return "";
      })
      .join("");
  }
  return "";
}

// Exported for unit tests.
export const __test__ = { stripBase64Blobs, clean, buildResult, parseModelJson };

// -----------------------------------------------------------------------------
// Shared helpers for re-parsing a stored row into the UI shape.
// -----------------------------------------------------------------------------

function parseCriteriaJson(json: string): CoachCriterionResult[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c) => c && typeof c === "object" && COACH_CRITERIA_IDS.includes(c.id))
      .map((c) => {
        const def = COACH_CRITERIA.find((d) => d.id === c.id)!;
        return {
          id: c.id as CoachCriterionId,
          label: def.label,
          status: normalizeStatus(c.status),
          note: clean(c.note, COACH_LIMITS.note),
        };
      });
  } catch {
    return [];
  }
}

// -----------------------------------------------------------------------------
// Router
// -----------------------------------------------------------------------------

export const coachRouter = router({
  /** Analyze one or two TradingView screenshots and persist the structured result. */
  analyze: protectedProcedure
    .input(analyzeInputSchema)
    .mutation(async ({ ctx, input }): Promise<CoachAnalysisResult & { id: number | null }> => {
      const imageContent = input.images.map((url) => ({
        type: "image_url" as const,
        image_url: { url, detail: "high" as const },
      }));

      const userText =
        input.images.length >= 2
          ? "Ανάλυσε αυτά τα δύο screenshots (ίδιο trade, διαφορετικά timeframes) και αξιολόγησε το setup με βάση τη στρατηγική. Πρώτα γράψε τι βλέπεις στο πεδίο observations."
          : "Ανάλυσε αυτό το setup από το TradingView και αξιολόγησέ το με βάση τη στρατηγική. Πρώτα γράψε τι βλέπεις στο πεδίο observations.";

      const response = await invokeLLM({
        messages: [
          { role: "system", content: buildSystemPrompt(input.images.length) },
          {
            role: "user",
            content: [{ type: "text", text: userText }, ...imageContent],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "coach_analysis", strict: true, schema: analysisSchema },
        },
      });

      const raw = extractText(response.choices?.[0]?.message?.content);
      if (!raw.trim()) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Ο Coach δεν έλαβε απάντηση από το μοντέλο. Δοκίμασε ξανά.",
        });
      }

      const parsed = parseModelJson(raw);
      if (!parsed) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Δεν μπορέσαμε να διαβάσουμε την ανάλυση. Δοκίμασε ξανά με πιο καθαρό screenshot.",
        });
      }

      const result = buildResult(parsed);

      // Persist only the structured fields (no image, no raw text).
      const row = await createCoachAnalysis({
        userId: ctx.user.id,
        accountId: input.accountId ?? 0,
        score: result.score,
        verdict: result.verdict,
        pair: result.pair,
        timeframe: result.timeframe,
        direction: result.direction,
        observations: result.observations,
        rr: result.rr,
        timeAnalysis: result.timeAnalysis,
        elliottNote: result.elliottNote,
        comment: result.comment,
        suggestion: result.suggestion,
        criteriaJson: JSON.stringify(result.criteria),
      });

      return { ...result, id: row?.id ?? null };
    }),

  /** Recent analyses for the current user. */
  history: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await listCoachAnalyses(ctx.user.id, input?.limit ?? 20);
      return rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        score: r.score,
        verdict: scoreToBand(r.score).verdict,
        pair: clean(r.pair, COACH_LIMITS.pair),
        timeframe: clean(r.timeframe, COACH_LIMITS.timeframe),
        direction: normalizeDirection(r.direction),
        observations: clean(r.observations, COACH_LIMITS.observations),
        rr: clean(r.rr, COACH_LIMITS.rr),
        timeAnalysis: clean(r.timeAnalysis, COACH_LIMITS.timeAnalysis),
        elliottNote: clean(r.elliottNote, COACH_LIMITS.elliott),
        comment: clean(r.comment, COACH_LIMITS.comment),
        suggestion: clean(r.suggestion, COACH_LIMITS.suggestion),
        criteria: parseCriteriaJson(r.criteriaJson),
      }));
    }),

  /** Delete one analysis owned by the current user. */
  remove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await deleteCoachAnalysis(ctx.user.id, input.id);
      return { ok: true };
    }),

  /** Get the chat thread for one analysis. */
  messages: protectedProcedure
    .input(z.object({ analysisId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const rows = await listCoachMessages(ctx.user.id, input.analysisId);
      return rows.map((m) => ({
        id: m.id,
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: clean(m.content, COACH_LIMITS.chat),
        createdAt: m.createdAt,
      }));
    }),

  /**
   * Ask the Coach a follow-up question about an existing analysis. The original
   * analysis (structured fields) is provided to the model as context so it can
   * answer "what should I fix?" coherently. (Images are not re-stored, so the
   * follow-up reasons over the recorded analysis rather than the raw chart.)
   */
  chat: protectedProcedure
    .input(
      z.object({
        analysisId: z.number().int().positive(),
        message: z.string().min(1).max(COACH_LIMITS.chat),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const analysis = await getCoachAnalysisById(ctx.user.id, input.analysisId);
      if (!analysis) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Η ανάλυση δεν βρέθηκε." });
      }

      const userMsg = clean(input.message, COACH_LIMITS.chat);
      await createCoachMessage({
        analysisId: input.analysisId,
        userId: ctx.user.id,
        role: "user",
        content: userMsg,
      });

      const history = await listCoachMessages(ctx.user.id, input.analysisId);

      const criteria = parseCriteriaJson(analysis.criteriaJson);
      const criteriaSummary = criteria
        .map((c) => `- ${c.label}: ${c.status}${c.note ? ` (${c.note})` : ""}`)
        .join("\n");

      const context = [
        "Είσαι ο «Trading Coach» και συζητάς με τον trader για ΜΙΑ συγκεκριμένη ανάλυση που έκανες ήδη.",
        "Απάντα στα Ελληνικά, σύντομα, πρακτικά και φιλικά. Βασίσου στην ανάλυση παρακάτω. Αν ο χρήστης ρωτά 'τι να διορθώσω', δώσε συγκεκριμένα βήματα.",
        "Μην επινοείς στοιχεία που δεν υπάρχουν στην ανάλυση. Δεν είναι επενδυτική συμβουλή.",
        "",
        "ΑΝΑΛΥΣΗ:",
        `Σύμβολο: ${analysis.pair || "—"} | Timeframe: ${analysis.timeframe || "—"} | Κατεύθυνση: ${analysis.direction}`,
        `Score: ${analysis.score}/100 (${scoreToBand(analysis.score).label})`,
        analysis.rr ? `RR: ${analysis.rr}` : "RR: δεν διαβάστηκε",
        analysis.timeAnalysis ? `Χρόνος: ${analysis.timeAnalysis}` : "",
        analysis.observations ? `Παρατηρήσεις: ${analysis.observations}` : "",
        "Κριτήρια:",
        criteriaSummary,
        analysis.comment ? `Σχόλιο: ${analysis.comment}` : "",
        analysis.suggestion ? `Πρόταση: ${analysis.suggestion}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const messages = [
        { role: "system" as const, content: context },
        ...history.map((m) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: m.content,
        })),
      ];

      const response = await invokeLLM({ messages });
      const reply = clean(
        extractText(response.choices?.[0]?.message?.content),
        COACH_LIMITS.chat,
      );
      const safeReply = reply || "Συγγνώμη, δεν μπόρεσα να απαντήσω αυτή τη στιγμή. Δοκίμασε ξανά.";

      const assistantRow = await createCoachMessage({
        analysisId: input.analysisId,
        userId: ctx.user.id,
        role: "assistant",
        content: safeReply,
      });

      return {
        id: assistantRow?.id ?? null,
        role: "assistant" as const,
        content: safeReply,
        createdAt: assistantRow?.createdAt ?? new Date(),
      };
    }),
});
