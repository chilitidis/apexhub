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
 * Make sure the human-readable summary is NEVER raw JSON.
 *
 * Strategy (bulletproof, not regex-whack-a-mole):
 *   1. Unwrap markdown code fences.
 *   2. If an explicit `summary` field can be recovered from embedded JSON, use it.
 *   3. Otherwise, KEEP ONLY genuine prose — the text that comes AFTER the last
 *      structural JSON character (`]` or `}`). Models that leak the payload
 *      almost always emit `[...criteria...]`, <prose> — so the readable verdict
 *      is whatever trails the final bracket/brace.
 *   4. As a final safety net, if any JSON-ish residue remains (quotes-with-colon
 *      keys, stray braces/brackets), suppress the summary entirely so only the
 *      structured criteria list renders. A clean prose string can NEVER contain
 *      a `{`, `}`, `[`, `]`, or a `"key":` pattern, so this is safe.
 */
export function sanitizeSummary(
  raw: unknown,
  criteria?: CoachCriterionResult[],
): string {
  void criteria;
  let s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return "";

  // 1) Strip markdown code fences if present.
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  // 2) Try to recover an explicit `summary` field from embedded JSON.
  const recovered = recoverSummaryField(s);
  if (recovered) return finalize(recovered);

  // Quick exit: already clean prose (no JSON structure at all).
  if (!hasJsonStructure(s)) return finalize(s);

  // 3) Keep only the prose AFTER the last structural bracket/brace. When the
  //    payload contains a criteria array, the human prose almost always trails
  //    the closing `]` of that array — so prefer the position after the LAST
  //    top-level array close. Otherwise fall back to the last `]` or `}`.
  const lastArrayClose = lastTopLevelArrayClose(s);
  const lastClose =
    lastArrayClose !== -1
      ? lastArrayClose
      : Math.max(s.lastIndexOf("]"), s.lastIndexOf("}"));
  let tail = lastClose !== -1 ? s.slice(lastClose + 1) : s;
  // Drop a leading separator the model often leaves (",", ":", "-", etc.).
  tail = tail.replace(/^[\s,;:.\-–—)】>]+/, "").trim();

  // 4) Safety net — if the tail still looks JSON-ish, or the whole thing was
  //    JSON with no trailing prose, suppress entirely.
  if (!tail || hasJsonStructure(tail)) return "";

  return finalize(tail);
}

/** Detect any residual JSON structure that must never reach the UI. */
function hasJsonStructure(s: string): boolean {
  return (
    s.includes("{") ||
    s.includes("}") ||
    s.includes("[") ||
    s.includes("]") ||
    /"\s*\w+\s*"\s*:/.test(s) ||
    /\b(id|label|status|comment|criteria|verdict|score)"\s*:/.test(s)
  );
}

/**
 * Pull out an explicit `summary` field from an embedded JSON object — but ONLY
 * when that object is the real analysis object (carries verdict/score/criteria).
 * A stray single-criterion object can also have a `summary`/`comment` key, which
 * must NOT be mistaken for the analysis summary.
 */
function recoverSummaryField(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as Record<
      string,
      unknown
    >;
    const isAnalysis =
      "verdict" in obj || "score" in obj || "criteria" in obj;
    if (isAnalysis && typeof obj.summary === "string" && obj.summary.trim()) {
      return obj.summary.trim();
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Index of the LAST top-level `]` that closes a balanced `[ ... ]` array
 * (string-aware, nesting-aware), or -1 if none. Mirrors the server helper so the
 * client can recover the trailing prose after a leaked criteria array.
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

/** Collapse whitespace and trim stray leading punctuation from recovered prose. */
function finalize(s: string): string {
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
