import { describe, it, expect } from "vitest";
import {
  coachContextSchema,
  serializeCoachContext,
  buildTraderDataBlock,
  COACH_CONTEXT_CHAR_CAP,
  type CoachContext,
} from "./coachContext";

function bigContext(): CoachContext {
  return {
    stats: {
      trades: 120,
      winRatePct: 57.5,
      totalPnl: 4321.12,
      avgR: 0.42,
      bestDay: { key: "Τετάρτη", trades: 30, pnl: 5000 },
      worstDay: { key: "Παρασκευή", trades: 12, pnl: -2200 },
      topSymbolsByPnl: Array.from({ length: 5 }, (_, i) => ({
        symbol: `SYMBOL${i}USD`,
        trades: 20,
        pnl: 1000 - i,
      })),
      byEmotion: Array.from({ length: 6 }, (_, i) => ({
        key: `Emotion-${i}-long-label`,
        trades: 10,
        winRatePct: 50,
        pnl: 100,
      })),
    },
    recentTrades: Array.from({ length: 20 }, (_, i) => ({
      symbol: "EURUSD",
      dir: (i % 2 === 0 ? "BUY" : "SELL") as "BUY" | "SELL",
      r: 1.2345,
      net: -123.45,
      day: "Δευτέρα",
      emotion: "Confident",
    })),
  };
}

describe("coachContextSchema", () => {
  it("accepts a full valid context", () => {
    expect(coachContextSchema.safeParse(bigContext()).success).toBe(true);
  });

  it("accepts an empty object (everything optional)", () => {
    expect(coachContextSchema.safeParse({}).success).toBe(true);
  });

  it("rejects oversized recentTrades arrays", () => {
    const ctx = bigContext();
    ctx.recentTrades = Array.from({ length: 21 }, () => ({
      symbol: "EURUSD",
      dir: "BUY" as const,
      net: 1,
    }));
    expect(coachContextSchema.safeParse(ctx).success).toBe(false);
  });

  it("rejects more than 5 top symbols / 6 emotions", () => {
    const ctx = bigContext();
    ctx.stats!.topSymbolsByPnl = Array.from({ length: 6 }, () => ({
      symbol: "EURUSD",
      trades: 1,
      pnl: 1,
    }));
    expect(coachContextSchema.safeParse(ctx).success).toBe(false);
  });
});

describe("serializeCoachContext", () => {
  it("stays under the char cap by truncating recentTrades first", () => {
    const json = serializeCoachContext(bigContext());
    expect(json.length).toBeLessThanOrEqual(COACH_CONTEXT_CHAR_CAP);
    const parsed = JSON.parse(json);
    // Stats survive; recent trades were the truncation target.
    expect(parsed.stats.trades).toBe(120);
    expect((parsed.recentTrades ?? []).length).toBeLessThanOrEqual(20);
  });

  it("keeps small contexts intact", () => {
    const ctx: CoachContext = {
      stats: { trades: 3, winRatePct: 66.7 },
      recentTrades: [{ symbol: "EURUSD", dir: "BUY", net: 50 }],
    };
    const parsed = JSON.parse(serializeCoachContext(ctx));
    expect(parsed.recentTrades).toHaveLength(1);
  });
});

describe("buildTraderDataBlock", () => {
  it("mentions the trader data and forbids invented numbers (en)", () => {
    const block = buildTraderDataBlock(bigContext(), "en");
    expect(block).toContain("TRADER DATA");
    expect(block).toContain("NEVER invent numbers");
    expect(block).toContain("Mention briefly");
    expect(block.length).toBeLessThan(COACH_CONTEXT_CHAR_CAP + 1000);
  });

  it("produces the Greek variant by default", () => {
    const block = buildTraderDataBlock({ stats: { trades: 1 } });
    expect(block).toContain("TRADER DATA");
    expect(block).toContain("ΠΟΤΕ");
  });
});
