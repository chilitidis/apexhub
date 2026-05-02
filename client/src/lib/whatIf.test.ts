import { describe, it, expect } from "vitest";
import { computeR, simulate } from "./whatIf";
import type { Trade } from "./trading";

function makeTrade(partial: Partial<Trade>): Trade {
  return {
    idx: 1,
    day: "ΤΕΤ",
    open: "2026-04-01T10:00:00",
    close_time: "2026-04-01T14:00:00",
    symbol: "US100",
    direction: "BUY",
    lots: 1,
    entry: 100,
    close: 110,
    sl: 90,
    tp: null,
    trade_r: null,
    pnl: 100,
    swap: 0,
    commission: 0,
    net_pct: 0,
    tf: "H1",
    chart_before: "",
    chart_after: "",
    ...partial,
  };
}

describe("computeR", () => {
  it("computes +1R for a BUY winner that hits exact 1R distance", () => {
    const t = makeTrade({ direction: "BUY", entry: 100, sl: 90, close: 110 });
    const r = computeR(t)!;
    expect(r.r).toBeCloseTo(1, 5);
    expect(r.usedFallback).toBe(false);
  });

  it("computes −1R for a SELL trade that closes at the SL distance above entry", () => {
    const t = makeTrade({ direction: "SELL", entry: 100, sl: 90, close: 110 });
    const r = computeR(t)!;
    expect(r.r).toBeCloseTo(-1, 5);
  });

  it("computes +2R for a BUY winner that reached 2× the risk", () => {
    const t = makeTrade({ direction: "BUY", entry: 100, sl: 90, close: 120 });
    const r = computeR(t)!;
    expect(r.r).toBeCloseTo(2, 5);
  });

  it("falls back to +1R when there is no SL but the trade was profitable", () => {
    const t = makeTrade({ sl: 0, pnl: 250, swap: 0, commission: 0 });
    const r = computeR(t)!;
    expect(r.r).toBe(1);
    expect(r.usedFallback).toBe(true);
  });

  it("falls back to −1R when there is no SL and the trade lost money", () => {
    const t = makeTrade({ sl: null, pnl: -300, swap: 0, commission: 0 });
    const r = computeR(t)!;
    expect(r.r).toBe(-1);
    expect(r.usedFallback).toBe(true);
  });

  it("returns null when entry/exit are unusable", () => {
    const t = makeTrade({ entry: NaN as unknown as number });
    const r = computeR(t);
    expect(r).toBeNull();
  });
});

describe("simulate (fixed risk)", () => {
  // 3 BUY trades with usable SL — +1R, −1R, +2R, in time order.
  const trades: Trade[] = [
    // +1R: BUY 100→110, SL 90 (risk=10, gain=10)
    makeTrade({
      idx: 1,
      open: "2026-04-01T10:00:00",
      entry: 100,
      sl: 90,
      close: 110,
      direction: "BUY",
    }),
    // −1R: SELL 200→220, SL 220 (risk=20, move=+20 against SELL = −1R)
    makeTrade({
      idx: 2,
      open: "2026-04-01T11:00:00",
      entry: 200,
      sl: 220,
      close: 220,
      direction: "SELL",
    }),
    // +2R: BUY 50→60, SL 45 (risk=5, gain=10)
    makeTrade({
      idx: 3,
      open: "2026-04-01T12:00:00",
      entry: 50,
      sl: 45,
      close: 60,
      direction: "BUY",
    }),
  ];

  it("on 10.000€ at 5% risk fixed: +1R, −1R, +2R → +1000 net", () => {
    const res = simulate(trades, { capital: 10000, riskPct: 5, compound: false });
    expect(res.finalBalance).toBeCloseTo(11000, 5);
    expect(res.totalPnl).toBeCloseTo(1000, 5);
    expect(res.totalPct).toBeCloseTo(10, 5);
    expect(res.winRate).toBeCloseTo((2 / 3) * 100, 5);
    expect(res.consideredTradesCount).toBe(3);
    expect(res.fallbackTradesCount).toBe(0);
    expect(res.bestTrade).toBeCloseTo(1000, 5);
    expect(res.worstTrade).toBeCloseTo(-500, 5);
  });

  it("scales linearly with capital × risk %", () => {
    const res = simulate(trades, { capital: 1000, riskPct: 1, compound: false });
    // risk_in_money = 10€ → +10 + −10 + +20 = +20
    expect(res.totalPnl).toBeCloseTo(20, 5);
    expect(res.finalBalance).toBeCloseTo(1020, 5);
  });

  it("compound risk produces different result vs fixed risk", () => {
    const fixed = simulate(trades, { capital: 10000, riskPct: 10, compound: false });
    const compound = simulate(trades, { capital: 10000, riskPct: 10, compound: true });
    expect(compound.finalBalance).not.toEqual(fixed.finalBalance);
    // Sanity bounds: both end up positive (net +2R > 0) but compound diverges.
    expect(fixed.finalBalance).toBeCloseTo(12000, 1);
    expect(compound.finalBalance).toBeGreaterThan(11000);
    expect(compound.finalBalance).toBeLessThan(15000);
  });
});

describe("simulate (mixed: real R + fallback)", () => {
  it("counts fallback trades and still uses ±1R for them", () => {
    const trades: Trade[] = [
      makeTrade({ idx: 1, entry: 100, sl: 95, close: 105, direction: "BUY" }), // +1R real
      makeTrade({ idx: 2, sl: 0, pnl: -150, direction: "BUY" }), // fallback −1R
    ];
    const res = simulate(trades, { capital: 10000, riskPct: 5, compound: false });
    expect(res.fallbackTradesCount).toBe(1);
    expect(res.totalPnl).toBeCloseTo(0, 5); // +500 then −500
    expect(res.consideredTradesCount).toBe(2);
  });
});

describe("simulate edge cases", () => {
  it("handles an empty trade list with zero P/L", () => {
    const res = simulate([], { capital: 10000, riskPct: 5, compound: false });
    expect(res.finalBalance).toBe(10000);
    expect(res.totalPnl).toBe(0);
    expect(res.equity).toEqual([10000]);
    expect(res.consideredTradesCount).toBe(0);
  });

  it("computes max drawdown across the equity walk", () => {
    const trades: Trade[] = [
      makeTrade({ idx: 1, entry: 100, sl: 90, close: 110 }), // +1R
      makeTrade({ idx: 2, entry: 100, sl: 90, close: 70, direction: "BUY" }), // −3R
    ];
    const res = simulate(trades, { capital: 10000, riskPct: 10, compound: false });
    // Path: 10000 → 11000 → 8000.  peak=11000, trough=8000 → DD 3000.
    expect(res.maxDrawdown).toBeCloseTo(3000, 1);
    expect(res.maxDrawdownPct).toBeCloseTo((3000 / 11000) * 100, 1);
  });
});
