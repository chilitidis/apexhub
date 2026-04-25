import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

// Mock DB helpers before importing the router.
vi.mock("./db", () => {
  const store = {
    snapshots: new Map<string, Map<string, any>>(), // userId -> (monthKey -> row)
    active: new Map<number, any>(), // userId -> active trade row
    // trades: userId -> (monthKey -> (idx -> row))
    trades: new Map<string, Map<string, Map<number, any>>>(),
  };
  const getMonthMap = (userId: number, monthKey: string) => {
    const key = String(userId);
    if (!store.trades.has(key)) store.trades.set(key, new Map());
    const userMap = store.trades.get(key)!;
    if (!userMap.has(monthKey)) userMap.set(monthKey, new Map());
    return userMap.get(monthKey)!;
  };
  return {
    __esModule: true,
    __store: store,
    listMonthlySnapshots: vi.fn(async (userId: number) => {
      const u = store.snapshots.get(String(userId));
      return u ? Array.from(u.values()) : [];
    }),
    upsertMonthlySnapshot: vi.fn(async (userId: number, input: any) => {
      const key = String(userId);
      if (!store.snapshots.has(key)) store.snapshots.set(key, new Map());
      const row = { ...input, userId, id: 1 };
      store.snapshots.get(key)!.set(input.monthKey, row);
      return row;
    }),
    deleteMonthlySnapshot: vi.fn(async (userId: number, monthKey: string) => {
      store.snapshots.get(String(userId))?.delete(monthKey);
    }),
    getActiveTrade: vi.fn(async (userId: number) => store.active.get(userId)),
    upsertActiveTrade: vi.fn(async (userId: number, input: any) => {
      const row = { ...input, userId, id: 1 };
      store.active.set(userId, row);
      return row;
    }),
    deleteActiveTrade: vi.fn(async (userId: number) => {
      store.active.delete(userId);
    }),
    // --- trade helpers ---
    listTradesForMonth: vi.fn(async (userId: number, monthKey: string) => {
      const m = getMonthMap(userId, monthKey);
      return Array.from(m.values());
    }),
    listAllTrades: vi.fn(async (userId: number) => {
      const userMap = store.trades.get(String(userId));
      if (!userMap) return [];
      const all: any[] = [];
      userMap.forEach((m) => m.forEach((t) => all.push(t)));
      return all;
    }),
    upsertTrade: vi.fn(async (userId: number, input: any) => {
      const m = getMonthMap(userId, input.monthKey);
      m.set(input.idx, { ...input, userId, id: m.size + 1 });
    }),
    deleteTrade: vi.fn(async (userId: number, monthKey: string, idx: number) => {
      getMonthMap(userId, monthKey).delete(idx);
    }),
    deleteTradesForMonth: vi.fn(async (userId: number, monthKey: string) => {
      getMonthMap(userId, monthKey).clear();
    }),
    replaceTradesForMonth: vi.fn(async (userId: number, monthKey: string, inputs: any[]) => {
      const m = getMonthMap(userId, monthKey);
      m.clear();
      inputs.forEach((t, i) => m.set(t.idx ?? i, { ...t, userId, id: i + 1 }));
    }),
  };
});

import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeCtx(userId = 42): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const sampleSnapshot = {
  monthKey: "2026-04",
  monthName: "ΑΠΡΙΛΙΟΣ",
  yearFull: "2026",
  yearShort: "26",
  starting: 100_000,
  ending: 105_000,
  netResult: 5_000,
  returnPct: 0.05,
  totalTrades: 3,
  wins: 2,
  losses: 1,
  winRate: 0.6667,
  maxDrawdownPct: 0.02,
  tradesJson: JSON.stringify([{ idx: 1 }, { idx: 2 }, { idx: 3 }]),
};

const sampleActive = {
  symbol: "EURUSD",
  direction: "BUY" as const,
  lots: 0.5,
  entry: 1.085,
  currentPrice: 1.09,
  openTime: "23.04 14:30",
  floatingPnl: 250,
  balance: 105_000,
};

