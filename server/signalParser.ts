/**
 * signalParser.ts — turns free-form Telegram channel posts into structured
 * trade signals.
 *
 * The owner types signals by hand in his private channel, so the parser is
 * deliberately tolerant: EN + Greek keywords, decimal commas, emoji, pips
 * annotations, slashes in symbols ("CAD/CHF"), MARKET/CMP entries, numbered
 * or bare TPs. It is however STRICT about correctness — unknown symbols and
 * missing / wrong-side stop losses are rejected outright, because a wrong
 * signal would produce a wrong lot for every member.
 */
import { findInstrument, normalizeSymbol } from "../shared/instruments";

export interface ParsedSignal {
  symbol: string;
  direction: "BUY" | "SELL";
  entryType: "market" | "limit";
  entry: number | null;
  sl: number;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  /** Non-fatal issues, e.g. wrong-side TPs that were dropped. */
  warnings: string[];
}

export interface ParsedClose {
  action: "close";
  symbol: string;
}

export type ParseSignalResult = ParsedSignal | ParsedClose | { error: string };

export function isParseError(r: ParseSignalResult): r is { error: string } {
  return "error" in r;
}

export function isCloseAction(r: ParseSignalResult): r is ParsedClose {
  return "action" in r && (r as ParsedClose).action === "close";
}

/* ------------------------------------------------------------------ */
/* Number handling                                                    */
/* ------------------------------------------------------------------ */

/**
 * Parse a price token, accepting the Greek decimal comma ("0,6520") and
 * thousands separators ("2,400.5"). Returns NaN when not a number.
 */
