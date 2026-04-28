import { describe, expect, it } from "vitest";

import type { Trade } from "@/lib/trading";

import { pickTopTrades } from "./ShareCardDialog";

/** Minimal factory so tests stay focused on the ranking logic. */
function t(partial: Partial<Trade>): Trade {
  return {
    idx: 0,
    symbol: "XAUUSD",
    direction: "BUY",
    lots: 1,
    entry: 0,
    close: 0,
    sl: null,
    tp: null,
    trade_r: null,
    pnl: 0,
    swap: 0,
    commission: 0,
    net_pct: 0,
    tf: "",
    chart_before: "",
    chart_after: "",
    open: "",
    close_time: "",
    day: "",
    psychology: "",
    notes: "",
    lessons_learned: "",
    pre_checklist: "",
    ...partial,
  } as Trade;
}

describe("pickTopTrades", () => {
  it("returns at most 6 trades, sorted by absolute P/L magnitude", () => {
    const trades: Trade[] = [
      t({ idx: 1, pnl: 100 }),
      t({ idx: 2, pnl: -900 }), // biggest magnitude
      t({ idx: 3, pnl: 50 }),
      t({ idx: 4, pnl: 800 }), // 2nd
      t({ idx: 5, pnl: -20 }),
      t({ idx: 6, pnl: 400 }),
      t({ idx: 7, pnl: -500 }),
      t({ idx: 8, pnl: 10 }),
    ];
    const top = pickTopTrades(trades);
    expect(top).toHaveLength(6);
    // Biggest magnitude first, in descending |pnl| order
    const mags = top.map((x) => Math.abs(x.pnl));
    expect(mags).toEqual([...mags].sort((a, b) => b - a));
    // Smallest magnitudes (50, 20, 10) should be excluded.
    expect(top.find((x) => x.idx === 5)).toBeUndefined();
    expect(top.find((x) => x.idx === 8)).toBeUndefined();
  });

  it("handles empty input", () => {
    expect(pickTopTrades([])).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const trades = [t({ idx: 1, pnl: 10 }), t({ idx: 2, pnl: -20 })];
    const before = trades.map((x) => x.idx);
    pickTopTrades(trades);
    expect(trades.map((x) => x.idx)).toEqual(before);
  });
});
