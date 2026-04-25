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