function parsePrice(tok: string): number {
  let s = tok.trim();
  if (!s) return NaN;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // "2,400.50" → comma is a thousands separator.
    s = s.replace(/,/g, "");
  } else if (hasComma) {
    // "0,6520" → decimal comma.
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

const NUMBER_RE = /[0-9]+(?:[.,][0-9]+)*/;

/** First price-looking number in `s`, or null. */
function firstNumber(s: string): number | null {
  const m = s.match(NUMBER_RE);
  if (!m) return null;
  const n = parsePrice(m[0]);
  return Number.isFinite(n) ? n : null;
}

/* ------------------------------------------------------------------ */
/* Keyword detection (EN + Greek, case/accents tolerant)              */
/* ------------------------------------------------------------------ */

/** Uppercase + strip Greek accents so "Στόχος" and "ΣΤΟΧΟΣ" both match. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

const BUY_WORDS = ["BUY", "LONG", "ΑΓΟΡΑ"];
const SELL_WORDS = ["SELL", "SHORT", "ΠΩΛΗΣΗ"];
const CLOSE_WORDS = ["CLOSE", "CLOSED", "CANCEL", "CANCELLED", "ΚΛΕΙΣΕ", "ΚΛΕΙΣΤΕ", "ΚΛΕΙΣΙΜΟ", "ΑΚΥΡΟ", "ΑΚΥΡΩΣΗ"];
const MARKET_WORDS = ["MARKET", "CMP", "NOW", "ΤΩΡΑ", "ΑΓΟΡΑΣ"];

function hasWord(foldedText: string, words: string[]): boolean {
  return words.some((w) => new RegExp(`(^|[^A-ZΑ-Ω0-9])${w}([^A-ZΑ-Ω0-9]|$)`).test(foldedText));
}

/** Find the first token in `text` that maps to a known instrument. */
function findSymbol(text: string): string | null {
  const tokens = text.match(/[A-Za-z0-9]+(?:[\/\-][A-Za-z0-9]+)?/g) ?? [];
  for (const tok of tokens) {
    const compact = tok.replace(/[\/\-]/g, "");
    if (compact.length < 3 || compact.length > 8) continue;
    const norm = normalizeSymbol(tok);
    if (findInstrument(norm)) return norm;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Field extraction                                                   */
/* ------------------------------------------------------------------ */

interface FieldHit {
  kind: "entry" | "sl" | "tp";
  /** Explicit TP index (1-3) when the keyword carried one (TP1, Στόχος 2). */
  index: number | null;
  /** Raw value text right after the keyword. */
  rest: string;
  pos: number;
}

// Keyword alternatives, longest-first so "STOP LOSS" wins over "STOP" and
// "TAKE PROFIT" over "TP". Greek keywords are written accent-free because the
// text is folded first.
const FIELD_KEYWORD_RE = new RegExp(
  [
    "(?<entry>ENTRY|ΕΙΣΟΔΟΣ)",
    "(?<sl>STOP\\s*LOSS|S\\.L\\.|SL|STOP|ΣΤΟΠ)",
    "(?<tp>TAKE\\s*PROFIT|T\\.P\\.|TP|TARGET|ΣΤΟΧΟΣ)",
  ].join("|"),
  "g",
);

/**
 * Scan the folded text for field keywords. For each hit we capture up to the
 * next keyword (or line end) as the value zone.
 */
function scanFields(folded: string): FieldHit[] {
  const matches: { kind: FieldHit["kind"]; pos: number; end: number }[] = [];
  FIELD_KEYWORD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FIELD_KEYWORD_RE.exec(folded)) !== null) {
    const g = m.groups!;
    const kind = g.entry !== undefined ? "entry" : g.sl !== undefined ? "sl" : "tp";
    // Keyword must stand alone (avoid matching the SL inside "SLIPPAGE" or
    // the TP inside "WTVTP..."). Check char before; char after may be digit
    // (TP1) or punctuation.
    const before = m.index > 0 ? folded[m.index - 1] : " ";
    if (/[A-ZΑ-Ω0-9]/.test(before)) continue;
    const after = folded[m.index + m[0].length] ?? " ";
    if (/[A-ZΑ-Ω]/.test(after)) continue;
    matches.push({ kind, pos: m.index, end: m.index + m[0].length });
  }

  const hits: FieldHit[] = [];
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const zoneEnd = Math.min(
      i + 1 < matches.length ? matches[i + 1].pos : folded.length,
      indexOfLineEnd(folded, cur.end),
    );
    let rest = folded.slice(cur.end, zoneEnd);
    let index: number | null = null;
    if (cur.kind === "tp") {
      // "TP1: 1.2000" / "ΣΤΟΧΟΣ 2 - 0,6480" → leading 1-3 directly after the
      // keyword is an INDEX only when it is not the start of the price
      // itself ("TP 1.2000").
      const im = rest.match(/^\s*([1-3])(?![.,0-9])/);
      if (im) {
        index = Number(im[1]);
        rest = rest.slice(im[0].length);
      }
    }
    hits.push({ kind: cur.kind, index, rest, pos: cur.pos });
  }
  return hits;
}

function indexOfLineEnd(s: string, from: number): number {
  const i = s.indexOf("\n", from);
  return i === -1 ? s.length : i;
}

/* ------------------------------------------------------------------ */
/* Main entry point                                                   */
/* ------------------------------------------------------------------ */

