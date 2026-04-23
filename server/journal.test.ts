import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

// Mock DB helpers before importing the router.
vi.mock("./db", () => {
  const store = {
    snapshots: new Map<string, Map<string, any>>(), // userId -> (monthKey -> row)
    active: new Map<number, any>(), // userId -> active trade row
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
});
