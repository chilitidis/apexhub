/**
 * Specs for `lib/whatIfScope`.
 */
import { describe, expect, it } from "vitest";

import type { Trade } from "@/lib/trading";
import {
  allTimeRange,
  compareMonthKeys,
  filterTradesByMonthRange,
  multiMonthRange,
  shortMonthLabel,
  singleMonthRange,
  tradeMonthKey,
  type ScopeMonth,
} from "@/lib/whatIfScope";

const trade = (overrides: Partial<Trade>): Trade => ({
  idx: 0,
  day: "ΔΕΥ",
  open: "2026-04-15T09:30",
  close_time: "2026-04-15T15:00",
  symbol: "EURUSD",
  direction: "BUY",
  lots: 1,
  entry: 1.1,
  close: 1.11,
  sl: 1.09,
  tp: 1.12,
  trade_r: 1,
  pnl: 100,
  swap: 0,
  commission: 0,
  net_pct: 0.01,
  tf: "H1",
  chart_before: "",
  chart_after: "",
  ...overrides,
});

const month = (
  monthName: string,
  yearFull: string,
  mm: string,
  count = 0,
): ScopeMonth => ({
  key: `${yearFull}-${mm}`,
  monthName,
  yearFull,
  yearShort: yearFull.slice(-2),
  tradeCount: count,
});

describe("tradeMonthKey", () => {
  it("extracts YYYY-MM from a typical open string", () => {
    expect(tradeMonthKey("2026-04-15T09:30")).toBe("2026-04");
    expect(tradeMonthKey("2025-12-01")).toBe("2025-12");
  });

  it("zero-pads single-digit months", () => {
    // The trading.ts parser always emits zero-padded months, but we still
    // defend against it just in case.
    expect(tradeMonthKey("2026-1-05")).toBe("2026-01");
  });

  it("returns empty for malformed inputs", () => {
    expect(tradeMonthKey("")).toBe("");
    expect(tradeMonthKey(undefined)).toBe("");
    expect(tradeMonthKey("not-a-date")).toBe("");
  });
});

describe("compareMonthKeys", () => {
  it("orders chronologically", () => {
    expect(compareMonthKeys("2026-01", "2026-04")).toBe(-1);
    expect(compareMonthKeys("2025-12", "2026-01")).toBe(-1);
    expect(compareMonthKeys("2026-04", "2026-04")).toBe(0);
    expect(compareMonthKeys("2026-04", "2026-01")).toBe(1);
  });

  it("pushes empty keys to the end", () => {
    expect(compareMonthKeys("", "2026-04")).toBe(1);
    expect(compareMonthKeys("2026-04", "")).toBe(-1);
  });
});

describe("filterTradesByMonthRange", () => {
  const trades: Trade[] = [
    trade({ idx: 1, open: "2025-12-15T10:00" }),
    trade({ idx: 2, open: "2026-01-05T11:30" }),
    trade({ idx: 3, open: "2026-02-20T09:00" }),
    trade({ idx: 4, open: "2026-03-12T14:45" }),
    trade({ idx: 5, open: "2026-04-25T19:00" }),
  ];

  it("keeps only trades whose open falls inclusively in the range", () => {
    const filtered = filterTradesByMonthRange(trades, "2026-02", "2026-03");
    expect(filtered.map((t) => t.idx)).toEqual([3, 4]);
  });

  it("treats empty fromKey as open lower bound", () => {
    const filtered = filterTradesByMonthRange(trades, "", "2026-01");
    expect(filtered.map((t) => t.idx)).toEqual([1, 2]);
  });

  it("treats empty toKey as open upper bound", () => {
    const filtered = filterTradesByMonthRange(trades, "2026-03", "");
    expect(filtered.map((t) => t.idx)).toEqual([4, 5]);
  });

  it("returns the full list when the range is empty/empty", () => {
    expect(filterTradesByMonthRange(trades, "", "").length).toBe(trades.length);
  });

  it("ignores trades with malformed open strings", () => {
    const dirty: Trade[] = [
      trade({ idx: 99, open: "" }),
      trade({ idx: 100, open: "garbage" }),
      trade({ idx: 101, open: "2026-04-30T10:00" }),
    ];
    const filtered = filterTradesByMonthRange(dirty, "2026-01", "2026-12");
    expect(filtered.map((t) => t.idx)).toEqual([101]);
  });
});

describe("range builders", () => {
  const dec = month("ΔΕΚΕΜΒΡΙΟΣ", "2025", "12", 16);
  const jan = month("ΙΑΝΟΥΑΡΙΟΣ", "2026", "01", 20);
  const feb = month("ΦΕΒΡΟΥΑΡΙΟΣ", "2026", "02", 29);
  const apr = month("ΑΠΡΙΛΙΟΣ", "2026", "04", 22);

  it("singleMonthRange formats `<MONTH> <YEAR>` as label", () => {
    const r = singleMonthRange(apr);
    expect(r.fromKey).toBe("2026-04");
    expect(r.toKey).toBe("2026-04");
    expect(r.label).toBe("ΑΠΡΙΛΙΟΣ 2026");
  });

  it("multiMonthRange normalises order and uses short labels", () => {
    const r = multiMonthRange(apr, feb);
    expect(r.fromKey).toBe("2026-02");
    expect(r.toKey).toBe("2026-04");
    expect(r.label).toBe("ΦΕΒ '26 → ΑΠΡ '26");
  });

  it("multiMonthRange collapses to single-month label when both ends match", () => {
    const r = multiMonthRange(apr, apr);
    expect(r.fromKey).toBe("2026-04");
    expect(r.toKey).toBe("2026-04");
    expect(r.label).toBe("ΑΠΡΙΛΙΟΣ 2026");
  });

  it("allTimeRange spans the catalogue regardless of input order", () => {
    const r = allTimeRange([apr, dec, feb, jan]);
    expect(r.fromKey).toBe("2025-12");
    expect(r.toKey).toBe("2026-04");
    expect(r.label).toBe("ALL TIME");
  });

  it("allTimeRange returns empty range when catalogue is empty", () => {
    const r = allTimeRange([]);
    expect(r.fromKey).toBe("");
    expect(r.toKey).toBe("");
    expect(r.label).toBe("ALL TIME");
  });

  it("shortMonthLabel emits `MON 'YY`", () => {
    expect(shortMonthLabel(apr)).toBe("ΑΠΡ '26");
    expect(shortMonthLabel(dec)).toBe("ΔΕΚ '25");
  });
});
