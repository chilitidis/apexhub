// openTrade.test.ts — guards the open-trade lifecycle invariants.
//
// Open trades MUST be visible in the trade list (so the user can manage them
// and capture psychology pre-close), but MUST NOT contribute to win-rate,
// total trades, P/L or running balance. They expose `open_trades` as a count.

import { describe, it, expect } from "vitest";
import { computeKPIs, type Trade } from "./trading";

const baseTrade = (overrides: Partial<Trade>): Trade => ({
  idx: 1,
  day: "Mon",
  open: "2026-04-01T10:00:00.000Z",
  close_time: "2026-04-01T11:00:00.000Z",
  symbol: "EURUSD",
  direction: "BUY",
  lots: 1,
  entry: 1.08,
  close: 1.09,
  sl: 1.07,
  tp: 1.10,
  trade_r: 1,
  pnl: 100,
  swap: 0,
  commission: 0,
  net_pct: 0.001,
  tf: "H1",
  chart_before: "",
  chart_after: "",
  status: "closed",
  ...overrides,
});

describe("computeKPIs — open trade lifecycle", () => {
  it("excludes open trades from win-rate, total_trades and P/L", () => {
    const trades: Trade[] = [
      baseTrade({ idx: 1, pnl: 100, status: "closed" }),
      baseTrade({ idx: 2, pnl: -50, status: "closed" }),
      // Open trade with zero P/L placeholder must NOT skew win rate
      baseTrade({ idx: 3, pnl: 0, status: "open" }),
    ];
    const result = computeKPIs(trades, 100_000);
    expect(result.kpis.total_trades).toBe(2);
    expect(result.kpis.open_trades).toBe(1);
    expect(result.kpis.wins).toBe(1);
    expect(result.kpis.losses).toBe(1);
    expect(result.kpis.win_rate).toBeCloseTo(0.5, 5);
    // ending should reflect closed trades only (100 + -50 = 50 above starting)
    expect(result.kpis.ending).toBeCloseTo(100_050, 2);
  });

  it("keeps open trades in the trades list so the UI can render them", () => {
    const trades: Trade[] = [
      baseTrade({ idx: 1, pnl: 100, status: "closed" }),
      baseTrade({ idx: 2, pnl: 0, status: "open" }),
    ];
    const result = computeKPIs(trades, 100_000);
    expect(result.trades).toHaveLength(2);
    expect(result.trades.find(t => t.idx === 2)?.status).toBe("open");
  });

  it("treats trades with no status field as closed (legacy data)", () => {
    const trades: Trade[] = [
      baseTrade({ idx: 1, pnl: 200, status: undefined as any }),
    ];
    const result = computeKPIs(trades, 100_000);
    expect(result.kpis.total_trades).toBe(1);
    expect(result.kpis.open_trades).toBe(0);
    expect(result.kpis.ending).toBeCloseTo(100_200, 2);
  });
});
