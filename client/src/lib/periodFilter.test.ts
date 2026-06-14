import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  resolveRange,
  flattenHistoryTrades,
  filterStampedByRange,
  aggregateKpis,
  computePeriodView,
} from "./periodFilter";
import type { Trade } from "./trading";
import type { MonthSnapshot } from "@/hooks/useJournal";

const FIXED_NOW = new Date("2026-04-20T10:00:00.000Z");

const baseTrade = (overrides: Partial<Trade>): Trade => ({
  idx: 0,
  day: "ΤΡΙ",
  open: "2026-04-10T09:00:00.000Z",
  close_time: "2026-04-10T10:00:00.000Z",
  symbol: "EURUSD",
  direction: "BUY",
  lots: 0.1,
  entry: 1.0,
  close: 1.01,
  sl: null,
  tp: null,
  trade_r: null,
  pnl: 10,
  swap: 0,
  commission: 0,
  net_pct: 0,
  tf: "H1",
  chart_before: "",
  chart_after: "",
  ...overrides,
});

function snap(key: string, year: string, trades: Trade[]): MonthSnapshot {
  const [y, m] = key.split("-");
  return {
    key,
    month_name: "M" + m,
    year_full: year,
    year_short: year.slice(-2),
    starting: 0,
    ending: 0,
    net_result: 0,
    return_pct: 0,
    total_trades: trades.length,
    wins: 0,
    losses: 0,
    win_rate: 0,
    max_drawdown_pct: 0,
    trades_json: JSON.stringify(trades),
    saved_at: 0,
  };
}

describe("periodFilter.resolveRange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns open range for 'all'", () => {
    expect(resolveRange("all")).toEqual({ preset: "all", from: null, to: null });
  });

  it("returns start of month for 'this-month'", () => {
    const r = resolveRange("this-month");
    expect(r.from?.getDate()).toBe(1);
    expect(r.from?.getMonth()).toBe(FIXED_NOW.getMonth());
    expect(r.to).not.toBeNull();
  });

  it.each(["30d", "60d", "90d"] as const)("returns a rolling window for '%s'", (preset) => {
    const r = resolveRange(preset);
    const days = (r.to!.getTime() - r.from!.getTime()) / 86_400_000;
    const expectedDays = Number(preset.replace("d", ""));
    expect(days).toBeGreaterThanOrEqual(expectedDays - 0.01);
    expect(days).toBeLessThanOrEqual(expectedDays + 1.01);
  });

  it("respects custom range inputs", () => {
    const from = new Date("2026-01-10T00:00:00.000Z");
    const to = new Date("2026-02-05T00:00:00.000Z");
    const r = resolveRange("custom", { from, to });
    expect(r.from?.getDate()).toBe(from.getDate());
    expect(r.to?.getDate()).toBe(to.getDate());
  });
});

describe("periodFilter.flattenHistoryTrades", () => {
  it("returns trades stamped with parsed timestamps and sorted ascending", () => {
    const history = [
      snap("2026-04", "2026", [
        baseTrade({ idx: 1, open: "2026-04-15T09:00:00.000Z" }),
        baseTrade({ idx: 2, open: "2026-04-05T09:00:00.000Z" }),
      ]),
      snap("2026-03", "2026", [
        baseTrade({ idx: 3, open: "2026-03-20T09:00:00.000Z" }),
      ]),
    ];
    const out = flattenHistoryTrades(history);
    expect(out).toHaveLength(3);
    expect(out.map(t => t.idx)).toEqual([3, 2, 1]);
    expect(out[0].month_key).toBe("2026-03");
  });

  it("falls back to a mid-month timestamp when both open and close_time are unparseable", () => {
    const history = [
      snap("2026-02", "2026", [baseTrade({ idx: 99, open: "garbage", close_time: "also-garbage" })]),
    ];
    const out = flattenHistoryTrades(history);
    expect(out).toHaveLength(1);
    // Fallback should land somewhere inside February 2026 regardless of the
    // sandbox's local timezone (mid-month + 12:00 local => still Feb).
    const ts = out[0].timestamp;
    const lower = new Date(2026, 1, 1).getTime();
    const upper = new Date(2026, 2, 1).getTime();
    expect(ts).toBeGreaterThanOrEqual(lower);
    expect(ts).toBeLessThan(upper);
  });
});

describe("periodFilter.filterStampedByRange", () => {
  const history = [
    snap("2026-04", "2026", [
      baseTrade({ idx: 1, open: "2026-04-01T09:00:00.000Z" }),
      baseTrade({ idx: 2, open: "2026-04-15T09:00:00.000Z" }),
    ]),
    snap("2026-03", "2026", [
      baseTrade({ idx: 3, open: "2026-03-20T09:00:00.000Z" }),
    ]),
  ];

  it("returns the original list for 'all'", () => {
    const all = flattenHistoryTrades(history);
    const out = filterStampedByRange(all, { preset: "all", from: null, to: null });
    expect(out).toHaveLength(3);
  });

  it("keeps only trades within the given window", () => {
    const all = flattenHistoryTrades(history);
    const from = new Date("2026-04-01T00:00:00.000Z");
    const to = new Date("2026-04-30T23:59:59.999Z");
    const out = filterStampedByRange(all, { preset: "custom", from, to });
    expect(out.map(t => t.idx).sort()).toEqual([1, 2]);
  });
});

