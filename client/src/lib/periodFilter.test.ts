import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { resolveRange, filterTradesByRange, applyPeriodFilter } from "./periodFilter";
import type { Trade, TradingData } from "./trading";

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
  balance_before: 0,
  balance_after: 10,
  ...overrides,
});

describe("periodFilter.resolveRange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns open range for 'all'", () => {
    const r = resolveRange("all");
    expect(r).toEqual({ preset: "all", from: null, to: null });
  });

  it("returns start of month for 'this-month'", () => {
    const r = resolveRange("this-month");
    expect(r.from?.getDate()).toBe(1);
    expect(r.from?.getMonth()).toBe(FIXED_NOW.getMonth());
    expect(r.to).not.toBeNull();
  });

  it.each(["30d", "60d", "90d"] as const)("returns a rolling window for '%s'", (preset) => {
    const r = resolveRange(preset);
    expect(r.from).not.toBeNull();
    expect(r.to).not.toBeNull();
    const days = (r.to!.getTime() - r.from!.getTime()) / 86_400_000;
    const expectedDays = Number(preset.replace("d", ""));
    // startOfDay(now - N) → endOfDay(now) spans about N or N+1 calendar boundaries.
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

describe("periodFilter.filterTradesByRange", () => {
  const trades: Trade[] = [
    baseTrade({ idx: 1, open: "2026-04-01T09:00:00.000Z" }),
    baseTrade({ idx: 2, open: "2026-04-15T09:00:00.000Z" }),
    baseTrade({ idx: 3, open: "2026-03-20T09:00:00.000Z" }),
  ];

  it("returns the original array for 'all'", () => {
    const out = filterTradesByRange(trades, { preset: "all", from: null, to: null }, 2026);
    expect(out).toHaveLength(3);
  });

  it("keeps only trades within the given window", () => {
    const from = new Date("2026-04-01T00:00:00.000Z");
    const to = new Date("2026-04-30T23:59:59.999Z");
    const out = filterTradesByRange(trades, { preset: "custom", from, to }, 2026);
    expect(out.map(t => t.idx).sort()).toEqual([1, 2]);
  });

  it("keeps trades whose date cannot be parsed (safety)", () => {
    const out = filterTradesByRange(
      [baseTrade({ idx: 99, open: "totally-not-a-date" })],
      { preset: "custom", from: new Date(0), to: new Date(1) },
      2026,
    );
    expect(out).toHaveLength(1);
  });
});

describe("periodFilter.applyPeriodFilter", () => {
  const data: TradingData = {
    trades: [
      baseTrade({ idx: 1, open: "2026-04-05T09:00:00.000Z", pnl: 100, balance_after: 100 }),
      baseTrade({ idx: 2, open: "2026-04-15T09:00:00.000Z", pnl: -40, balance_after: 60 }),
      baseTrade({ idx: 3, open: "2026-03-20T09:00:00.000Z", pnl: 20, balance_after: 20 }),
    ],
    kpis: {
      starting: 1000,
      ending: 1080,
      net_result: 80,
      return_pct: 0.08,
      total_trades: 3,
      wins: 2,
      losses: 1,
      win_rate: 2 / 3,
      profit_factor: 0,
      avg_win: 0,
      avg_loss: 0,
      max_drawdown_pct: 0,
      max_win_streak: 0,
      max_loss_streak: 0,
      best_trade: { idx: 1, pnl: 100, symbol: "EURUSD" },
      worst_trade: { idx: 2, pnl: -40, symbol: "EURUSD" },
      avg_r: 0,
      total_r: 0,
    },
    symbols: [],
    meta: {
      month_name: "ΑΠΡΙΛΙΟΣ",
      year_full: "2026",
      year_short: "26",
      subtitle: "",
      last_sync: "",
    },
  };

  it("returns the original object when preset is 'all'", () => {
    const out = applyPeriodFilter(data, { preset: "all", from: null, to: null }, 2026);
    expect(out).toBe(data);
  });

  it("restricts KPIs to the filtered slice but preserves month metadata", () => {
    const from = new Date("2026-04-01T00:00:00.000Z");
    const to = new Date("2026-04-30T23:59:59.999Z");
    const out = applyPeriodFilter(data, { preset: "custom", from, to }, 2026);
    expect(out.trades).toHaveLength(2);
    expect(out.kpis.starting).toBe(1000);
    expect(out.meta.month_name).toBe("ΑΠΡΙΛΙΟΣ");
  });
});
