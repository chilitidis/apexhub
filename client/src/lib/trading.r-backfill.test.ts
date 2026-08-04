/**
 * R-multiple back-fill regression
 *
 * Trades that arrive without `trade_r` (most imports / OCR / manual entries)
 * but DO have an SL should have R derived from price geometry:
 *     R = sign(pnl) * |close - entry| / |entry - sl|
 *
 * Trades without an SL must remain `null` so the table shows "—" rather
 * than a misleading number.
 */
import { describe, it, expect } from "vitest";
import { computeKPIs } from "./trading";
import type { Trade } from "./trading";

function baseTrade(overrides: Partial<Trade>): Trade {
  return {
    idx: 1,
    day: "MON",
    open: "2026-04-28T05:09:22",
    close_time: "2026-04-28T13:25:48",
    symbol: "US100",
    direction: "SELL",
    lots: 0.4,
    entry: 27265.12,
    close: 27030.27,
    sl: null,
    tp: null,
    trade_r: null,
    pnl: 9394,
    swap: 0,
    commission: 0,
    net_pct: 0,
    tf: "H1",
    chart_before: "",
    chart_after: "",
    ...overrides,
  };
}

describe("R-multiple back-fill", () => {
  it("derives R from entry/close/sl when trade_r is missing (winner)", () => {
    const trades = [
      baseTrade({
        sl: 27400.0, // risk = 134.88 above entry (SELL), reward = 234.85 below entry
        // expected R = +234.85 / 134.88 ≈ +1.74
        pnl: 9394,
      }),
    ];
    const data = computeKPIs(trades, 10_000);
    expect(data.trades[0].trade_r).toBeCloseTo(1.74, 1);
  });

  it("derives a NEGATIVE R when pnl is negative", () => {
    const trades = [
      baseTrade({
        entry: 1.1,
        close: 1.09, // 100 pips against
        sl: 1.105, // 50 pip risk
        pnl: -100,
      }),
    ];
    const data = computeKPIs(trades, 10_000);
    expect(data.trades[0].trade_r).toBeCloseTo(-2, 1);
  });

  it("leaves trade_r null when SL is missing", () => {
    const trades = [baseTrade({ sl: null })];
    const data = computeKPIs(trades, 10_000);
    expect(data.trades[0].trade_r).toBeNull();
  });

  it("respects an existing trade_r value (does not overwrite)", () => {
    const trades = [
      baseTrade({ sl: 27400, trade_r: 0.5, pnl: 9394 }),
    ];
    const data = computeKPIs(trades, 10_000);
    expect(data.trades[0].trade_r).toBe(0.5);
  });

  it("aggregates total_r and avg_r over back-filled values", () => {
    const trades = [
      baseTrade({ idx: 1, sl: 27400, pnl: 9394 }), // ~+1.74R
      baseTrade({ idx: 2, sl: null, pnl: 100 }), // unchanged → null, ignored
      baseTrade({ idx: 3, entry: 100, close: 95, sl: 102.5, pnl: -50 }), // ~-2R
    ];
    const data = computeKPIs(trades, 10_000);
    expect(data.kpis.total_r).toBeCloseTo(-0.26, 1);
    expect(data.kpis.avg_r).toBeCloseTo(-0.13, 1);
  });
});

describe("R-multiple sign-consistency guard", () => {
  it("flips a stored positive R to negative when the realised result is a loss", () => {
    const trades = [
      baseTrade({
        trade_r: 1.37, // imported as unsigned magnitude
        pnl: -1000,
        swap: 0,
      }),
    ];
    const data = computeKPIs(trades, 10_000);
    expect(data.trades[0].trade_r).toBeCloseTo(-1.37, 2);
  });

  it("flips a stored negative R to positive when the realised result is a win", () => {
    const trades = [
      baseTrade({
        trade_r: -0.8,
        pnl: 500,
        swap: 0,
      }),
    ];
    const data = computeKPIs(trades, 10_000);
    expect(data.trades[0].trade_r).toBeCloseTo(0.8, 2);
  });

  it("uses pnl + swap for the sign (swap can turn a small win into a loss)", () => {
    const trades = [
      baseTrade({
        trade_r: 0.17,
        pnl: 10,
        swap: -50,
      }),
    ];
    const data = computeKPIs(trades, 10_000);
    expect(data.trades[0].trade_r).toBeCloseTo(-0.17, 2);
  });

  it("leaves open trades untouched", () => {
    const trades = [
      baseTrade({
        status: "open",
        trade_r: 1.0,
        pnl: -100,
      } as any),
    ];
    const data = computeKPIs(trades, 10_000);
    expect(data.trades[0].trade_r).toBe(1.0);
  });
});
