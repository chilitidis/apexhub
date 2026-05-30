import { describe, expect, it } from "vitest";
import { mapDealsToTrades, tradeSignature, type MetaApiDeal } from "./_core/mt5Mapper";

const inDeal = (over: Partial<MetaApiDeal>): MetaApiDeal => ({
  id: "1",
  type: "DEAL_TYPE_BUY",
  entryType: "DEAL_ENTRY_IN",
  positionId: "p1",
  symbol: "EURUSD",
  volume: 1,
  price: 1.1,
  profit: 0,
  swap: 0,
  commission: 0,
  time: "2026-04-01T10:00:00Z",
  ...over,
});

const outDeal = (over: Partial<MetaApiDeal>): MetaApiDeal => ({
  id: "2",
  type: "DEAL_TYPE_SELL",
  entryType: "DEAL_ENTRY_OUT",
  positionId: "p1",
  symbol: "EURUSD",
  volume: 1,
  price: 1.105,
  profit: 50,
  swap: 0,
  commission: -2,
  time: "2026-04-01T11:00:00Z",
  ...over,
});

describe("mapDealsToTrades", () => {
  it("collapses an IN+OUT pair into a single closed trade", () => {
    const trades = mapDealsToTrades([
      inDeal({ price: 1.1, commission: -3 }),
      outDeal({ price: 1.105, profit: 50, commission: -2 }),
    ]);
    expect(trades).toHaveLength(1);
    const t = trades[0];
    expect(t.symbol).toBe("EURUSD");
    expect(t.direction).toBe("BUY");
    expect(t.entry).toBeCloseTo(1.1, 5);
    expect(t.close).toBeCloseTo(1.105, 5);
    expect(t.pnl).toBe(50);
    expect(t.commission).toBe(-5);
    expect(t.status).toBe("closed");
    expect(t.open).toContain("2026-04-01T10:00:00");
    expect(t.close_time).toContain("2026-04-01T11:00:00");
  });

  it("emits open trades when no DEAL_ENTRY_OUT is present", () => {
    const trades = mapDealsToTrades([inDeal({ positionId: "p2" })]);
    expect(trades).toHaveLength(1);
    expect(trades[0].status).toBe("open");
    expect(trades[0].close).toBe(0);
    expect(trades[0].close_time).toBe("");
  });

  it("uses volume-weighted average for partial closes", () => {
    const trades = mapDealsToTrades([
      inDeal({ volume: 2, price: 1.0 }),
      outDeal({ id: "x1", volume: 1, price: 1.10, profit: 100 }),
      outDeal({ id: "x2", volume: 1, price: 1.20, profit: 200, time: "2026-04-01T11:30:00Z" }),
    ]);
    expect(trades).toHaveLength(1);
    expect(trades[0].close).toBeCloseTo(1.15, 5);
    expect(trades[0].pnl).toBe(300);
  });

  it("ignores DEAL_TYPE_BALANCE rows (deposits/withdrawals)", () => {
    const trades = mapDealsToTrades([
      inDeal({}),
      outDeal({}),
      {
        id: "9",
        type: "DEAL_TYPE_BALANCE",
        entryType: undefined,
        positionId: "p1",
        profit: 1000,
        time: "2026-04-01T12:00:00Z",
      },
    ]);
    expect(trades).toHaveLength(1);
    expect(trades[0].pnl).toBe(50); // balance row excluded
  });

  it("returns SELL direction when IN deal is DEAL_TYPE_SELL", () => {
    const trades = mapDealsToTrades([
      inDeal({ type: "DEAL_TYPE_SELL", price: 1.2 }),
      outDeal({ type: "DEAL_TYPE_BUY", price: 1.18, profit: 200 }),
    ]);
    expect(trades).toHaveLength(1);
    expect(trades[0].direction).toBe("SELL");
  });

  it("orders results by open time descending (newest first)", () => {
    const trades = mapDealsToTrades([
      inDeal({ positionId: "older", time: "2026-03-01T10:00:00Z" }),
      outDeal({ positionId: "older", time: "2026-03-01T11:00:00Z" }),
      inDeal({ id: "10", positionId: "newer", time: "2026-04-15T10:00:00Z" }),
      outDeal({ id: "11", positionId: "newer", time: "2026-04-15T11:00:00Z" }),
    ]);
    expect(trades.map((t) => t.positionId)).toEqual(["newer", "older"]);
  });
});

describe("tradeSignature", () => {
  it("produces the same signature for round-trip identical trades", () => {
    const sig1 = tradeSignature({
      symbol: "EURUSD", direction: "BUY", lots: 1.0, entry: 1.1234, open: "2026-04-01T10:00:00.000Z",
    });
    const sig2 = tradeSignature({
      symbol: "eurusd", direction: "buy", lots: 1.0, entry: 1.1234, open: "2026-04-01T10:00:00Z",
    });
    expect(sig1).toBe(sig2);
  });

  it("differentiates trades with different entry prices", () => {
    const a = tradeSignature({ symbol: "X", direction: "BUY", lots: 1, entry: 1.1, open: "2026-04-01" });
    const b = tradeSignature({ symbol: "X", direction: "BUY", lots: 1, entry: 1.2, open: "2026-04-01" });
    expect(a).not.toBe(b);
  });
});