describe("journal router", () => {
  beforeEach(async () => {
    // Reset in-memory store between tests.
    const { __store } = (await import("./db")) as unknown as {
      __store: { snapshots: Map<string, Map<string, unknown>>; active: Map<number, unknown> };
    };
    __store.snapshots.clear();
    __store.active.clear();
  });

  it("persists a monthly snapshot and returns it from list", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await caller.journal.upsertSnapshot(sampleSnapshot);
    const list = await caller.journal.listSnapshots();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ monthKey: "2026-04", totalTrades: 3 });
  });

  it("overwrites the same month on re-upsert", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await caller.journal.upsertSnapshot(sampleSnapshot);
    await caller.journal.upsertSnapshot({ ...sampleSnapshot, totalTrades: 10, netResult: 9_999 });
    const list = await caller.journal.listSnapshots();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ totalTrades: 10, netResult: 9_999 });
  });

  it("deletes a snapshot and the deletion survives list refetch", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await caller.journal.upsertSnapshot(sampleSnapshot);
    await caller.journal.deleteSnapshot({ monthKey: "2026-04" });
    const list = await caller.journal.listSnapshots();
    expect(list).toEqual([]);
  });

  it("scopes snapshots per user", async () => {
    const callerA = appRouter.createCaller(makeCtx(1));
    const callerB = appRouter.createCaller(makeCtx(2));
    await callerA.journal.upsertSnapshot(sampleSnapshot);
    const listA = await callerA.journal.listSnapshots();
    const listB = await callerB.journal.listSnapshots();
    expect(listA).toHaveLength(1);
    expect(listB).toHaveLength(0);
  });

  it("upserts/reads/deletes the active trade", async () => {
    const caller = appRouter.createCaller(makeCtx());
    expect(await caller.journal.getActiveTrade()).toBeNull();

    await caller.journal.upsertActiveTrade(sampleActive);
    const after = await caller.journal.getActiveTrade();
    expect(after).toMatchObject({ symbol: "EURUSD", direction: "BUY", floatingPnl: 250 });

    await caller.journal.deleteActiveTrade();
    expect(await caller.journal.getActiveTrade()).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Dedicated per-trade table
  // ---------------------------------------------------------------------------

  const tradeA = {
    idx: 1,
    symbol: "EURUSD",
    direction: "BUY" as const,
    lots: 0.1,
    entry: 1.085,
    close: 1.09,
    sl: 1.08,
    tp: 1.1,
    trade_r: 2.1,
    pnl: 50,
    swap: 0,
    commission: -1,
    net_pct: 0.0005,
    tf: "H1",
    chart_before: "https://tv/x/a",
    chart_after: "https://tv/x/b",
    open: "2026-04-10T09:00:00.000Z",
    close_time: "2026-04-10T11:00:00.000Z",
    day: "FRI",
  };
  const tradeB = { ...tradeA, idx: 2, pnl: -30, direction: "SELL" as const };

  it("upsertSnapshot syncs per-trade rows so listTrades returns them", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await caller.journal.upsertSnapshot({
      ...sampleSnapshot,
      tradesJson: JSON.stringify([tradeA, tradeB]),
    });
    const rows = await caller.journal.listTrades({ monthKey: "2026-04" });
    expect(rows).toHaveLength(2);
    expect(rows.map((r: any) => r.idx).sort()).toEqual([1, 2]);
    expect(rows.find((r: any) => r.idx === 1)).toMatchObject({
      symbol: "EURUSD",
      direction: "BUY",
      pnl: 50,
      closePrice: 1.09,
      tradeR: 2.1,
    });
  });

  it("upsertSnapshot replaces the previous per-trade rows on re-upsert", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await caller.journal.upsertSnapshot({
      ...sampleSnapshot,
      tradesJson: JSON.stringify([tradeA, tradeB]),
    });
    await caller.journal.upsertSnapshot({
      ...sampleSnapshot,
      tradesJson: JSON.stringify([tradeA]),
    });
    const rows = await caller.journal.listTrades({ monthKey: "2026-04" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ idx: 1 });
  });

  it("deleteSnapshot also clears the per-trade rows", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await caller.journal.upsertSnapshot({
      ...sampleSnapshot,
      tradesJson: JSON.stringify([tradeA, tradeB]),
    });
    await caller.journal.deleteSnapshot({ monthKey: "2026-04" });
    const rows = await caller.journal.listTrades({ monthKey: "2026-04" });
    expect(rows).toEqual([]);
  });

  it("listTrades without monthKey returns trades for the user across months", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await caller.journal.upsertSnapshot({
      ...sampleSnapshot,
      monthKey: "2026-03",
      tradesJson: JSON.stringify([tradeA]),
    });
    await caller.journal.upsertSnapshot({
      ...sampleSnapshot,
      monthKey: "2026-04",
      tradesJson: JSON.stringify([tradeB]),
    });
    const all = await caller.journal.listTrades();
    expect(all).toHaveLength(2);
  });

  it("upsertTrade and deleteTrade work at the row level", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await caller.journal.upsertTrade({ monthKey: "2026-04", trade: tradeA });
    await caller.journal.upsertTrade({ monthKey: "2026-04", trade: tradeB });
    expect(await caller.journal.listTrades({ monthKey: "2026-04" })).toHaveLength(2);
    await caller.journal.deleteTrade({ monthKey: "2026-04", idx: 1 });
    const remaining = await caller.journal.listTrades({ monthKey: "2026-04" });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ idx: 2 });
  });

  it("scopes per-trade rows per user", async () => {
    const callerA = appRouter.createCaller(makeCtx(1));
    const callerB = appRouter.createCaller(makeCtx(2));
    await callerA.journal.upsertSnapshot({
      ...sampleSnapshot,
      tradesJson: JSON.stringify([tradeA]),
    });
    expect(await callerA.journal.listTrades()).toHaveLength(1);
    expect(await callerB.journal.listTrades()).toHaveLength(0);
  });
});
