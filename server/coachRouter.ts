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

      // For TradingView link mode there is NO image in the URL itself. Try to
      // fetch the real chart SNAPSHOT (tradingview.com/x/XXXX -> the matching
      // s3 snapshot PNG) and feed THAT to the vision model. If we cannot get a
      // real image, we must NOT let the model hallucinate a pair/prices — that
      // is handled downstream by runAnalysis (no image => notes-only mode).
      let tvSnapshotFetched = false;
      if (!visionImageUrl && input.tvLink) {
        const snap = await fetchTradingViewSnapshot(input.tvLink);
        if (snap) {
          visionImageUrl = snap.dataUrl;
          tvSnapshotFetched = true;
          // Persist the snapshot so history can show a thumbnail too.
          try {
            const key = `${ctx.user.id}/coach-setups/tv-${Date.now()}.png`;
            const { url } = await storagePut(key, snap.buffer, "image/png");
            imageUrl = url;
          } catch {
            /* non-fatal: thumbnail is best-effort */
          }
        }
      }

      let result: CoachAnalysisResult;
      try {
        result = await runAnalysis({
          visionImageUrl,
          tvLink: input.tvLink ?? null,
          note: input.note ?? "",
          // When the link had no retrievable image, the model must stay in
          // notes-only mode and never invent the instrument or prices.
          imageIsReal: !!visionImageUrl,
          tvSnapshotFetched,
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
          // Re-sanitize on read: rows persisted before the sanitizer landed may
          // still hold raw JSON in `summary`. This guarantees history never
          // renders raw JSON/base64 even for legacy rows.
          summary: sanitizeSummaryServer(r.summary ?? ""),
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
  /** True only when a REAL chart image is being sent to the vision model. */
  imageIsReal?: boolean;
  /** True when the image came from a fetched TradingView snapshot. */
  tvSnapshotFetched?: boolean;
}

/**
 * A TradingView short link (tradingview.com/x/XXXX/) does NOT contain an image
 * — it is just a URL. The corresponding chart snapshot, however, is published at
 * https://s3.tradingview.com/snapshots/<first-char-lowercased>/<id>.png. We fetch
 * that PNG so the vision model analyses the ACTUAL chart instead of inventing a
 * random instrument. Returns null if the id cannot be parsed or the snapshot is
 * unavailable (in which case we fall back to notes-only mode).
 */
export function parseTradingViewSnapshotId(link: string): string | null {
  // Accept /x/<id>, /chart/<id>, or a bare id-looking path segment.
  const m = link.match(/tradingview\.com\/(?:x|chart)\/([A-Za-z0-9]+)/i);
  if (m && m[1]) return m[1];
  return null;
}

export function tradingViewSnapshotUrl(id: string): string {
  const first = id.charAt(0).toLowerCase();
  return `https://s3.tradingview.com/snapshots/${first}/${id}.png`;
}

async function fetchTradingViewSnapshot(
  link: string,
): Promise<{ buffer: Buffer; dataUrl: string } | null> {
  const id = parseTradingViewSnapshotId(link);
  if (!id) return null;
  const url = tradingViewSnapshotUrl(id);
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!resp.ok) return null;
    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("image")) return null;
    const arrayBuf = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    if (buffer.length < 1024) return null; // too small to be a real chart
    const dataUrl = `data:image/png;base64,${buffer.toString("base64")}`;
    return { buffer, dataUrl };
  } catch {
    return null;
  }
}

/**
 * Notes-only fallback used when no real chart image is available (e.g. a
 * TradingView link whose snapshot could not be fetched, and no screenshot).
 * We deliberately DO NOT call the vision model here so it cannot invent an
 * instrument or price levels. Every criterion is `unknown`, the pair/timeframe/
 * direction stay empty, and the summary clearly asks for a screenshot.
 */
function buildNotesOnlyResult(args: RunAnalysisArgs): CoachAnalysisResult {
  const criteria: CoachCriterionResult[] = COACH_CRITERIA.map((def) => ({
    id: def.id,
    label: def.label,
    status: "unknown" as CriterionStatus,
    comment: "Δεν υπάρχει εικόνα του chart για οπτική αξιολόγηση.",
  }));

  const note = (args.note ?? "").trim();
  const summary = note
    ? "Το TradingView link δεν περιέχει εικόνα του chart, οπότε δεν έγινε οπτική ανάλυση και δεν εφευρέθηκε ζευγάρι ή τιμές. Κατέγραψα τις σημειώσεις σου, αλλά για πραγματική αξιολόγηση των κριτηρίων (τάση, EMA50, breakout/retest, RR κ.λπ.) ανέβασε screenshot του chart."
    : "Το TradingView link δεν περιέχει εικόνα του chart, οπότε ο Coach δεν μπορεί να δει το setup. Ανέβασε screenshot για οπτική ανάλυση — δεν γίνεται αξιόπιστη αξιολόγηση μόνο από το link.";

  return {
    pair: "",
    timeframe: "",
    direction: "",
    verdict: "Marginal",
    score: 0,
    summary,
    criteria,
  };
}

