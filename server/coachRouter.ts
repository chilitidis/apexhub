import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import {
  createCoachAnalysis,
  listCoachAnalyses,
  deleteCoachAnalysis,
} from "./db";
import {
  COACH_CRITERIA,
  COACH_CRITERIA_IDS,
  type CoachAnalysisResult,
  type CoachCriterionResult,
  type CoachVerdict,
  type CriterionStatus,
} from "@shared/coach";

/**
 * Trading Coach router.
 *
 * The user uploads a chart setup (screenshot OR TradingView link). A vision LLM
 * evaluates it against the trader's own rubric (see shared/coach.ts) and the
 * 20-point Pre-Trade Checklist, returning a verdict + per-criterion breakdown.
 *
 * The model is instructed to be strict and educational; output is constrained
 * by a JSON schema so the client can render it reliably. Results are persisted
 * so the user keeps an analysis history.
 */

const analyzeInputSchema = z
  .object({
    // Either a base64 data URL of a screenshot, or a TradingView link.
    dataUrl: z
      .string()
      .min(32)
      .max(20_000_000)
      .optional(),
    tvLink: z.string().url().max(2048).optional(),
    // Optional free-text context from the trader (current day/time, RR, etc).
    note: z.string().max(2000).optional().default(""),
  })
  .refine((v) => !!v.dataUrl || !!v.tvLink, {
    message: "Either a screenshot or a TradingView link is required",
  });

const historyInputSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(30),
});

