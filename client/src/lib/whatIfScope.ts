/**
 * What-If scope helpers (Round 11)
 * ================================
 *
 * Pure utilities used by `WhatIfCalculatorDialog` and its tests to:
 *   1. Extract a chronologically sorted month catalogue from `monthlyHistory`
 *      (plus the live current month if it is not in history yet).
 *   2. Filter a list of trades by an inclusive month-key range `[from, to]`.
 *
 * A *month key* is the canonical string `"YYYY-MM"` (zero-padded), matching
 * the shape used everywhere else (`MonthSnapshot.key`).
 */
import type { Trade } from "@/lib/trading";

/**
 * Lightweight description of a month, sufficient to build the scope picker UI
 * without dragging in the heavier MonthSnapshot type.
 */
export interface ScopeMonth {
  /** Canonical month key, e.g. "2026-04". */
  key: string;
  /** Long Greek name, e.g. "ΑΠΡΙΛΙΟΣ". */
  monthName: string;
  /** 4-digit year as a string, e.g. "2026". */
  yearFull: string;
  /** Short year (last 2 digits) — used for compact labels like "ΑΠΡ '26". */
  yearShort: string;
  /** Number of trades stored in this month's snapshot (0 for the live shell). */
  tradeCount: number;
}

/**
 * Extract the month key (YYYY-MM) from a trade's `open` ISO string. Returns
 * an empty string when the input cannot be parsed — callers should treat that
 * as "unknown month" and skip the trade.
 */
export function tradeMonthKey(open: string | undefined | null): string {
  if (!open || typeof open !== "string") return "";
  // Match an ISO-like prefix: YYYY-MM-DD…
  const m = /^(\d{4})-(\d{1,2})/.exec(open.trim());
  if (!m) return "";
  const yyyy = m[1];
  const mm = m[2].padStart(2, "0");
  return `${yyyy}-${mm}`;
}

/** Compare two month keys lexicographically. -1, 0, 1. Empty keys sort last. */
export function compareMonthKeys(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Filter a chronological list of trades down to those whose `open` falls
 * within the inclusive month-key range `[fromKey, toKey]`. If `fromKey` is
 * empty the lower bound is open; same for `toKey`.
 */
export function filterTradesByMonthRange(
  trades: Trade[],
  fromKey: string,
  toKey: string,
): Trade[] {
  if (!Array.isArray(trades)) return [];
  return trades.filter((t) => {
    const k = tradeMonthKey(t.open);
    if (!k) return false;
    if (fromKey && compareMonthKeys(k, fromKey) < 0) return false;
    if (toKey && compareMonthKeys(k, toKey) > 0) return false;
    return true;
  });
}

/**
 * Format a compact short label for a month key, e.g. "ΑΠΡ '26".
 */
export function shortMonthLabel(m: ScopeMonth): string {
  const stub = (m.monthName || "").slice(0, 3);
  return `${stub} '${m.yearShort || m.yearFull.slice(-2)}`;
}

export type ScopeRange = {
  fromKey: string;
  toKey: string;
  /** Human-readable label rendered on the scope chip + dialog title. */
  label: string;
};

/**
 * Build the canonical "ALL TIME" range covering every month in the catalogue.
 */
export function allTimeRange(months: ScopeMonth[]): ScopeRange {
  if (!months.length) {
    return { fromKey: "", toKey: "", label: "ALL TIME" };
  }
  const sorted = [...months].sort((a, b) => compareMonthKeys(a.key, b.key));
  return {
    fromKey: sorted[0].key,
    toKey: sorted[sorted.length - 1].key,
    label: "ALL TIME",
  };
}

/**
 * Build a single-month range. Falls back to an empty range when the month is
 * unknown.
 */
export function singleMonthRange(m: ScopeMonth | null): ScopeRange {
  if (!m) return { fromKey: "", toKey: "", label: "—" };
  return {
    fromKey: m.key,
    toKey: m.key,
    label: `${m.monthName} ${m.yearFull}`,
  };
}

/**
 * Build a range range. The label uses short month tags ("ΦΕΒ '26 → ΑΠΡ '26").
 */
export function multiMonthRange(from: ScopeMonth, to: ScopeMonth): ScopeRange {
  const a = compareMonthKeys(from.key, to.key) <= 0 ? from : to;
  const b = compareMonthKeys(from.key, to.key) <= 0 ? to : from;
  if (a.key === b.key) return singleMonthRange(a);
  return {
    fromKey: a.key,
    toKey: b.key,
    label: `${shortMonthLabel(a)} → ${shortMonthLabel(b)}`,
  };
}