describe("periodFilter.aggregateKpis", () => {
  it("computes return_pct against the supplied base balance", () => {
    const history = [
      snap("2026-04", "2026", [
        baseTrade({ idx: 1, pnl: 100 }),
        baseTrade({ idx: 2, pnl: -40 }),
      ]),
    ];
    const stamped = flattenHistoryTrades(history);
    const kpis = aggregateKpis(stamped, 1000);
    expect(kpis.net_result).toBe(60);
    expect(kpis.return_pct).toBeCloseTo(0.06, 5);
    expect(kpis.win_rate).toBeCloseTo(0.5, 5);
    expect(kpis.base).toBe(1000);
  });

  it("returns zeros when there are no trades", () => {
    const kpis = aggregateKpis([], 5000);
    expect(kpis.total_trades).toBe(0);
    expect(kpis.net_result).toBe(0);
    expect(kpis.return_pct).toBe(0);
  });
});

describe("periodFilter.computePeriodView", () => {
  it("flattens, filters, and aggregates in one call", () => {
    const history = [
      snap("2026-04", "2026", [
        baseTrade({ idx: 1, open: "2026-04-05T09:00:00.000Z", pnl: 50 }),
        baseTrade({ idx: 2, open: "2026-04-15T09:00:00.000Z", pnl: -20 }),
      ]),
      snap("2026-03", "2026", [
        baseTrade({ idx: 3, open: "2026-03-20T09:00:00.000Z", pnl: 200 }),
      ]),
    ];
    const view = computePeriodView(
      history,
      {
        preset: "custom",
        from: new Date("2026-04-01T00:00:00.000Z"),
        to: new Date("2026-04-30T23:59:59.999Z"),
      },
      1000,
    );
    expect(view.trades.map(t => t.idx).sort()).toEqual([1, 2]);
    expect(view.kpis.net_result).toBe(30);
    expect(view.kpis.return_pct).toBeCloseTo(0.03, 5);
  });
});

// -----------------------------------------------------------------------------
// Regression (14/06): Greek/EU dotted trade dates ("DD.MM HH:mm") must be
// stamped into the month of their owning snapshot, not misread by `new Date()`.
//
// Bug report: with a Feb '26 → Apr '26 range selected, the trades table still
// listed December trades because `new Date("01.12 02:00")` was being parsed as
// 12 Jan 2001 (a valid Date), so the dotted-format branch never ran and the
// trade landed far outside the requested window.
// -----------------------------------------------------------------------------
describe("periodFilter dotted-date regression (DD.MM HH:mm)", () => {
  // A realistic history where every trade.open is the "DD.MM HH:mm" form the
  // app actually stores (no year on the trade — the year lives on the snapshot).
  const history = [
    snap("2025-12", "2025", [
      baseTrade({ idx: 1, open: "01.12 02:00", symbol: "AUDNZD", pnl: 100 }),
      baseTrade({ idx: 2, open: "15.12 02:00", symbol: "GBPJPY", pnl: -50 }),
    ]),
    snap("2026-02", "2026", [
      baseTrade({ idx: 3, open: "03.02 09:00", symbol: "EURUSD", pnl: 200 }),
      baseTrade({ idx: 4, open: "20.02 14:30", symbol: "USDJPY", pnl: -80 }),
    ]),
    snap("2026-03", "2026", [
      baseTrade({ idx: 5, open: "10.03 11:00", symbol: "GBPUSD", pnl: 150 }),
    ]),
    snap("2026-04", "2026", [
      baseTrade({ idx: 6, open: "05.04 08:00", symbol: "XAUUSD", pnl: 300 }),
    ]),
  ];

  it("stamps each dotted-date trade into its snapshot's month/year", () => {
    const stamped = flattenHistoryTrades(history);
    const byIdx = Object.fromEntries(stamped.map(t => [t.idx, new Date(t.timestamp)]));
    // December trade stays in Dec 2025 (not Jan 2001).
    expect(byIdx[1].getFullYear()).toBe(2025);
    expect(byIdx[1].getMonth()).toBe(11); // December
    // February trades stay in Feb 2026.
    expect(byIdx[3].getFullYear()).toBe(2026);
    expect(byIdx[3].getMonth()).toBe(1); // February
    // April trade stays in Apr 2026.
    expect(byIdx[6].getMonth()).toBe(3); // April
  });

  it("a Feb→Apr range excludes December trades from the table", () => {
    const view = computePeriodView(
      history,
      {
        preset: "custom",
        from: new Date(2026, 1, 1, 0, 0, 0), // 1 Feb 2026 (local)
        to: new Date(2026, 3, 30, 23, 59, 59, 999), // 30 Apr 2026 (local)
      },
      1000,
    );
    // Only Feb/Mar/Apr trades (idx 3,4,5,6) — never the December ones (1,2).
    expect(view.trades.map(t => t.idx).sort((a, b) => a - b)).toEqual([3, 4, 5, 6]);
    expect(view.kpis.total_trades).toBe(4);
    // Net = 200 - 80 + 150 + 300 = 570
    expect(view.kpis.net_result).toBe(570);
  });

  it("the table list (trades) for the range starts at the earliest in-range month", () => {
    const view = computePeriodView(
      history,
      {
        preset: "custom",
        from: new Date(2026, 1, 1, 0, 0, 0),
        to: new Date(2026, 3, 30, 23, 59, 59, 999),
      },
      1000,
    );
    // Sorted ascending by timestamp → first row is the February trade.
    expect(view.trades[0].idx).toBe(3);
    expect(new Date(view.trades[0].timestamp).getMonth()).toBe(1); // February
  });

  it("still parses true ISO open strings correctly (no regression)", () => {
    const isoHistory = [
      snap("2026-04", "2026", [
        baseTrade({ idx: 10, open: "2026-04-12T09:00:00.000Z" }),
      ]),
    ];
    const stamped = flattenHistoryTrades(isoHistory);
    expect(new Date(stamped[0].timestamp).getUTCFullYear()).toBe(2026);
    expect(new Date(stamped[0].timestamp).getUTCMonth()).toBe(3); // April
  });
});
