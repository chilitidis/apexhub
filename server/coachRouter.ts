import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import {
  createCoachAnalysis,
  listCoachAnalyses,
  deleteCoachAnalysis,
} from "./db";
import {
  COACH_CRITERIA,
  COACH_CRITERIA_IDS,
  COACH_LIMITS,
  scoreToBand,
  type CoachAnalysisResult,
  type CoachCriterionId,
  type CoachCriterionResult,
  type CriterionStatus,
} from "../shared/tradingCoach";

// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------

const analyzeInputSchema = z.object({
  // Base64 data URL of the screenshot: "data:image/png;base64,AAAA..."
  // Sent to the vision model in-flight only; never stored or echoed back.
  dataUrl: z.string().min(32).max(20_000_000),
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
    pair: { type: "string", description: "Σύμβολο, π.χ. NZDCHF. Κενό αν δεν διαβάζεται." },
    timeframe: { type: "string", description: "Timeframe, π.χ. H1. Κενό αν δεν διαβάζεται." },
    direction: { type: "string", enum: ["long", "short", "unknown"] },
    score: { type: "integer", description: "Βαθμολογία 0-100 για το πόσο ταιριάζει στη στρατηγική." },
    comment: { type: "string", description: "Φιλικό ελληνικό σχόλιο 1-3 προτάσεων." },
    suggestion: {
      type: "string",
      description: "Πρακτική πρόταση, ειδικά για αδύναμα setups (τι θα έκανες διαφορετικά).",
    },
    criteria: {
      type: "array",
      items: criterionSchema,
      description: "Ένα στοιχείο για κάθε κριτήριο της στρατηγικής.",
    },
  },
  required: ["pair", "timeframe", "direction", "score", "comment", "suggestion", "criteria"],
  additionalProperties: false,
} as const;

// -----------------------------------------------------------------------------
// System prompt — the Titans strategy, written so the model reads charts well
// but is not overly strict (per the owner's instruction).
// -----------------------------------------------------------------------------

function buildSystemPrompt(): string {
  const criteriaLines = COACH_CRITERIA.map(
    (c) => `- ${c.id} (${c.label}): ${c.hint}`,
  ).join("\n");

  return [
    "Είσαι ο «Trading Coach» της κοινότητας Titans. Αναλύεις ένα screenshot από το TradingView και αξιολογείς το setup με βάση τη στρατηγική Titans.",
    "Διαβάζεις προσεκτικά το γράφημα: το σύμβολο και το timeframe (πάνω αριστερά), τα κεριά, τα επίπεδα support/resistance (έγχρωμα ορθογώνια/ζώνες), τη μαύρη γραμμή κινητού μέσου που είναι ο EMA50 (σε άλλους χρήστες μπορεί να έχει άλλο χρώμα — είναι η κύρια MA γραμμή πάνω στα κεριά), τον RSI κάτω, και τις ώρες στον άξονα του χρόνου.",
    "",
    "Η ΣΤΡΑΤΗΓΙΚΗ TITANS (αξιολόγησε κάθε κριτήριο):",
    criteriaLines,
    "",
    "ΒΑΣΙΚΕΣ ΑΡΧΕΣ:",
    "- Αγοράζουμε ΧΑΜΗΛΑ (κοντά στην αρχή της ανοδικής κίνησης) και πουλάμε ΨΗΛΑ. Δεν κυνηγάμε κίνηση που έχει ήδη τρέξει πολύ.",
    "- Πριν μπούμε, θέλουμε να έχουν σπάσει ΤΟΥΛΑΧΙΣΤΟΝ 2 supports (για short) ή 2 resistances (για long) ώστε να πιάσουμε το κύμα 4-5 του Elliott, που στατιστικά είναι η μεγαλύτερη κίνηση.",
    "- Long: το κερί έχει κλείσει ΠΑΝΩ από τον EMA50 (μαύρη γραμμή). Short: ΚΑΤΩ από τον EMA50.",
    "- Stop loss: long κάτω από το τελευταίο support (+λίγο wick), short πάνω από το τελευταίο resistance. Στόχος RR τουλάχιστον 1:2.",
    "- Ιδανικός χρόνος: Τρίτη-Πέμπτη (μερικές φορές Παρασκευή), NY session ~14:00-18:00 ώρα Ελλάδας. Η ώρα φαίνεται στο TradingView.",
    "",
    "ΟΔΗΓΙΕΣ ΑΞΙΟΛΟΓΗΣΗΣ:",
    "- Να είσαι δίκαιος και βοηθητικός, ΟΧΙ υπερβολικά αυστηρός. Αν κάτι δεν φαίνεται καθαρά στο γράφημα, βάλε status 'unknown' αντί για 'fail'.",
    "- status: 'pass' = πληροί το κριτήριο, 'warn' = οριακό/μερικώς, 'fail' = σαφώς δεν το πληροί, 'unknown' = δεν διαβάζεται από το screenshot.",
    "- score 0-100: συνολική καταλληλότητα. 70-100 καλό setup, 45-69 οριακό, 0-44 να αποφευχθεί. Βάσισε το score στα κριτήρια αλλά με κρίση, όχι μηχανικά.",
    "- comment: 1-3 σύντομες, φιλικές προτάσεις στα Ελληνικά για το τι βλέπεις.",
    "- suggestion: πρακτική συμβουλή, ειδικά όταν το setup είναι αδύναμο (π.χ. «θα περίμενα να σπάσει ακόμη ένα support», «μπήκες αργά, η κίνηση είχε ήδη τρέξει», «το RR είναι μικρό, θα έβαζα TP πιο ψηλά»).",
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
  // data:...;base64,XXXX URIs
  out = out.replace(/data:[a-zA-Z0-9.+/-]+;base64,[A-Za-z0-9+/=]+/g, " ");
  // Any standalone base64-ish run of 80+ chars (PNG dumps etc.)
  out = out.replace(/[A-Za-z0-9+/]{80,}={0,2}/g, " ");
  return out;
}

/** Collapse whitespace and hard-cap length. */
function clean(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  let s = stripBase64Blobs(input);
  // Drop stray braces/brackets that hint at leaked JSON structure.
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
    comment: clean((parsed as { comment?: unknown }).comment, COACH_LIMITS.comment),
    suggestion: clean((parsed as { suggestion?: unknown }).suggestion, COACH_LIMITS.suggestion),
    criteria,
  };
}

