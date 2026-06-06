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
  const text = flattenContent(raw);
  if (!text.trim()) {
    throw new Error("Empty response from model");
  }

  const parsed = parseResult(text);
  return parsed;
}

/**
 * The LLM content can be a plain string OR (on some backends, e.g. Gemini via
 * the multimodal endpoint) an array of content parts. Flatten any text parts
 * into a single string so downstream JSON extraction always has something to
 * work with.
 */
function flattenContent(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const p = part as Record<string, unknown>;
          if (typeof p.text === "string") return p.text;
          if (
            p.type === "text" &&
            p.text &&
            typeof (p.text as Record<string, unknown>).value === "string"
          ) {
            return (p.text as Record<string, unknown>).value as string;
          }
        }
        return "";
      })
      .join("");
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
  }
  return "";
}

function parseResult(text: string): CoachAnalysisResult {
  const obj = extractJsonObject(text);

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

/**
 * Robustly extract a JSON object from a model response that may contain
 * markdown fences, leading/trailing prose, or both. Falls back to scanning for
 * the first balanced `{ ... }` block so the verdict UI always gets an object.
 */
function extractJsonObject(text: string): Record<string, unknown> {
  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === "object" && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };

  // 1) Direct parse.
  const direct = tryParse(text.trim());
  if (direct) return direct;

  // 2) Strip markdown code fences and retry.
  const fenced = text
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
  const fromFenced = tryParse(fenced);
  if (fromFenced) return fromFenced;

  // 3) Scan for the first balanced top-level { ... } block.
  const start = fenced.indexOf("{");
  if (start !== -1) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < fenced.length; i++) {
      const ch = fenced[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = fenced.slice(start, i + 1);
          const parsed = tryParse(candidate);
          if (parsed) return parsed;
          break;
        }
      }
    }
  }

  throw new Error("Could not extract JSON object from model response");
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
    "Είσαι ο Trading Coach ενός professional trading journal. Αναλύεις chart setups που ανεβάζει ο trader (screenshot από TradingView ή link) και αποφασίζεις αν το setup ταιριάζει με τη μεθοδολογία μας.",
    "Γράφεις ΠΑΝΤΑ στα Ελληνικά. Είσαι ακριβής και δίκαιος: δεν κολακεύεις, αλλά ούτε τιμωρείς ένα καλό setup. ΑΝΑΓΝΩΡΙΖΕΙΣ τα θετικά του setup όπου υπάρχουν.",
    "",
    "=== ΒΗΜΑ 1: ΔΙΑΒΑΣΕ ΚΥΡΙΟΛΕΚΤΙΚΑ ΤΗΝ ΕΙΚΟΝΑ (κρίσιμο) ===",
    "Πριν κρίνεις οτιδήποτε, διάβασε τα ορατά στοιχεία ΟΠΩΣ ΑΚΡΙΒΩΣ ΦΑΙΝΟΝΤΑΙ. ΜΗΝ μαντεύεις.",
    "- INSTRUMENT/PAIR: διάβασέ το από το πάνω-αριστερά header του chart (π.χ. 'New Zealand Dollar/Swiss Franc' → NZDCHF, ή το ticker στο price label π.χ. 'NZDCHF'). ΜΗΝ υποθέτεις EURUSD αν δεν το γράφει.",
    "- TIMEFRAME: από το header (π.χ. '1h' → H1, '4h' → H4).",
    "- ΗΜΕΡΟΜΗΝΙΑ & ΩΡΑ: από το header (π.χ. 'created with TradingView.com, Jun 06, 2026 04:23 UTC+3'). Αυτή είναι η ώρα που πήρε το setup ο trader.",
    "- ΚΑΤΕΥΘΥΝΣΗ: από το position tool. ΚΟΚΚΙΝΗ ζώνη ΠΑΝΩ από την τιμή και ΠΡΑΣΙΝΗ ΚΑΤΩ = SHORT. Το αντίθετο = LONG.",
    "- EMA: η γραμμή EMA. Δες αν η τιμή είναι ΠΑΝΩ ή ΚΑΤΩ από αυτήν και αν η EMA ανεβαίνει/κατεβαίνει.",
    "- POI ZONES: τα πράσινα ορθογώνια = support/resistance zones.",
    "- ΤΑΣΗ: κοίτα τη γενική κατεύθυνση των κεριών και της EMA. Κατερχόμενη EMA + lower highs/lows = ΚΑΘΟΔΙΚΗ τάση (ΟΧΙ ranging).",
    "",
    "=== ΒΗΜΑ 2: ΑΞΙΟΛΟΓΗΣΕ ΤΑ 10 ΚΡΙΤΗΡΙΑ (χρησιμοποίησε ακριβώς αυτά τα ids) ===",
    criteriaText,
    "",
    "STATUS ανά κριτήριο:",
    "- 'pass' = πληρείται (γενναιόδωρος όταν το κριτήριο ικανοποιείται εύλογα)",
    "- 'warn' = οριακό/χρειάζεται επιβεβαίωση (π.χ. φαίνεται μόνο H1)",
    "- 'fail' = υπάρχει ΣΑΦΗΣ παραβίαση κανόνα που φαίνεται καθαρά",
    "- 'unknown' = δεν φαίνεται καθόλου (χρησιμοποίησέ το ΜΟΝΟ όταν πραγματικά δεν υπάρχει καμία ορατή ένδειξη)",
    "ΣΗΜΑΝΤΙΚΟ: ΜΗΝ βάζεις 'fail' ή 'unknown' απλώς επειδή δεν είσαι 100% σίγουρος. Αν το στοιχείο φαίνεται στο chart, αξιολόγησέ το.",
    "Κάθε comment 1-2 σύντομες προτάσεις, συγκεκριμένο και πρακτικό, αναφερόμενο σε αυτό που φαίνεται.",
    "",
    "=== ΒΗΜΑ 3: ΒΑΘΜΟΛΟΓΙΑ & VERDICT ===",
    "score 0-100: pass = πλήρεις πόντοι, warn = μισοί, unknown = ουδέτερο (ΜΗΝ τιμωρείς το score για unknown), fail = 0. Τα κρίσιμα (trend, breakout_retest, ema50, rr) βαραίνουν περισσότερο.",
    "VERDICT:",
    "- 'Suitable' (τα κρίσιμα κριτήρια είναι pass και score >= 70)",
    "- 'Marginal' (score 50-69 ή υπάρχουν warns σε κρίσιμα, αλλά κανένα fail)",
    "- 'Unsuitable' (σαφής παραβίαση σε κρίσιμο κριτήριο, ή score < 50)",
    "",
    "Το summary: 2-4 προτάσεις στα Ελληνικά — τι κάνει το setup καλό/κακό και τι θα άλλαζες. Κλείσε με μια καθαρή σύσταση.",
    "Επίστρεψε ΜΟΝΟ JSON που ταιριάζει στο schema. Στα pair/timeframe/direction βάλε αυτά που ΔΙΑΒΑΣΕΣ από το header.",
    "ΥΠΕΝΘΥΜΙΣΗ: εκπαιδευτικό εργαλείο, όχι επενδυτική συμβουλή.",
  ].join("\n");
}

// Test-only exports — not part of the public router surface.
export const __test__ = {
  parseResult,
  normalizeVerdict,
  normalizeStatus,
  extractJsonObject,
  flattenContent,
};
