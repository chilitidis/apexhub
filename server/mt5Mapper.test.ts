import { describe, expect, it } from "vitest";
import {
  dayOfWeekFromIso,
  mapDealsToTrades,
  tradeSignature,
  type MetaApiDeal,
  type MetaApiOrder,
} from "./_core/mt5Mapper";

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

const order = (over: Partial<MetaApiOrder>): MetaApiOrder => ({
  id: "o1",
  type: "ORDER_TYPE_BUY",
  state: "ORDER_STATE_FILLED",
  positionId: "p1",
  symbol: "EURUSD",
  stopLoss: 1.095,
  takeProfit: 1.12,
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
    expect(trades[0].net_pct).toBe(0);
    expect(trades[0].trade_r).toBeNull();
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
    expect(trades[0].pnl).toBe(50);
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

  // ---- New: SL / TP / day / R / net_pct -----------------------------------

  it("pulls stopLoss + takeProfit from the matching history order", () => {
    const trades = mapDealsToTrades(
      [inDeal({}), outDeal({})],
      [order({ stopLoss: 1.095, takeProfit: 1.12 })],
    );
    expect(trades[0].sl).toBeCloseTo(1.095, 5);
    expect(trades[0].tp).toBeCloseTo(1.12, 5);
  });

  it("leaves sl/tp null when no order is supplied or the values are 0", () => {
    const trades = mapDealsToTrades([inDeal({}), outDeal({})], []);
    expect(trades[0].sl).toBeNull();
    expect(trades[0].tp).toBeNull();

    const zeroed = mapDealsToTrades(
      [inDeal({}), outDeal({})],
      [order({ stopLoss: 0, takeProfit: 0 })],
    );
    expect(zeroed[0].sl).toBeNull();
    expect(zeroed[0].tp).toBeNull();
  });

  it("derives Greek 3-letter day-of-week from the close timestamp", () => {
    // 2026-04-01 is a Wednesday → ΤΕΤ
    const trades = mapDealsToTrades([inDeal({}), outDeal({})]);
    expect(trades[0].day).toBe("ΤΕΤ");
  });

  it("falls back to the open timestamp when the trade is still open", () => {
    // 2026-04-03 is a Friday → ΠΑΡ
    const trades = mapDealsToTrades([
      inDeal({ positionId: "po", time: "2026-04-03T08:00:00Z" }),
    ]);
    expect(trades[0].day).toBe("ΠΑΡ");
  });

  it("computes R-multiple from SL on a winning long trade", () => {
    // entry 1.1, exit 1.105 (+5 pips), SL 1.095 (-5 pips) ⇒ +1R
    const trades = mapDealsToTrades(
      [inDeal({}), outDeal({ price: 1.105, profit: 50 })],
      [order({ stopLoss: 1.095 })],
    );
    expect(trades[0].trade_r).toBeCloseTo(1, 5);
  });

  it("R is negative when the trade lost money", () => {
    // long 1.1 → exit 1.097 with SL 1.095 ⇒ reward ~3, risk 5 ⇒ |R|=0.6, sign -
    const trades = mapDealsToTrades(
      [inDeal({}), outDeal({ price: 1.097, profit: -30 })],
      [order({ stopLoss: 1.095 })],
    );
    expect(trades[0].trade_r).toBeCloseTo(-0.6, 5);
  });

  it("returns null R when there is no SL", () => {
    const trades = mapDealsToTrades([inDeal({}), outDeal({})], []);
    expect(trades[0].trade_r).toBeNull();
  });

  it("computes net_pct as (pnl+swap+commission) / running balance", () => {
    // Two sequential closed trades. Starting balance = 10000.
    //   t1: pnl 100, swap 0, commission -5 → net 95 / 10000 = 0.0095
    //   t2 (later): pnl 200, swap -1, commission -3 → 196 / 10095 ≈ 0.01941
    const trades = mapDealsToTrades(
      [
        inDeal({ positionId: "p1", time: "2026-04-01T10:00:00Z" }),
        outDeal({
          positionId: "p1",
          time: "2026-04-01T11:00:00Z",
          profit: 100,
          swap: 0,
          commission: -5,
        }),
        inDeal({ id: "11", positionId: "p2", time: "2026-04-02T10:00:00Z" }),
        outDeal({
          id: "12",
          positionId: "p2",
          time: "2026-04-02T11:00:00Z",
          profit: 200,
          swap: -1,
          commission: -3,
        }),
      ],
      [],
      10000,
    );
    // Sorted newest-first: p2 first.
    expect(trades[0].positionId).toBe("p2");
    expect(trades[1].positionId).toBe("p1");
    expect(trades[1].net_pct).toBeCloseTo(95 / 10000, 6);
    expect(trades[0].net_pct).toBeCloseTo(196 / 10095, 5);
  });

  it("net_pct is 0 when starting balance is 0", () => {
    const trades = mapDealsToTrades(
      [inDeal({}), outDeal({ profit: 100 })],
      [],
      0,
    );
    expect(trades[0].net_pct).toBe(0);
  });
});

describe("dayOfWeekFromIso", () => {
  it("maps each weekday to the right Greek 3-letter label", () => {
    // 2026-03-29 Sunday … 2026-04-04 Saturday
    expect(dayOfWeekFromIso("2026-03-29T12:00:00Z")).toBe("ΚΥΡ");
    expect(dayOfWeekFromIso("2026-03-30T12:00:00Z")).toBe("ΔΕΥ");
    expect(dayOfWeekFromIso("2026-03-31T12:00:00Z")).toBe("ΤΡΙ");
    expect(dayOfWeekFromIso("2026-04-01T12:00:00Z")).toBe("ΤΕΤ");
    expect(dayOfWeekFromIso("2026-04-02T12:00:00Z")).toBe("ΠΕΜ");
    expect(dayOfWeekFromIso("2026-04-03T12:00:00Z")).toBe("ΠΑΡ");
    expect(dayOfWeekFromIso("2026-04-04T12:00:00Z")).toBe("ΣΑΒ");
  });

  it("returns empty string for falsy or unparseable input", () => {
    expect(dayOfWeekFromIso("")).toBe("");
    expect(dayOfWeekFromIso(undefined as unknown as string)).toBe("");
    expect(dayOfWeekFromIso("not-a-date")).toBe("");
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