/** Best-effort JSON parse that tolerates code fences / surrounding prose. */
function parseModelJson(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  // Try direct parse first.
  try {
    const v = JSON.parse(trimmed);
    if (v && typeof v === "object") return v as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  // Strip markdown code fences.
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      const v = JSON.parse(fence[1].trim());
      if (v && typeof v === "object") return v as Record<string, unknown>;
    } catch {
      /* fall through */
    }
  }
  // Extract the first balanced {...} block.
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
// Router
// -----------------------------------------------------------------------------

export const coachRouter = router({
  /** Analyze a TradingView screenshot and persist the structured result. */
  analyze: protectedProcedure
    .input(analyzeInputSchema)
    .mutation(async ({ ctx, input }): Promise<CoachAnalysisResult & { id: number | null }> => {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: buildSystemPrompt() },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Ανάλυσε αυτό το setup από το TradingView και αξιολόγησέ το με βάση τη στρατηγική Titans.",
              },
              { type: "image_url", image_url: { url: input.dataUrl, detail: "high" } },
            ],
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
      return rows.map((r) => {
        let criteria: CoachCriterionResult[] = [];
        try {
          const parsed = JSON.parse(r.criteriaJson);
          if (Array.isArray(parsed)) {
            criteria = parsed
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
          }
        } catch {
          criteria = [];
        }
        return {
          id: r.id,
          createdAt: r.createdAt,
          score: r.score,
          verdict: scoreToBand(r.score).verdict,
          pair: clean(r.pair, COACH_LIMITS.pair),
          timeframe: clean(r.timeframe, COACH_LIMITS.timeframe),
          direction: normalizeDirection(r.direction),
          comment: clean(r.comment, COACH_LIMITS.comment),
          suggestion: clean(r.suggestion, COACH_LIMITS.suggestion),
          criteria,
        };
      });
    }),

  /** Delete one analysis owned by the current user. */
  remove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await deleteCoachAnalysis(ctx.user.id, input.id);
      return { ok: true };
    }),
});
