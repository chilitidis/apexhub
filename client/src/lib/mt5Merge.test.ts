import { describe, expect, it } from "vitest";
import { mergeMt5TradesIntoMonths, type MappedMt5Trade } from "./mt5Merge";
import type { MonthSnapshot } from "@/hooks/useJournal";

const tr = (over: Partial<MappedMt5Trade> = {}): MappedMt5Trade => ({
  positionId: "p1",
  symbol: "EURUSD",
  direction: "BUY",
  lots: 1,
  entry: 1.1,
  close: 1.105,
  sl: null,
  tp: null,
  day: "ΤΕΤ",
  trade_r: null,
  net_pct: 0,
  pnl: 50,
  swap: 0,
  commission: -2,
  open: "2026-04-15T10:00:00Z",
  close_time: "2026-04-15T11:00:00Z",
  status: "closed",
  ...over,
});

const snap = (over: Partial<MonthSnapshot> = {}): MonthSnapshot => ({
  key: "2026-03",
  month_name: "ΜΑΡΤΙΟΣ",
  year_full: "2026",
  year_short: "26",
  starting: 10000,
  ending: 11000,
  net_result: 1000,
  return_pct: 0.1,
  total_trades: 5,
  wins: 4,
  losses: 1,
  win_rate: 80,
  max_drawdown_pct: -2,
  trades_json: "[]",
  adjustments_json: "[]",
  currency: "USD",
  ...over,
});

describe("mergeMt5TradesIntoMonths", () => {
  it("returns empty list when no trades supplied", () => {
    expect(mergeMt5TradesIntoMonths([], [])).toEqual([]);
  });

  it("buckets trades by close_time year+month", () => {
    const result = mergeMt5TradesIntoMonths(
      [
        tr({ positionId: "p1", close_time: "2026-04-15T11:00:00Z" }),
        tr({ positionId: "p2", close_time: "2026-05-02T11:00:00Z" }),
      ],
      [],
      { fallbackStarting: 5000 },
    );
    expect(result).toHaveLength(2);
    const months = result.map((d) => d.meta.month_name).sort();
    expect(months).toEqual(["ΑΠΡΙΛΙΟΣ", "ΜΑΙΟΣ"].sort());
  });

  it("seeds starting balance from prior snapshot when bucket is new", () => {
    const result = mergeMt5TradesIntoMonths(
      [tr({ close_time: "2026-04-15T11:00:00Z", pnl: 100 })],
      [snap({ key: "2026-03", ending: 12345 })],
      { fallbackStarting: 99 },
    );
    expect(result).toHaveLength(1);
    expect(result[0].kpis.starting).toBe(12345);
  });

  it("falls back to fallbackStarting when no prior history exists", () => {
    const result = mergeMt5TradesIntoMonths(
      [tr({ close_time: "2026-04-15T11:00:00Z" })],
      [],
      { fallbackStarting: 5000 },
    );
    expect(result[0].kpis.starting).toBe(5000);
  });

  it("preserves currency from existing snapshot, defaults from options otherwise", () => {
    const eurResult = mergeMt5TradesIntoMonths(
      [tr({ close_time: "2026-04-15T11:00:00Z" })],
      [],
      { fallbackStarting: 100, currency: "EUR" },
    );
    expect(eurResult[0].meta.currency).toBe("EUR");

    const usdSnap = snap({ key: "2026-04", currency: "USD", month_name: "ΑΠΡΙΛΙΟΣ" });
    const fromExisting = mergeMt5TradesIntoMonths(
      [tr({ close_time: "2026-04-15T11:00:00Z" })],
      [usdSnap],
      { currency: "EUR" },
    );
    expect(fromExisting[0].meta.currency).toBe("USD");
  });

  it("dedupes trades that are re-synced (positionId tag in notes)", () => {
    const initialTrades = [
      {
        idx: 1,
        symbol: "EURUSD",
        direction: "BUY" as const,
        lots: 1,
        entry: 1.1,
        close: 1.105,
        sl: null,
        tp: null,
        pnl: 40,
        swap: 0,
        commission: 0,
        notes: "[mt5:p1]",
        open: "2026-04-15T10:00:00Z",
        close_time: "2026-04-15T11:00:00Z",
        net_pct: 0,
        trade_r: null,
        day: "ΤΕΤ",
      },
    ];
    const existingSnap = snap({
      key: "2026-04",
      month_name: "ΑΠΡΙΛΙΟΣ",
      starting: 10000,
      trades_json: JSON.stringify(initialTrades),
    });
    const result = mergeMt5TradesIntoMonths(
      [tr({ positionId: "p1", pnl: 80 })],
      [existingSnap],
    );
    expect(result).toHaveLength(1);
    expect(result[0].trades).toHaveLength(1);
    expect(result[0].trades[0].pnl).toBe(80);
    expect(result[0].trades[0].notes).toContain("[mt5:p1]");
  });
});
