import { describe, it, expect } from "vitest";
import {
  analyzePatterns,
  classifyInstrument,
  tradeWeekday,
  tradeSetup,
  tradeEmotion,
} from "./patternAnalysis";
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
    pre_checklist: partial.pre_checklist,
    notes: partial.notes ?? null,
    lessons_learned: partial.lessons_learned,
    status: partial.status ?? "closed",
  };
}

describe("classifyInstrument", () => {
  it("detects forex pairs", () => {
    expect(classifyInstrument("EURUSD")).toBe("Forex");
    expect(classifyInstrument("GBPJPY")).toBe("Forex");
    expect(classifyInstrument("EUR/USD")).toBe("Forex");
  });
  it("detects indices", () => {
    expect(classifyInstrument("US30")).toBe("Indices");
    expect(classifyInstrument("NAS100")).toBe("Indices");
    expect(classifyInstrument("GER40")).toBe("Indices");
  });
  it("detects metals and crypto", () => {
    expect(classifyInstrument("XAUUSD")).toBe("Metals");
    expect(classifyInstrument("BTCUSD")).toBe("Crypto");
  });
});

describe("tradeWeekday", () => {
  it("uses the explicit Greek day field", () => {
    expect(tradeWeekday(mk({ day: "ΤΕΤΑΡΤΗ" }))).toBe("Τετάρτη");
    expect(tradeWeekday(mk({ day: "Τρίτη" }))).toBe("Τρίτη");
  });
  it("falls back to timestamp", () => {
    // 2026-06-03 is a Wednesday.
    expect(tradeWeekday(mk({ day: "", open: "2026-06-03T10:00:00Z" }))).toBe(
      "Τετάρτη",
    );
  });
});

describe("tradeSetup / tradeEmotion", () => {
  it("extracts setup keywords", () => {
    expect(tradeSetup(mk({ notes: "clean breakout above resistance" }))).toBe(
      "Breakout",
    );
    expect(tradeSetup(mk({ pre_checklist: "waited for retest" }))).toBe("Retest");
    expect(tradeSetup(mk({}))).toBe("Not specified");
  });
  it("extracts emotion keywords", () => {
    expect(tradeEmotion(mk({ psychology: "felt very calm and patient" }))).toBe(
      "Calm",
    );
    expect(tradeEmotion(mk({ psychology: "ήμουν αγχωμένος" }))).toBe("Anxious");
    expect(tradeEmotion(mk({}))).toBe("Not specified");
  });
});

describe("analyzePatterns", () => {
  const trades: Trade[] = [
    mk({ idx: 1, day: "ΤΕΤΑΡΤΗ", symbol: "EURUSD", pnl: 2000, open: "2026-06-03T09:00:00Z" }),
    mk({ idx: 2, day: "ΤΕΤΑΡΤΗ", symbol: "GBPUSD", pnl: 1500, open: "2026-06-03T10:00:00Z" }),
    mk({ idx: 3, day: "ΤΕΤΑΡΤΗ", symbol: "EURUSD", pnl: -500, open: "2026-06-03T11:00:00Z" }),
    mk({ idx: 4, day: "ΤΕΤΑΡΤΗ", symbol: "USDJPY", pnl: 800, open: "2026-06-03T12:00:00Z" }),
    mk({ idx: 5, day: "ΤΡΙΤΗ", symbol: "US30", pnl: 2310, open: "2026-06-02T14:00:00Z" }),
  ];

  it("computes headline totals", () => {
    const a = analyzePatterns(trades);
    expect(a.closedTrades).toBe(5);
    expect(a.wins).toBe(4);
    expect(a.losses).toBe(1);
    expect(a.winRate).toBeCloseTo(0.8, 5);
    expect(a.totalPnl).toBeCloseTo(6110, 2);
  });

  it("groups by day and finds best day", () => {
    const a = analyzePatterns(trades);
    const wed = a.byDay.find((d) => d.key === "Τετάρτη");
    expect(wed?.trades).toBe(4);
    expect(wed?.wins).toBe(3);
    expect(a.bestDay?.key).toBe("Τετάρτη");
  });

  it("groups by instrument", () => {
    const a = analyzePatterns(trades);
    const forex = a.byInstrument.find((i) => i.key === "Forex");
    const indices = a.byInstrument.find((i) => i.key === "Indices");
    expect(forex?.trades).toBe(4);
    expect(indices?.trades).toBe(1);
    expect(indices?.win_rate).toBe(1);
  });

  it("excludes open trades", () => {
    const withOpen = [...trades, mk({ idx: 6, status: "open", pnl: 0 })];
    const a = analyzePatterns(withOpen);
    expect(a.closedTrades).toBe(5);
    expect(a.totalTrades).toBe(6);
  });

  it("produces strengths, weaknesses and an action plan", () => {
    const a = analyzePatterns(trades);
    expect(a.strengths.length).toBeGreaterThan(0);
    expect(a.weaknesses.length).toBeGreaterThan(0);
    expect(a.actionPlan.length).toBeGreaterThan(0);
    expect(a.keyPatterns.length).toBeGreaterThan(0);
  });

  it("handles empty input safely", () => {
    const a = analyzePatterns([]);
    expect(a.closedTrades).toBe(0);
    expect(a.winRate).toBe(0);
    expect(a.bestDay).toBeNull();
  });
});
