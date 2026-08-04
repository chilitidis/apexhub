import { describe, it, expect } from "vitest";
import {
  buildCoachContext,
  topSymbolsByTradeCount,
  isoWeekKey,
  tradesInLastDays,
} from "./coachContext";
import type { Trade } from "./trading";

function mk(partial: Partial<Trade>): Trade {
  return {
    idx: partial.idx ?? 0,
    day: partial.day ?? "",
    open: partial.open ?? "",
    close_time: partial.close_time ?? "",
    symbol: partial.symbol ?? "EURUSD",
    direction: partial.direction ?? "BUY",
    lots: partial.lots ?? 1,
    entry: partial.entry ?? 1,
    close: partial.close ?? 1,
    sl: partial.sl ?? null,
    tp: partial.tp ?? null,
    trade_r: partial.trade_r ?? null,
    pnl: partial.pnl ?? 0,
    swap: partial.swap ?? 0,
    commission: partial.commission ?? 0,
    net_pct: partial.net_pct ?? 0,
    tf: partial.tf ?? "",
    chart_before: partial.chart_before ?? "",
    chart_after: partial.chart_after ?? "",
    psychology: partial.psychology,
    emotion: partial.emotion,
    status: partial.status ?? "closed",
  };
}

describe("buildCoachContext", () => {
  it("returns undefined when there are no closed trades", () => {
    expect(buildCoachContext([])).toBeUndefined();
    expect(buildCoachContext([mk({ status: "open" })])).toBeUndefined();
    expect(buildCoachContext(undefined)).toBeUndefined();
  });

  it("computes stats and recent trades from closed trades", () => {
    const ctx = buildCoachContext([
      mk({ symbol: "EURUSD", pnl: 100, open: "2026-06-01T09:00:00Z", emotion: "Calm" }),
      mk({ symbol: "XAUUSD", pnl: -50, open: "2026-06-02T09:00:00Z", direction: "SELL" }),
      mk({ symbol: "EURUSD", pnl: 30, open: "2026-06-03T09:00:00Z" }),
      mk({ symbol: "GBPUSD", status: "open" }), // must be ignored
    ]);
    expect(ctx).toBeDefined();
    expect(ctx!.stats!.trades).toBe(3);
    expect(ctx!.stats!.totalPnl).toBe(80);
    expect(ctx!.stats!.winRatePct).toBeCloseTo(66.67, 1);
    expect(ctx!.stats!.topSymbolsByPnl![0].symbol).toBe("EURUSD");
    expect(ctx!.recentTrades).toHaveLength(3);
    // Most recent first.
    expect(ctx!.recentTrades![0].symbol).toBe("EURUSD");
    expect(ctx!.stats!.byEmotion!.some((e) => e.key === "Calm")).toBe(true);
  });

  it("caps recentTrades at 20", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      mk({ idx: i, pnl: i, open: `2026-06-${String((i % 27) + 1).padStart(2, "0")}T09:00:00Z` }),
    );
    const ctx = buildCoachContext(many);
    expect(ctx!.recentTrades).toHaveLength(20);
  });
});

describe("topSymbolsByTradeCount", () => {
  it("orders by trade count and caps the list", () => {
    const trades = [
      mk({ symbol: "EURUSD" }),
      mk({ symbol: "EURUSD" }),
      mk({ symbol: "XAUUSD" }),
      mk({ symbol: "xauusd" }),
      mk({ symbol: "XAUUSD" }),
      mk({ symbol: "GBPJPY" }),
    ];
    expect(topSymbolsByTradeCount(trades, 2)).toEqual(["XAUUSD", "EURUSD"]);
    expect(topSymbolsByTradeCount([], 8)).toEqual([]);
  });
});

describe("isoWeekKey", () => {
  it("computes ISO-8601 week keys", () => {
    expect(isoWeekKey(new Date(2026, 7, 4))).toBe("2026-W32"); // Tue 4 Aug 2026
    expect(isoWeekKey(new Date(2026, 0, 1))).toBe("2026-W01"); // Thu 1 Jan 2026
    expect(isoWeekKey(new Date(2027, 0, 1))).toBe("2026-W53"); // Fri 1 Jan 2027 → ISO week 53 of 2026
  });
});

describe("tradesInLastDays", () => {
  it("keeps only closed trades within the window", () => {
    const now = new Date("2026-08-04T12:00:00Z");
    const trades = [
      mk({ idx: 1, close_time: "2026-08-03T10:00:00Z" }),
      mk({ idx: 2, close_time: "2026-07-20T10:00:00Z" }), // too old
      mk({ idx: 3, close_time: "2026-08-02T10:00:00Z", status: "open" }), // open
    ];
    const recent = tradesInLastDays(trades, 7, now);
    expect(recent.map((t) => t.idx)).toEqual([1]);
  });
});