export function parseSignal(text: string): ParseSignalResult {
  const raw = (text ?? "").trim();
  if (!raw) return { error: "Empty message" };

  const folded = fold(raw);
  const lines = folded.split("\n").map((l) => l.trim());
  const headZone = lines.slice(0, 3).join("\n");

  // ---- CLOSE / CANCEL messages -----------------------------------------
  if (hasWord(folded, CLOSE_WORDS)) {
    const sym = findSymbol(folded);
    if (sym) return { action: "close", symbol: sym };
    // "CLOSE ALL" / "ΚΛΕΙΣΤΕ ΟΛΑ" → close every active signal.
    if (hasWord(folded, ["ALL", "ΟΛΑ"])) return { action: "close", symbol: "*" };
    return { error: "Close message without a known symbol" };
  }

  // ---- Symbol + direction (first ~3 lines) -----------------------------
  const symbol = findSymbol(headZone);
  if (!symbol) return { error: "No known instrument symbol found" };

  const isBuy = hasWord(headZone, BUY_WORDS);
  const isSell = hasWord(headZone, SELL_WORDS);
  if (isBuy === isSell) {
    return { error: isBuy ? "Ambiguous direction (both BUY and SELL)" : "No direction (BUY/SELL) found" };
  }
  const direction: "BUY" | "SELL" = isBuy ? "BUY" : "SELL";

  // ---- Fields ----------------------------------------------------------
  const hits = scanFields(folded);
  const warnings: string[] = [];

  let entry: number | null = null;
  let entrySeen = false;
  let sl: number | null = null;
  const tps: (number | null)[] = [null, null, null];
  let nextTpSlot = 0;

  for (const hit of hits) {
    if (hit.kind === "entry") {
      entrySeen = true;
      if (hasWord(hit.rest, MARKET_WORDS)) continue; // market entry
      const n = firstNumber(hit.rest);
      if (n !== null) entry = n;
    } else if (hit.kind === "sl") {
      const n = firstNumber(hit.rest);
      if (n !== null && sl === null) sl = n;
    } else {
      const n = firstNumber(hit.rest);
      if (n === null) continue;
      if (hit.index !== null) {
        tps[hit.index - 1] = n;
        nextTpSlot = Math.max(nextTpSlot, hit.index);
      } else if (nextTpSlot < 3) {
        tps[nextTpSlot] = n;
        nextTpSlot++;
      }
    }
  }

  // "@ 1.0850" style inline entry (only when no Entry keyword produced one).
  if (entry === null) {
    const at = headZone.match(/@\s*(MARKET|CMP|NOW|ΤΩΡΑ|[0-9]+(?:[.,][0-9]+)*)/);
    if (at) {
      entrySeen = true;
      if (!/^[0-9]/.test(at[1])) {
        // "@ market" → market entry
      } else {
        const n = parsePrice(at[1]);
        if (Number.isFinite(n)) entry = n;
      }
    }
  }
  void entrySeen;

  // ---- Validation ------------------------------------------------------
  if (sl === null) return { error: "No SL (stop loss) found — signal rejected" };
  if (sl <= 0) return { error: "SL must be > 0" };
  if (entry !== null && entry <= 0) return { error: "Entry must be > 0" };

  if (entry !== null) {
    if (direction === "BUY" && sl >= entry) return { error: "SL on wrong side" };
    if (direction === "SELL" && sl <= entry) return { error: "SL on wrong side" };
  }

  // TP side check: against entry when we have one, otherwise against the SL
  // (a BUY target must at least be above the stop). Wrong-side TPs are
  // dropped with a warning — not fatal.
  const ref = entry ?? sl;
  const cleaned: number[] = [];
  for (let i = 0; i < 3; i++) {
    const tp = tps[i];
    if (tp === null) continue;
    if (tp <= 0) {
      warnings.push(`TP${i + 1} dropped: must be > 0`);
      continue;
    }
    const wrongSide = direction === "BUY" ? tp <= ref : tp >= ref;
    if (wrongSide) {
      warnings.push(`TP${i + 1} (${tp}) dropped: wrong side for ${direction}`);
      continue;
    }
    cleaned.push(tp);
  }

  // Order type: explicit words in the message win ("SELL LIMIT" / "BUY NOW"),
  // otherwise fall back to the old heuristic (price given -> pending/limit).
  const explicitLimit = /\bLIMIT\b/.test(folded) || /\b(BUY|SELL)\s+STOP\b/.test(folded);
  const explicitNow = hasWord(folded, MARKET_WORDS);
  const entryType: "market" | "limit" =
    explicitLimit ? "limit" : explicitNow ? "market" : entry !== null ? "limit" : "market";

  return {
    symbol,
    direction,
    entryType,
    entry,
    sl,
    tp1: cleaned[0] ?? null,
    tp2: cleaned[1] ?? null,
    tp3: cleaned[2] ?? null,
    warnings,
  };
}
