// lib/coachNormalize.ts
// ----------------------------------------------------------------------------
// Pure (UI-free) normalization for Trading Coach analysis results. Kept out of
// the page component so it can be unit-tested without pulling in heavy UI deps
// (streamdown/katex). Guarantees the rendered object is always well-formed and
// that raw JSON never leaks into the human-readable summary.
// ----------------------------------------------------------------------------

import type {
  CoachCriterionResult,
  CoachVerdict,
  CriterionStatus,
} from "@shared/coach";

export interface AnalysisView {
  id: number;
  pair: string;
  timeframe: string;
  direction: string;
  verdict: CoachVerdict;
  score: number;
  summary: string;
  criteria: CoachCriterionResult[];
  imageUrl: string | null;
  tvLink: string | null;
  createdAt: Date | string;
}

const VALID_STATUSES: CriterionStatus[] = ["pass", "warn", "fail", "unknown"];

/**
 * Make sure the human-readable summary is never raw JSON. If the model dumped
 * a JSON object/array into the summary field, we extract a readable sentence
 * (or fall back to empty so only the structured criteria render).
 */
export function sanitizeSummary(
  raw: unknown,
  criteria: CoachCriterionResult[],
): string {
  let s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return "";
  void criteria;

  // 1) Strip markdown code fences if present.
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  // 2) If the WHOLE thing parses as JSON, try to pull out a `summary` field.
  const tryExtractSummaryField = (text: string): string | null => {
    try {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start !== -1 && end > start) {
        const obj = JSON.parse(text.slice(start, end + 1)) as Record<
          string,
          unknown
        >;
        if (typeof obj.summary === "string" && obj.summary.trim()) {
          return obj.summary.trim();
        }
      }
    } catch {
      /* ignore */
    }
    return null;
  };

  const looksJsonish =
    /\{\s*"\w+"\s*:/.test(s) ||
    /\[\s*\{/.test(s) ||
    /"(criteria|verdict|score|id|label|status|comment)"\s*:/.test(s);

  if (looksJsonish) {
    const extracted = tryExtractSummaryField(s);
    if (extracted) return cleanupProse(extracted);

    // 3) Aggressively strip ALL JSON-like fragments wherever they appear
    //    (the model sometimes prepends the criteria array, then the prose).
    let cleaned = s;
    // Remove bracketed arrays of objects: [ {...}, {...} ]
    cleaned = cleaned.replace(/\[\s*\{[\s\S]*?\}\s*\]/g, " ");
    // Remove any remaining standalone JSON objects: { "key": ... }
    cleaned = cleaned.replace(/\{[\s\S]*?\}/g, " ");
    // Remove leftover quoted key fragments and stray brackets/braces.
    cleaned = cleaned
      .replace(/"(id|label|status|comment|criteria|verdict|score)"\s*:?/gi, " ")
      .replace(/[\[\]{}]/g, " ")
      .replace(/^[\s,;:]+/, "")
      .trim();

    cleaned = cleanupProse(cleaned);
    // If after stripping there is no meaningful prose left, suppress entirely.
    if (cleaned.replace(/[\s.,;:"']/g, "").length < 8) return "";
    return cleaned;
  }

  return cleanupProse(s);
}

/** Collapse whitespace and trim stray leading punctuation from recovered prose. */
function cleanupProse(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:.\-]+/, "")
    .trim();
}

/**
 * Defensive normalizer: guarantees the object we render is a well-formed
 * AnalysisView. Most importantly it coerces `criteria` into an array even if it
 * somehow arrives as a JSON string, so the verdict UI never falls back to
 * rendering raw JSON text.
 */
export function normalizeAnalysis(input: unknown): AnalysisView {
  const o = (input ?? {}) as Record<string, unknown>;

  let rawCriteria: unknown = o.criteria;
  if (typeof rawCriteria === "string") {
    try {
      rawCriteria = JSON.parse(rawCriteria);
    } catch {
      rawCriteria = [];
    }
  }
  const criteria: CoachCriterionResult[] = Array.isArray(rawCriteria)
    ? rawCriteria.map((c) => {
        const cc = (c ?? {}) as Record<string, unknown>;
        const status = String(cc.status ?? "unknown") as CriterionStatus;
        return {
          id: String(cc.id ?? ""),
          label: String(cc.label ?? cc.id ?? ""),
          status: VALID_STATUSES.includes(status) ? status : "unknown",
          comment: String(cc.comment ?? ""),
        };
      })
    : [];

  // Last-resort guard: if `summary` accidentally contains the whole JSON
  // object (some models dump the structured payload into a text field), strip
  // it so we never render raw JSON in the verdict banner.
  const summary = sanitizeSummary(o.summary, criteria);

  const verdictRaw = String(o.verdict ?? "Marginal");
  const verdict: CoachVerdict =
    verdictRaw === "Suitable" || verdictRaw === "Unsuitable"
      ? verdictRaw
      : "Marginal";

  let score = Number(o.score);
  if (!Number.isFinite(score)) score = 0;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    id: Number(o.id ?? 0),
    pair: String(o.pair ?? ""),
    timeframe: String(o.timeframe ?? ""),
    direction: String(o.direction ?? ""),
    verdict,
    score,
    summary,
    criteria,
    imageUrl: (o.imageUrl as string | null) ?? null,
    tvLink: (o.tvLink as string | null) ?? null,
    createdAt: (o.createdAt as Date | string) ?? new Date(),
  };
}
