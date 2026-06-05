// patternAnalysis.ts — pure, deterministic computation of trading "patterns"
// from a flat list of closed trades. No network, no React: this is the math
// layer behind the Pattern Analysis page and is fully unit-tested.
//
// All inputs are plain `Trade` rows (see ./trading). We derive:
//   - Win rate / P&L grouped by weekday, hour-of-day, instrument class, setup,
//     and emotional state.
//   - Best/worst buckets and headline "key patterns".
//   - Heuristic strengths & weaknesses + an action plan, computed locally so
//     the page renders instantly even before any LLM summary arrives.
//
// The LLM narrative (see server/patternRouter.ts) is layered on top of these
// numbers; the numbers themselves are never invented by a model.

import type { Trade } from "./trading";
import { isClosedTrade } from "./trading";

// ---- Greek weekday handling ----------------------------------------------

const GREEK_DAYS = [
  "Κυριακή",
  "Δευτέρα",
  "Τρίτη",
  "Τετάρτη",
  "Πέμπτη",
  "Παρασκευή",
  "Σάββατο",
];

function normalizeGreek(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

// Map a normalized Greek weekday name -> canonical (accented) label.
const DAY_LABEL_BY_NORMALIZED: Record<string, string> = {
  ΚΥΡΙΑΚΗ: "Κυριακή",
  ΔΕΥΤΕΡΑ: "Δευτέρα",
  ΤΡΙΤΗ: "Τρίτη",
  ΤΕΤΑΡΤΗ: "Τετάρτη",
  ΠΕΜΠΤΗ: "Πέμπτη",
  ΠΑΡΑΣΚΕΥΗ: "Παρασκευή",
  ΣΑΒΒΑΤΟ: "Σάββατο",
};

/**
 * Resolve the weekday label for a trade. Prefers the explicit `day` field
 * (Greek name from the Excel import); falls back to deriving it from the
 * close/open timestamp.
 */
export function tradeWeekday(t: Trade): string | null {
  const explicit = DAY_LABEL_BY_NORMALIZED[normalizeGreek(t.day)];
  if (explicit) return explicit;
  const ts = t.close_time || t.open;
  if (ts) {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return GREEK_DAYS[d.getDay()];
  }
  return null;
}

/** Hour-of-day bucket (0-23) from the open timestamp, or null if unknown. */
export function tradeHour(t: Trade): number | null {
  const ts = t.open || t.close_time;
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return d.getHours();
}

// ---- Instrument classification -------------------------------------------

export type InstrumentClass =
  | "Forex"
  | "Indices"
  | "Metals"
  | "Crypto"
  | "Energy"
  | "Stocks"
  | "Other";

const INDEX_TOKENS = [
  "US30",
  "US100",
  "US500",
  "NAS",
  "NDX",
  "SPX",
  "SP500",
  "DAX",
  "GER40",
  "GER30",
  "UK100",
  "FTSE",
  "JP225",
  "NIK",
  "DJI",
  "DJ30",
  "DE40",
  "USTEC",
  "USIDX",
];
const METAL_TOKENS = ["XAU", "XAG", "GOLD", "SILVER", "XPT", "XPD"];
const CRYPTO_TOKENS = ["BTC", "ETH", "XRP", "LTC", "SOL", "DOGE", "ADA", "BNB"];
const ENERGY_TOKENS = ["OIL", "WTI", "BRENT", "USOIL", "UKOIL", "NGAS", "XNG", "XTI", "XBR"];

/** Classify a trading symbol into a broad instrument class. */
export function classifyInstrument(symbolRaw: string): InstrumentClass {
  const s = (symbolRaw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s) return "Other";
  if (METAL_TOKENS.some((t) => s.includes(t))) return "Metals";
  if (CRYPTO_TOKENS.some((t) => s.includes(t))) return "Crypto";
  if (ENERGY_TOKENS.some((t) => s.includes(t))) return "Energy";
  if (INDEX_TOKENS.some((t) => s.includes(t))) return "Indices";
  // Forex: 6-letter currency pair made of two known 3-letter currency codes.
  const FX = [
    "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD",
    "SEK", "NOK", "SGD", "HKD", "MXN", "ZAR", "TRY", "PLN",
  ];
  if (s.length >= 6) {
    const a = s.slice(0, 3);
    const b = s.slice(3, 6);
    if (FX.includes(a) && FX.includes(b)) return "Forex";
  }
  // A pure-alpha ticker of 1-5 chars is most likely a stock.
  if (/^[A-Z]{1,5}$/.test(s)) return "Stocks";
  return "Other";
}

// ---- Setup & emotion extraction -------------------------------------------

/**
 * Pull a coarse "setup" label out of a trade. Traders log setups inside the
 * pre-trade checklist / notes as a leading keyword; we look for common ones.
 * Returns "Not specified" when nothing recognisable is present.
 */
export function tradeSetup(t: Trade): string {
  const text = `${t.pre_checklist ?? ""} ${t.notes ?? ""} ${t.lessons_learned ?? ""}`.toLowerCase();
  const KNOWN: Array<[string, string]> = [
    ["breakout", "Breakout"],
    ["break out", "Breakout"],
    ["retest", "Retest"],
    ["pullback", "Pullback"],
    ["reversal", "Reversal"],
    ["range", "Range"],
    ["trend", "Trend"],
    ["scalp", "Scalp"],
    ["news", "News"],
    ["supply", "Supply/Demand"],
    ["demand", "Supply/Demand"],
    ["order block", "Order Block"],
    ["liquidity", "Liquidity Grab"],
    ["fvg", "FVG"],
  ];
  for (const [needle, label] of KNOWN) {
    if (text.includes(needle)) return label;
  }
  return "Not specified";
}

/**
 * Pull an emotional-state label out of a trade's psychology note. Returns
 * "Not specified" when empty.
 */
export function tradeEmotion(t: Trade): string {
  const text = (t.psychology ?? "").toLowerCase();
  if (!text.trim()) return "Not specified";
  const KNOWN: Array<[string[], string]> = [
    [["calm", "ήρεμ", "ηρεμ", "relaxed"], "Calm"],
    [["confident", "σιγουρ", "αυτοπεποίθηση", "αυτοπεποιθηση"], "Confident"],
    [["fear", "φόβο", "φοβο", "scared", "afraid"], "Fearful"],
    [["greed", "απληστ", "greedy"], "Greedy"],
    [["fomo"], "FOMO"],
    [["anxious", "αγχ", "stress", "stressed"], "Anxious"],
    [["revenge", "εκδίκ", "εκδικ"], "Revenge"],
    [["bored", "βαρι", "βαρε"], "Bored"],
    [["excited", "ενθουσ"], "Excited"],
    [["disciplined", "πειθαρχ"], "Disciplined"],
  ];
  for (const [needles, label] of KNOWN) {
    if (needles.some((n) => text.includes(n))) return label;
  }
  // Fall back to the first few words as a free-form label.
  const firstWords = (t.psychology ?? "").trim().split(/\s+/).slice(0, 3).join(" ");
  return firstWords || "Not specified";
}

// ---- Grouped stats ---------------------------------------------------------

export interface GroupStat {
  /** Display key for the bucket (weekday name, hour label, symbol, etc.). */
  key: string;
  trades: number;
  wins: number;
  losses: number;
  win_rate: number; // 0..1
  pnl: number;
  avg_pnl: number;
}

function emptyGroup(key: string): GroupStat {
  return { key, trades: 0, wins: 0, losses: 0, win_rate: 0, pnl: 0, avg_pnl: 0 };
}

function finalizeGroup(g: GroupStat): GroupStat {
  g.win_rate = g.trades > 0 ? g.wins / g.trades : 0;
  g.avg_pnl = g.trades > 0 ? g.pnl / g.trades : 0;
  return g;
}

function groupBy(
  trades: Trade[],
  keyFn: (t: Trade) => string | null,
): GroupStat[] {
  const map = new Map<string, GroupStat>();
  for (const t of trades) {
    const k = keyFn(t);
    if (k === null) continue;
    let g = map.get(k);
    if (!g) {
      g = emptyGroup(k);
      map.set(k, g);
    }
    g.trades += 1;
    const pnl = Number(t.pnl) || 0;
    g.pnl += pnl;
    if (pnl >= 0) g.wins += 1;
    else g.losses += 1;
  }
  return Array.from(map.values()).map(finalizeGroup);
}

const WEEKDAY_SORT: Record<string, number> = {
  Δευτέρα: 1,
  Τρίτη: 2,
  Τετάρτη: 3,
  Πέμπτη: 4,
  Παρασκευή: 5,
  Σάββατο: 6,
  Κυριακή: 7,
};

function hourLabel(h: number): string {
  const a = h.toString().padStart(2, "0");
  const b = ((h + 1) % 24).toString().padStart(2, "0");
  return `${a}:00–${b}:00`;
}

// ---- Top-level analysis ----------------------------------------------------

export interface PatternStat {
  /** Short headline, e.g. "Υψηλή Κερδοφορία την Τετάρτη". */
  title: string;
  /** Compact metric chip, e.g. "Τετάρτη: 4 συναλλαγές, WR 75%, P&L $7787". */
  chip: string;
  /** Longer explanation paragraph. */
  detail: string;
  /** "positive" | "warning" — drives colour. */
  tone: "positive" | "warning";
}

export interface SimpleNote {
  title: string;
  detail: string;
}

export interface PatternAnalysis {
  totalTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number; // 0..1
  totalPnl: number;
  byDay: GroupStat[];
  byHour: GroupStat[];
  byInstrument: GroupStat[];
  bySetup: GroupStat[];
  byEmotion: GroupStat[];
  bestDay: GroupStat | null;
  worstDay: GroupStat | null;
  bestInstrument: GroupStat | null;
  keyPatterns: PatternStat[];
  strengths: SimpleNote[];
  weaknesses: SimpleNote[];
  actionPlan: string[];
}

function fmtMoney(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Compute the full deterministic pattern analysis from a flat list of trades. */
export function analyzePatterns(allTrades: Trade[]): PatternAnalysis {
  const closed = allTrades.filter(isClosedTrade);
  const wins = closed.filter((t) => (Number(t.pnl) || 0) >= 0).length;
  const losses = closed.length - wins;
  const totalPnl = closed.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  const winRate = closed.length > 0 ? wins / closed.length : 0;

  const byDay = groupBy(closed, tradeWeekday).sort(
    (a, b) => (WEEKDAY_SORT[a.key] ?? 99) - (WEEKDAY_SORT[b.key] ?? 99),
  );
  const byHour = groupBy(closed, (t) => {
    const h = tradeHour(t);
    return h === null ? null : hourLabel(h);
  }).sort((a, b) => a.key.localeCompare(b.key));
  const byInstrument = groupBy(closed, (t) => classifyInstrument(t.symbol)).sort(
    (a, b) => b.pnl - a.pnl,
  );
  const bySetup = groupBy(closed, tradeSetup).sort((a, b) => b.pnl - a.pnl);
  const byEmotion = groupBy(closed, tradeEmotion).sort((a, b) => b.pnl - a.pnl);

  // Best/worst buckets (require at least one trade).
  const rankableDays = byDay.filter((d) => d.trades > 0);
  const bestDay =
    rankableDays.length > 0
      ? rankableDays.reduce((a, b) => (b.pnl > a.pnl ? b : a))
      : null;
  const worstDay =
    rankableDays.length > 0
      ? rankableDays.reduce((a, b) => (b.pnl < a.pnl ? b : a))
      : null;
  const bestInstrument = byInstrument.length > 0 ? byInstrument[0] : null;

  // ---- Key patterns (deterministic headlines) ----------------------------
  const keyPatterns: PatternStat[] = [];

  if (bestDay && bestDay.pnl > 0) {
    keyPatterns.push({
      title: `Υψηλή κερδοφορία την ${bestDay.key}`,
      chip: `${bestDay.key}: ${bestDay.trades} συναλλαγές, WR ${pct(
        bestDay.win_rate,
      )}, P&L ${fmtMoney(bestDay.pnl)}`,
      detail: `Η μεγαλύτερη συγκέντρωση κέρδους (${fmtMoney(
        bestDay.pnl,
      )}) προήλθε από ${bestDay.trades} συναλλαγές την ${bestDay.key}, με ποσοστό επιτυχίας ${pct(
        bestDay.win_rate,
      )}. Αυτό δείχνει ιδιαίτερα δυνατή απόδοση τη συγκεκριμένη ημέρα.`,
      tone: "positive",
    });
  }

  if (bestInstrument && bestInstrument.pnl > 0) {
    keyPatterns.push({
      title: `Εξαιρετική απόδοση σε ${bestInstrument.key}`,
      chip: `${bestInstrument.key}: ${bestInstrument.trades} συναλλαγές, WR ${pct(
        bestInstrument.win_rate,
      )}, P&L ${fmtMoney(bestInstrument.pnl)}`,
      detail: `Οι συναλλαγές σου σε ${bestInstrument.key} απέδωσαν ${fmtMoney(
        bestInstrument.pnl,
      )} με ποσοστό επιτυχίας ${pct(
        bestInstrument.win_rate,
      )}. Αυτό υποδηλώνει πιθανή εξειδίκευση σε αυτή την κατηγορία.`,
      tone: "positive",
    });
  }

  // Highest-volume instrument that is NOT the best earner → "concentration risk".
  const byVolume = [...byInstrument].sort((a, b) => b.trades - a.trades);
  const topVolume = byVolume[0];
  if (topVolume && bestInstrument && topVolume.key !== bestInstrument.key) {
    keyPatterns.push({
      title: `Κυριαρχία ${topVolume.key}, αλλά με χαμηλότερο P&L ανά συναλλαγή`,
      chip: `${topVolume.key}: ${topVolume.trades} συναλλαγές, WR ${pct(
        topVolume.win_rate,
      )}, P&L ${fmtMoney(topVolume.pnl)}`,
      detail: `Οι περισσότερες συναλλαγές σου (${topVolume.trades}) είναι σε ${topVolume.key} με ${pct(
        topVolume.win_rate,
      )} επιτυχία, αλλά το μέσο κέρδος ανά συναλλαγή (${fmtMoney(
        topVolume.avg_pnl,
      )}) είναι χαμηλότερο από την καλύτερή σου κατηγορία. Αξίζει να εξετάσεις γιατί.`,
      tone: "warning",
    });
  }

  // ---- Strengths ----------------------------------------------------------
  const strengths: SimpleNote[] = [];
  if (winRate >= 0.6 && closed.length > 0) {
    strengths.push({
      title: "Υψηλό συνολικό ποσοστό επιτυχίας",
      detail: `Το συνολικό σου ποσοστό επιτυχίας ${pct(
        winRate,
      )} είναι ισχυρό, υποδηλώνοντας ότι οι περισσότερες συναλλαγές σου είναι κερδοφόρες.`,
    });
  }
  if (totalPnl > 0) {
    strengths.push({
      title: "Ικανότητα παραγωγής σημαντικών κερδών",
      detail: `Με συνολικό P&L ${fmtMoney(totalPnl)} από ${closed.length} συναλλαγές, δείχνεις ικανότητα να αξιοποιείς τις ευνοϊκές συνθήκες αγοράς.`,
    });
  }
  if (bestDay && bestDay.win_rate >= 0.6) {
    strengths.push({
      title: `Συνέπεια την ${bestDay.key}`,
      detail: `Η ${bestDay.key} ξεχωρίζει με ${pct(
        bestDay.win_rate,
      )} επιτυχία — μια ημέρα όπου το πλάνο σου φαίνεται να λειτουργεί ιδιαίτερα καλά.`,
    });
  }

  // ---- Weaknesses ---------------------------------------------------------
  const weaknesses: SimpleNote[] = [];
  const setupSpecified = bySetup.filter((s) => s.key !== "Not specified");
  const emotionSpecified = byEmotion.filter((s) => s.key !== "Not specified");
  if (setupSpecified.length === 0 || emotionSpecified.length === 0) {
    weaknesses.push({
      title: "Ανεπαρκής καταγραφή δεδομένων",
      detail:
        "Δεν καταγράφεις σταθερά το συναισθηματικό σου επίπεδο ή το συγκεκριμένο setup για κάθε συναλλαγή. Αυτό είναι κρίσιμο για τον εντοπισμό επαναλαμβανόμενων μοτίβων και την κατανόηση των παραγόντων που επηρεάζουν την απόδοσή σου.",
    });
  }
  if (closed.length < 20) {
    weaknesses.push({
      title: "Περιορισμένος αριθμός συναλλαγών",
      detail: `Με μόλις ${closed.length} συναλλαγές, είναι νωρίς για οριστικά συμπεράσματα. Οποιαδήποτε μοτίβα παρατηρούνται μπορεί να είναι στατιστικός θόρυβος και όχι πραγματικές τάσεις.`,
    });
  }
  if (worstDay && worstDay.pnl < 0) {
    weaknesses.push({
      title: `Αδυναμία την ${worstDay.key}`,
      detail: `Η ${worstDay.key} εμφανίζει αρνητικό P&L (${fmtMoney(
        worstDay.pnl,
      )}) σε ${worstDay.trades} συναλλαγές. Εξέτασε αν αξίζει να μειώσεις το ρίσκο ή να αποφεύγεις συναλλαγές αυτή την ημέρα.`,
    });
  }

  // ---- Action plan --------------------------------------------------------
  const actionPlan: string[] = [];
  if (setupSpecified.length === 0 || emotionSpecified.length === 0) {
    actionPlan.push(
      "Ξεκίνα να καταγράφεις το συναισθηματικό σου επίπεδο (π.χ. ήρεμος, αγχωμένος, σίγουρος) και το συγκεκριμένο setup (π.χ. breakout, retest, range) για κάθε συναλλαγή.",
    );
  }
  if (closed.length < 30) {
    actionPlan.push(
      "Αύξησε τον αριθμό των καταγεγραμμένων συναλλαγών σε διαφορετικές ημέρες και instruments, ώστε τα μοτίβα να γίνουν στατιστικά αξιόπιστα.",
    );
  }
  if (bestDay && bestInstrument) {
    actionPlan.push(
      `Ανάλυσε γιατί πετυχαίνεις την ${bestDay.key} και σε ${bestInstrument.key}: εντόπισε τι κάνεις διαφορετικά και προσπάθησε να το αναπαράγεις.`,
    );
  }
  if (worstDay && worstDay.pnl < 0) {
    actionPlan.push(
      `Επανεξέτασε τις συναλλαγές της ${worstDay.key} και όρισε αυστηρότερα κριτήρια εισόδου ή μικρότερο ρίσκο για αυτή την ημέρα.`,
    );
  }
  if (actionPlan.length === 0) {
    actionPlan.push(
      "Διατήρησε τη συνέπεια στην καταγραφή και συνέχισε να παρακολουθείς τα μοτίβα σου καθώς συσσωρεύονται περισσότερα δεδομένα.",
    );
  }

  return {
    totalTrades: allTrades.length,
    closedTrades: closed.length,
    wins,
    losses,
    winRate,
    totalPnl,
    byDay,
    byHour,
    byInstrument,
    bySetup,
    byEmotion,
    bestDay,
    worstDay,
    bestInstrument,
    keyPatterns,
    strengths,
    weaknesses,
    actionPlan,
  };
}