export async function runAnalysis(
  args: RunAnalysisArgs,
): Promise<CoachAnalysisResult> {
  const userParts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "high" } }
  > = [];

  // CRITICAL: if there is NO real chart image (no screenshot and no fetched
  // TradingView snapshot), we must NOT call the vision model at all — otherwise
  // it hallucinates a random instrument and prices. Return a notes-only result
  // that is honest about the missing image and never invents pair/prices.
  if (!args.visionImageUrl) {
    return buildNotesOnlyResult(args);
  }

  const contextLines: string[] = [];
  contextLines.push(
    "Αξιολόγησε το παρακάτω trading setup σύμφωνα με το rubric του συστήματος.",
  );
  if (args.tvLink) {
    contextLines.push(`TradingView link: ${args.tvLink}`);
    if (args.tvSnapshotFetched) {
      contextLines.push(
        "Η παρακάτω εικόνα είναι το ΠΡΑΓΜΑΤΙΚΟ snapshot αυτού του TradingView link. Διάβασε instrument/timeframe/τιμές ΑΠΟ ΤΗΝ ΕΙΚΟΝΑ — ΜΗΝ μαντεύεις.",
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
  // The model usually nests criteria under `criteria`, but on malformed output
  // it can return a bare array or omit the wrapper. Fall back to scanning the
  // raw text for the criteria array so we never lose the breakdown.
  let rawCriteria: unknown[] = Array.isArray(o.criteria)
    ? (o.criteria as unknown[])
    : [];
  if (rawCriteria.length === 0) {
    rawCriteria = extractCriteriaArray(text);
  }

  // If the object parse failed to surface a TRUSTWORTHY summary, recover the
  // trailing prose from the raw text instead. We only trust `o.summary` when the
  // parsed object is the real analysis object (it carries verdict/score/criteria);
  // otherwise `extractJsonObject` may have grabbed a single criterion entry whose
  // own `summary`/`comment` would masquerade as the analysis summary. In that
  // case (and for the bare `[...]` + trailing-prose shape) we feed the FULL raw
  // text through the sanitizer, which keeps only the prose after the last bracket
  // and suppresses anything that still looks like JSON.
  const looksLikeAnalysisObject =
    "verdict" in o || "score" in o || "criteria" in o;
  if (
    !looksLikeAnalysisObject ||
    typeof o.summary !== "string" ||
    !o.summary.trim()
  ) {
    o.summary = sanitizeSummaryServer(text);
  }

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
    // Guarantee the persisted summary is human-readable text, never raw JSON.
    summary: sanitizeSummaryServer(o.summary).slice(0, 2000),
    criteria,
  };
}

/**
 * Ensure the summary stored in the DB / returned to the client is plain prose.
 * If the model leaked a JSON object/array into the summary field, recover the
 * embedded `summary` value or suppress it entirely (the structured criteria
 * list already conveys the breakdown).
 */
/**
 * Returns the index of the LAST top-level `]` that closes a balanced `[ ... ]`
 * array (string-aware, nesting-aware), or -1 if none. Used to locate the end of
 * the criteria array so trailing prose can be recovered as the summary.
 */
function lastTopLevelArrayClose(text: string): number {
  let depth = 0;
  let inStr = false;
  let esc = false;
  let result = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) result = i;
    }
  }
  return result;
}