export const coachRouter = router({
  /**
   * Analyse a single setup. Persists the result and returns it.
   */
  analyze: protectedProcedure
    .input(analyzeInputSchema)
    .mutation(async ({ ctx, input }) => {
      let imageUrl: string | null = null;
      let inputType: "screenshot" | "tradingview" = "tradingview";

      // Persist the screenshot (if any) so the history can show a thumbnail.
      let visionImageUrl: string | null = null;
      if (input.dataUrl) {
        inputType = "screenshot";
        const match = input.dataUrl.match(
          /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/,
        );
        if (!match) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid image data URL",
          });
        }
        const [, mime, b64] = match;
        const buffer = Buffer.from(b64, "base64");
        const ext = mime.split("/")[1] || "png";
        const key = `${ctx.user.id}/coach-setups/${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, mime);
        imageUrl = url;
        // Forward the original data URL to the vision model (always inline-able).
        visionImageUrl = input.dataUrl;
      }

      let result: CoachAnalysisResult;
      try {
        result = await runAnalysis({
          visionImageUrl,
          tvLink: input.tvLink ?? null,
          note: input.note ?? "",
        });
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Η ανάλυση απέτυχε. Δοκίμασε ξανά με μια πιο καθαρή εικόνα ή έγκυρο TradingView link.",
          cause: err,
        });
      }

      const saved = await createCoachAnalysis({
        userId: ctx.user.id,
        inputType,
        imageUrl: imageUrl,
        tvLink: input.tvLink ?? null,
        pair: result.pair.slice(0, 32),
        timeframe: result.timeframe.slice(0, 16),
        direction: result.direction.slice(0, 8),
        verdict: result.verdict,
        score: result.score,
        criteriaJson: JSON.stringify(result.criteria),
        summary: result.summary,
      });

      return {
        id: saved?.id ?? 0,
        inputType,
        imageUrl,
        tvLink: input.tvLink ?? null,
        createdAt: saved?.createdAt ?? new Date(),
        ...result,
      };
    }),

  /**
   * Returns the user's recent analyses (most recent first).
   */
  history: protectedProcedure
    .input(historyInputSchema)
    .query(async ({ ctx, input }) => {
      const rows = await listCoachAnalyses(ctx.user.id, input.limit);
      return rows.map((r) => {
        let criteria: CoachCriterionResult[] = [];
        try {
          criteria = JSON.parse(r.criteriaJson) as CoachCriterionResult[];
        } catch {
          criteria = [];
        }
        return {
          id: r.id,
          inputType: r.inputType,
          imageUrl: r.imageUrl,
          tvLink: r.tvLink,
          pair: r.pair,
          timeframe: r.timeframe,
          direction: r.direction,
          verdict: r.verdict as CoachVerdict,
          score: r.score,
          summary: r.summary ?? "",
          criteria,
          createdAt: r.createdAt,
        };
      });
    }),

  /**
   * Delete a saved analysis.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await deleteCoachAnalysis(ctx.user.id, input.id);
      return { success: true } as const;
    }),
});

// ----------------------------------------------------------------------------
// Core analysis: build the prompt, call the vision LLM, validate the JSON.
// ----------------------------------------------------------------------------

interface RunAnalysisArgs {
  visionImageUrl: string | null;
  tvLink: string | null;
  note: string;
}

export async function runAnalysis(
  args: RunAnalysisArgs,
): Promise<CoachAnalysisResult> {
  const userParts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "high" } }
  > = [];

  const contextLines: string[] = [];
  contextLines.push(
    "Αξιολόγησε το παρακάτω trading setup σύμφωνα με το rubric του συστήματος.",
  );
  if (args.tvLink) {
    contextLines.push(`TradingView link: ${args.tvLink}`);
    if (!args.visionImageUrl) {
      contextLines.push(
        "Δεν υπάρχει διαθέσιμη εικόνα — βάσισε την ανάλυση στο link και στις πληροφορίες που δίνει ο trader. Αν κάποιο κριτήριο δεν μπορεί να επιβεβαιωθεί οπτικά, βάλε status \"unknown\" και εξήγησε ότι χρειάζεται screenshot.",
      );
    }
  }
  if (args.note && args.note.trim()) {
    contextLines.push(`Σημειώσεις trader: ${args.note.trim()}`);
  }
  userParts.push({ type: "text", text: contextLines.join("\n") });

  if (args.visionImageUrl) {
    userParts.push({
      type: "image_url",
      image_url: { url: args.visionImageUrl, detail: "high" },
    });
  }

  const res = await invokeLLM({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userParts },
    ],
    response_format: {
      type: "json_schema",
      json_schema: RESULT_SCHEMA,
    },
  });

  const raw = res?.choices?.[0]?.message?.content;
  const text = typeof raw === "string" ? raw : "";
  if (!text.trim()) {
    throw new Error("Empty response from model");
  }

  const parsed = parseResult(text);
  return parsed;
}

function parseResult(text: string): CoachAnalysisResult {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    // Some models wrap JSON in markdown fences — strip and retry.
    const cleaned = text
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
    obj = JSON.parse(cleaned);
  }

  const o = obj as Record<string, unknown>;
  const rawCriteria = Array.isArray(o.criteria) ? o.criteria : [];

  // Normalise per-criterion results, guaranteeing one entry per known id.
  const byId = new Map<string, CoachCriterionResult>();
  for (const c of rawCriteria) {
    const cc = c as Record<string, unknown>;
    const id = String(cc.id ?? "");
    if (!COACH_CRITERIA_IDS.includes(id)) continue;
    byId.set(id, {
      id,
      label: COACH_CRITERIA.find((x) => x.id === id)?.label ?? id,
      status: normalizeStatus(cc.status),
      comment: String(cc.comment ?? "").slice(0, 400),
    });
  }
  const criteria: CoachCriterionResult[] = COACH_CRITERIA.map(
    (def) =>
      byId.get(def.id) ?? {
        id: def.id,
        label: def.label,
        status: "unknown" as CriterionStatus,
        comment: "Δεν αξιολογήθηκε.",
      },
  );

  const verdict = normalizeVerdict(o.verdict);
  let score = Number(o.score);
  if (!Number.isFinite(score)) score = 0;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    pair: String(o.pair ?? "").slice(0, 32),
    timeframe: String(o.timeframe ?? "").slice(0, 16),
    direction: String(o.direction ?? "").slice(0, 8).toUpperCase(),
    verdict,
    score,
    summary: String(o.summary ?? "").slice(0, 2000),
    criteria,
  };
}

function normalizeStatus(v: unknown): CriterionStatus {
  const s = String(v ?? "").toLowerCase();
  if (s === "pass" || s === "warn" || s === "fail" || s === "unknown") {
    return s;
  }
  return "unknown";
}

function normalizeVerdict(v: unknown): CoachVerdict {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("suitable") && !s.includes("un")) return "Suitable";
  if (s.includes("unsuitable")) return "Unsuitable";
  if (s.includes("marginal")) return "Marginal";
  // Greek fallbacks
  if (s.includes("κατάλληλο") && !s.includes("ακατάλληλο")) return "Suitable";
  if (s.includes("ακατάλληλο")) return "Unsuitable";
  return "Marginal";
}

const RESULT_SCHEMA = {
  name: "coach_analysis",
  strict: true,
  schema: {
    type: "object",
    properties: {
      pair: {
        type: "string",
        description: "Detected instrument, e.g. EURUSD. Empty string if unknown.",
      },
      timeframe: {
        type: "string",
        description: "Detected chart timeframe, e.g. H1 or H4. Empty if unknown.",
      },
      direction: {
        type: "string",
        description: "LONG, SHORT, or empty string if undetermined.",
      },
      verdict: {
        type: "string",
        enum: ["Suitable", "Marginal", "Unsuitable"],
      },
      score: {
        type: "integer",
        description: "Overall suitability score 0-100.",
      },
      summary: {
        type: "string",
        description: "Short Greek paragraph (2-4 sentences) explaining the verdict.",
      },
      criteria: {
        type: "array",
        description: "One entry per rubric criterion.",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              enum: COACH_CRITERIA_IDS,
            },
            status: {
              type: "string",
              enum: ["pass", "warn", "fail", "unknown"],
            },
            comment: {
              type: "string",
              description: "Short Greek explanation for this criterion.",
            },
          },
          required: ["id", "status", "comment"],
          additionalProperties: false,
        },
      },
    },
    required: [
      "pair",
      "timeframe",
      "direction",
      "verdict",
      "score",
      "summary",
      "criteria",
    ],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = buildSystemPrompt();

function buildSystemPrompt(): string {
  const criteriaText = COACH_CRITERIA.map(
    (c, i) => `${i + 1}. [${c.id}] ${c.label}: ${c.detail}`,
  ).join("\n");

  return [
    "Είσαι ο Trading Coach ενός professional trading journal. Αναλύεις chart setups που ανεβάζει ο trader (screenshot από TradingView ή link) και αποφασίζεις αν το setup είναι κατάλληλο σύμφωνα με ΑΥΣΤΗΡΑ τη μεθοδολογία μας.",
    "Γράφεις ΑΥΣΤΗΡΑ στα Ελληνικά. Είσαι ακριβής, εκπαιδευτικός και αυστηρός — δεν κολακεύεις. Στόχος είναι να μάθει ο trader, όχι να νιώσει καλά.",
    "",
    "ΤΑ CHARTS ΜΑΣ: TradingView, FXCM forex pairs (majors + CHF/JPY crosses). Πάντα εμφανίζουν EMA 50/100 (γραμμή) και RSI(14) subpanel. Πράσινα ορθογώνια = POI zones (support/resistance, supply/demand). Το εργαλείο 'long/short position' δείχνει πράσινη ζώνη target (TP) και κόκκινη ζώνη stop loss. Μερικές φορές υπάρχουν Elliott waves με ετικέτες (1)(2)(3)(4)(5) και μπλε γραμμή πρόβλεψης, καθώς και εικονίδια news στον άξονα χρόνου.",
    "",
    "ΑΞΙΟΛΟΓΗΣΕ ΑΥΣΤΗΡΑ ΤΑ ΕΞΗΣ 10 ΚΡΙΤΗΡΙΑ (χρησιμοποίησε ακριβώς αυτά τα ids):",
    criteriaText,
    "",
    "ΓΙΑ ΚΑΘΕ ΚΡΙΤΗΡΙΟ δώσε status:",
    "- 'pass' = πληρείται καθαρά",
    "- 'warn' = οριακό/μερικώς",
    "- 'fail' = δεν πληρείται ή υπάρχει παραβίαση κανόνα",
    "- 'unknown' = δεν φαίνεται από την εικόνα/δεδομένα (π.χ. χρειάζεται το H4 ή τα news)",
    "Κάθε comment 1-2 σύντομες προτάσεις, συγκεκριμένο και πρακτικό.",
    "",
    "ΒΑΘΜΟΛΟΓΙΑ (score 0-100): ξεκίνα από το πόσα κρίτηρια είναι pass. Τα κρίσιμα κριτήρια (trend, mtf, breakout_retest, ema50, rr) βαραίνουν περισσότερο. Αν κάποιο κρίσιμο κριτήριο είναι fail, το score δεν πρέπει να ξεπερνά το 55.",
    "VERDICT:",
    "- 'Suitable' (score >= 75 και κανένα κρίσιμο κριτήριο fail)",
    "- 'Marginal' (score 55-74 ή υπάρχουν warns σε κρίσιμα)",
    "- 'Unsuitable' (score < 55 ή fail σε κρίσιμο κριτήριο)",
    "",
    "Το summary: 2-4 προτάσεις στα Ελληνικά — τι κάνει το setup καλό/κακό και τι θα άλλαζες. Κλείσε με μια καθαρή σύσταση.",
    "ΜΗΝ εφεύρεις δεδομένα. Αν δεν φαίνεται κάτι, βάλε 'unknown'. Επίστρεψε ΜΟΝΟ JSON που ταιριάζει στο schema.",
    "ΥΠΕΝΘΥΜΙΣΗ: εκπαιδευτικό εργαλείο, όχι επενδυτική συμβουλή.",
  ].join("\n");
}

// Test-only exports — not part of the public router surface.
export const __test__ = { parseResult, normalizeVerdict, normalizeStatus };
