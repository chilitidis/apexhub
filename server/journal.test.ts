import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

// Mock DB helpers before importing the router.
vi.mock("./db", () => {
  const store = {
    accounts: new Map<number, Map<number, any>>(), // userId -> (accountId -> row)
    snapshots: new Map<string, Map<string, any>>(), // `${userId}:${accountId}` -> (monthKey -> row)
    active: new Map<string, any>(), // `${userId}:${accountId}` -> row
    trades: new Map<string, Map<string, Map<number, any>>>(), // `${userId}:${accountId}` -> monthKey -> idx -> row
    nextAccountId: 1,
  };
  const scopeKey = (userId: number, accountId: number) => `${userId}:${accountId}`;
  const getAccountMap = (userId: number) => {
    if (!store.accounts.has(userId)) store.accounts.set(userId, new Map());
    return store.accounts.get(userId)!;
  };
  const getSnapshotMap = (userId: number, accountId: number) => {
    const k = scopeKey(userId, accountId);
    if (!store.snapshots.has(k)) store.snapshots.set(k, new Map());
    return store.snapshots.get(k)!;
  };
  const getMonthTradesMap = (userId: number, accountId: number, monthKey: string) => {
    const k = scopeKey(userId, accountId);
    if (!store.trades.has(k)) store.trades.set(k, new Map());
    const scope = store.trades.get(k)!;
    if (!scope.has(monthKey)) scope.set(monthKey, new Map());
    return scope.get(monthKey)!;
  };
  return {
    __esModule: true,
    __store: store,

    // --- accounts ---
    listAccounts: vi.fn(async (userId: number) => Array.from(getAccountMap(userId).values())),
    getAccount: vi.fn(async (userId: number, accountId: number) =>
      getAccountMap(userId).get(accountId),
    ),
    createAccount: vi.fn(async (userId: number, input: any) => {
      const id = store.nextAccountId++;
      const row = { id, userId, archivedAt: null, ...input };
      getAccountMap(userId).set(id, row);
      return row;
    }),
    updateAccount: vi.fn(async (userId: number, accountId: number, patch: any) => {
      const row = getAccountMap(userId).get(accountId);
      if (!row) return undefined;
      Object.assign(row, patch);
      return row;
    }),
    deleteAccount: vi.fn(async (userId: number, accountId: number) => {
      getAccountMap(userId).delete(accountId);
      store.snapshots.delete(scopeKey(userId, accountId));
      store.active.delete(scopeKey(userId, accountId));
      store.trades.delete(scopeKey(userId, accountId));
    }),
    ensureDefaultAccount: vi.fn(async (userId: number) => {
      const existing = Array.from(getAccountMap(userId).values());
      if (existing.length > 0) return existing[0];
      const id = store.nextAccountId++;
      const row = {
        id,
        userId,
        name: "My Trading Account",
        startingBalance: 0,
        accountType: "other",
        currency: "USD",
        color: "#0077B6",
      };
      getAccountMap(userId).set(id, row);
      return row;
    }),

    // --- snapshots ---
    listMonthlySnapshots: vi.fn(async (userId: number, accountId: number) =>
      Array.from(getSnapshotMap(userId, accountId).values()),
    ),
    upsertMonthlySnapshot: vi.fn(async (userId: number, input: any) => {
      const row = { ...input, userId, id: 1 };
      getSnapshotMap(userId, input.accountId).set(input.monthKey, row);
      return row;
    }),
    deleteMonthlySnapshot: vi.fn(async (userId: number, accountId: number, monthKey: string) => {
      getSnapshotMap(userId, accountId).delete(monthKey);
    }),

    // --- active trade ---
    getActiveTrade: vi.fn(async (userId: number, accountId: number) =>
      store.active.get(scopeKey(userId, accountId)),
    ),
    upsertActiveTrade: vi.fn(async (userId: number, input: any) => {
      const row = { ...input, userId, id: 1 };
      store.active.set(scopeKey(userId, input.accountId), row);
      return row;
    }),
    deleteActiveTrade: vi.fn(async (userId: number, accountId: number) => {
      store.active.delete(scopeKey(userId, accountId));
    }),

    // --- trades ---
    listTradesForMonth: vi.fn(async (userId: number, accountId: number, monthKey: string) =>
      Array.from(getMonthTradesMap(userId, accountId, monthKey).values()),
    ),
    listAllTrades: vi.fn(async (userId: number, accountId: number) => {
      const scope = store.trades.get(scopeKey(userId, accountId));
      if (!scope) return [];
      const all: any[] = [];
      scope.forEach((m) => m.forEach((t) => all.push(t)));
      return all;
    }),
    upsertTrade: vi.fn(async (userId: number, input: any) => {
      const m = getMonthTradesMap(userId, input.accountId, input.monthKey);
      m.set(input.idx, { ...input, userId, id: m.size + 1 });
    }),
    deleteTrade: vi.fn(
      async (userId: number, accountId: number, monthKey: string, idx: number) => {
        getMonthTradesMap(userId, accountId, monthKey).delete(idx);
      },
    ),
    deleteTradesForMonth: vi.fn(async (userId: number, accountId: number, monthKey: string) => {
      getMonthTradesMap(userId, accountId, monthKey).clear();
    }),
    replaceTradesForMonth: vi.fn(
      async (userId: number, accountId: number, monthKey: string, inputs: any[]) => {
        const m = getMonthTradesMap(userId, accountId, monthKey);
        m.clear();
        inputs.forEach((t, i) =>
          m.set(t.idx ?? i, { ...t, userId, accountId, monthKey, id: i + 1 }),
        );
      },
    ),
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

const ACCOUNT_ID = 1;

const sampleSnapshot = {
  accountId: ACCOUNT_ID,
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
  accountId: ACCOUNT_ID,
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
      __store: {
        accounts: Map<number, Map<number, unknown>>;
        snapshots: Map<string, Map<string, unknown>>;
        active: Map<string, unknown>;
        trades: Map<string, Map<string, Map<number, unknown>>>;
        nextAccountId: number;
      };
    };
    __store.accounts.clear();
    __store.snapshots.clear();
    __store.active.clear();
    __store.trades.clear();
    __store.nextAccountId = 1;

    // Seed default account rows for the userIds we exercise in tests so the
    // journal router's `assertAccount` guard passes.
    const seed = (userId: number, accountId: number) => {
      const map = __store.accounts.get(userId) ?? new Map<number, unknown>();
      map.set(accountId, {
        id: accountId,
        userId,
        name: `Account ${accountId}`,
        startingBalance: 0,
        accountType: "other",
        currency: "USD",
        color: "#0077B6",
        archivedAt: null,
      });
      __store.accounts.set(userId, map);
      __store.nextAccountId = Math.max(__store.nextAccountId, accountId + 1);
    };
    [1, 2, 42].forEach((uid) => {
      seed(uid, 1);
      seed(uid, 2);
    });
  });

  it("persists a monthly snapshot and returns it from list", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await caller.journal.upsertSnapshot(sampleSnapshot);
    const list = await caller.journal.listSnapshots({ accountId: ACCOUNT_ID });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ monthKey: "2026-04", totalTrades: 3 });
  });

  it("overwrites the same month on re-upsert", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await caller.journal.upsertSnapshot(sampleSnapshot);
    await caller.journal.upsertSnapshot({ ...sampleSnapshot, totalTrades: 10, netResult: 9_999 });
    const list = await caller.journal.listSnapshots({ accountId: ACCOUNT_ID });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ totalTrades: 10, netResult: 9_999 });
  });

  it("deletes a snapshot and the deletion survives list refetch", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await caller.journal.upsertSnapshot(sampleSnapshot);
    await caller.journal.deleteSnapshot({ accountId: ACCOUNT_ID, monthKey: "2026-04" });
    const list = await caller.journal.listSnapshots({ accountId: ACCOUNT_ID });
    expect(list).toEqual([]);
  });

  it("scopes snapshots per user", async () => {
    const callerA = appRouter.createCaller(makeCtx(1));
    const callerB = appRouter.createCaller(makeCtx(2));
    await callerA.journal.upsertSnapshot(sampleSnapshot);
    const listA = await callerA.journal.listSnapshots({ accountId: ACCOUNT_ID });
    const listB = await callerB.journal.listSnapshots({ accountId: ACCOUNT_ID });
    expect(listA).toHaveLength(1);
    expect(listB).toHaveLength(0);
  });

  it("upserts/reads/deletes the active trade", async () => {
    const caller = appRouter.createCaller(makeCtx());
    expect(await caller.journal.getActiveTrade({ accountId: ACCOUNT_ID })).toBeNull();

    await caller.journal.upsertActiveTrade(sampleActive);
    const after = await caller.journal.getActiveTrade({ accountId: ACCOUNT_ID });
    expect(after).toMatchObject({ symbol: "EURUSD", direction: "BUY", floatingPnl: 250 });

    await caller.journal.deleteActiveTrade({ accountId: ACCOUNT_ID });
    expect(await caller.journal.getActiveTrade({ accountId: ACCOUNT_ID })).toBeNull();
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
    const rows = await caller.journal.listTrades({ accountId: ACCOUNT_ID, monthKey: "2026-04" });
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
    const rows = await caller.journal.listTrades({ accountId: ACCOUNT_ID, monthKey: "2026-04" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ idx: 1 });
  });

  it("deleteSnapshot also clears the per-trade rows", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await caller.journal.upsertSnapshot({
      ...sampleSnapshot,
      tradesJson: JSON.stringify([tradeA, tradeB]),
    });
    await caller.journal.deleteSnapshot({ accountId: ACCOUNT_ID, monthKey: "2026-04" });
    const rows = await caller.journal.listTrades({ accountId: ACCOUNT_ID, monthKey: "2026-04" });
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
    const all = await caller.journal.listTrades({ accountId: ACCOUNT_ID });
    expect(all).toHaveLength(2);
  });

  it("upsertTrade and deleteTrade work at the row level", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await caller.journal.upsertTrade({ accountId: ACCOUNT_ID, monthKey: "2026-04", trade: tradeA });
    await caller.journal.upsertTrade({ accountId: ACCOUNT_ID, monthKey: "2026-04", trade: tradeB });
    expect(
      await caller.journal.listTrades({ accountId: ACCOUNT_ID, monthKey: "2026-04" }),
    ).toHaveLength(2);
    await caller.journal.deleteTrade({ accountId: ACCOUNT_ID, monthKey: "2026-04", idx: 1 });
    const remaining = await caller.journal.listTrades({
      accountId: ACCOUNT_ID,
      monthKey: "2026-04",
    });
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
    expect(await callerA.journal.listTrades({ accountId: ACCOUNT_ID })).toHaveLength(1);
    expect(await callerB.journal.listTrades({ accountId: ACCOUNT_ID })).toHaveLength(0);
  });

  it("scopes snapshots per account (same user, different accounts = isolated)", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await caller.journal.upsertSnapshot({ ...sampleSnapshot, accountId: 1 });
    await caller.journal.upsertSnapshot({ ...sampleSnapshot, accountId: 2, netResult: 999 });
    const list1 = await caller.journal.listSnapshots({ accountId: 1 });
    const list2 = await caller.journal.listSnapshots({ accountId: 2 });
    expect(list1).toHaveLength(1);
    expect(list1[0]).toMatchObject({ netResult: 5_000 });
    expect(list2).toHaveLength(1);
    expect(list2[0]).toMatchObject({ netResult: 999 });
  });
});