export function sanitizeSummaryServer(raw: unknown): string {
  let s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return "";

  // 1) Unwrap markdown code fences.
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  const collapse = (t: string) =>
    t.replace(/\s+/g, " ").replace(/^[\s,;:.\-]+/, "").trim();

  const hasJsonStructure = (t: string) =>
    t.includes("{") ||
    t.includes("}") ||
    t.includes("[") ||
    t.includes("]") ||
    /"\s*\w+\s*"\s*:/.test(t) ||
    /\b(id|label|status|comment|criteria|verdict|score)"\s*:/.test(t);

  // 2) Try to recover an explicit `summary` field from embedded JSON, but ONLY
  //    when the embedded object is the real analysis object (carries
  //    verdict/score/criteria). A bare criterion entry may also have a `summary`
  //    or `comment` key, which we must NOT treat as the analysis summary.
  try {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start !== -1 && end > start) {
      const o = JSON.parse(s.slice(start, end + 1)) as Record<string, unknown>;
      const isAnalysis =
        "verdict" in o || "score" in o || "criteria" in o;
      if (isAnalysis && typeof o.summary === "string" && o.summary.trim()) {
        return collapse(o.summary.trim());
      }
    }
  } catch {
    /* ignore */
  }

  // Already clean prose.
  if (!hasJsonStructure(s)) return collapse(s);

  // 3) Keep only the prose AFTER the last structural close marker. When the
  //    payload contains a criteria array, the human prose almost always trails
  //    the closing `]` of that array — so prefer the position after the LAST
  //    top-level array close. Otherwise fall back to the last `]` or `}`.
  const lastArrayClose = lastTopLevelArrayClose(s);
  const lastClose =
    lastArrayClose !== -1
      ? lastArrayClose
      : Math.max(s.lastIndexOf("]"), s.lastIndexOf("}"));
  let tail = lastClose !== -1 ? s.slice(lastClose + 1) : s;
  tail = collapse(tail.replace(/^[\s,;:.\-\u2013\u2014)\u3011>}\]]+/, ""));

  // 4) Safety net: any residual JSON structure -> suppress entirely.
  if (!tail || hasJsonStructure(tail)) return "";
  return tail;
}

/**
 * Best-effort extraction of the criteria array from a model response when the
 * top-level JSON object could not be parsed (e.g. the model emitted the array
 * followed by trailing prose). Scans for the first balanced `[ ... ]` that
 * parses to an array of criterion-like objects.
 */
export function extractCriteriaArray(text: string): unknown[] {
  const src = text
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "");
  // Find a `"criteria"` key first; otherwise scan from the first `[`.
  const keyIdx = src.search(/"criteria"\s*:/);
  const scanFrom = keyIdx !== -1 ? src.indexOf("[", keyIdx) : src.indexOf("[");
  if (scanFrom === -1) return [];

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = scanFrom; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        const candidate = src.slice(scanFrom, i + 1);
        try {
          const arr = JSON.parse(candidate);
          if (Array.isArray(arr)) return arr;
        } catch {
          /* ignore */
        }
        break;
      }
    }
  }
  return [];
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

  // 3) Scan for ALL balanced top-level { ... } blocks and prefer the one that
  //    actually looks like the analysis object (has verdict/criteria/score),
  //    not the first stray `{` (which is often a single criterion entry).
  const candidates: Record<string, unknown>[] = [];
  let depth = 0;
  let inStr = false;
  let esc = false;
  let blockStart = -1;
  for (let i = 0; i < fenced.length; i++) {
    const ch = fenced[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") {
      if (depth === 0) blockStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && blockStart !== -1) {
        const parsed = tryParse(fenced.slice(blockStart, i + 1));
        if (parsed) candidates.push(parsed);
        blockStart = -1;
      }
    }
  }
  if (candidates.length > 0) {
    const isAnalysis = (o: Record<string, unknown>) =>
      "verdict" in o || "criteria" in o || "score" in o;
    return candidates.find(isAnalysis) ?? candidates[0];
  }

  // 4) Could not parse any object — synthesize a minimal one so the criteria
  //    fallback in parseResult can still recover the breakdown.
  return {};
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
    "",
    "=== ΜΟΡΦΗ ΕΞΟΔΟΥ (ΑΥΣΤΗΡΟ — ΜΗΝ ΤΟ ΠΑΡΑΒΕΙΣ) ===",
    "Επίστρεψε ΑΠΟΚΛΕΙΣΤΙΚΑ ΕΝΑ έγκυρο JSON object που ταιριάζει στο schema — ΤΙΠΟΤΑ ΑΛΛΟ.",
    "- ΜΗΝ γράψεις εισαγωγικό κείμενο, επεξήγηση ή σχόλιο πριν ή μετά το JSON.",
    "- ΜΗΝ χρησιμοποιήσεις markdown code fences (χωρίς ``` ή ```json).",
    "- ΜΗΝ βάλεις το summary ΕΞΩ από το object. Το summary είναι ΠΑΝΤΑ πεδίο ΜΕΣΑ στο ίδιο JSON: { \"...\": ..., \"criteria\": [...], \"summary\": \"...\" }.",
    "- Η απάντησή σου πρέπει να ξεκινά με { και να τελειώνει με }. Κανένας χαρακτήρας εκτός του JSON.",
    "Στα pair/timeframe/direction βάλε αυτά που ΔΙΑΒΑΣΕΣ από το header.",
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
  sanitizeSummaryServer,
  extractCriteriaArray,
  parseTradingViewSnapshotId,
  tradingViewSnapshotUrl,
  buildNotesOnlyResult,
  runAnalysis,
};
