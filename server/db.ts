import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  accounts,
  activeTrades,
  InsertAccount,
  InsertActiveTrade,
  InsertMonthlySnapshot,
  InsertUser,
  monthlySnapshots,
  trades,
  type InsertTrade,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// =============================================================================
// Journal: accounts (multi-account support)
// =============================================================================

export type AccountInput = Omit<InsertAccount, "id" | "userId" | "createdAt" | "updatedAt" | "archivedAt">;
export type AccountPatch = Partial<AccountInput>;

/**
 * Return every account owned by the user, including archived ones. Callers that
 * want only active journals can filter by `archivedAt === null` in memory.
 */
export async function listAccounts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accounts).where(eq(accounts.userId, userId));
}

export async function getAccount(userId: number, accountId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
    .limit(1);
  return rows[0];
}

export async function createAccount(userId: number, input: AccountInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const values: InsertAccount = { ...input, userId };
  const result = await db.insert(accounts).values(values).$returningId();
  const newId = Array.isArray(result) && result[0]?.id ? result[0].id : undefined;
  if (!newId) throw new Error("Failed to create account: no id returned");
  return (await getAccount(userId, newId))!;
}

export async function updateAccount(userId: number, accountId: number, patch: AccountPatch) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  if (patch.name !== undefined) updateSet.name = patch.name;
  if (patch.startingBalance !== undefined) updateSet.startingBalance = patch.startingBalance;
  if (patch.accountType !== undefined) updateSet.accountType = patch.accountType;
  if (patch.currency !== undefined) updateSet.currency = patch.currency;
  if (patch.color !== undefined) updateSet.color = patch.color;
  if (Object.keys(updateSet).length === 0) return getAccount(userId, accountId);
  await db
    .update(accounts)
    .set(updateSet)
    .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)));
  return getAccount(userId, accountId);
}

/**
 * Hard-delete an account together with every piece of journal data scoped to it.
 */
export async function deleteAccount(userId: number, accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(trades)
    .where(and(eq(trades.userId, userId), eq(trades.accountId, accountId)));
  await db
    .delete(monthlySnapshots)
    .where(and(eq(monthlySnapshots.userId, userId), eq(monthlySnapshots.accountId, accountId)));
  await db
    .delete(activeTrades)
    .where(and(eq(activeTrades.userId, userId), eq(activeTrades.accountId, accountId)));
  await db
    .delete(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)));
}

/**
 * Ensure the user owns at least one account. If they don't, create a default
 * "My Trading Account" and migrate any legacy rows (rows that were written
 * before multi-account support and therefore have `accountId = 0`) into it so
 * existing users don't lose history when the schema changes.
 *
 * Idempotent: safe to call on every login / list request.
 */
export async function ensureDefaultAccount(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const existing = await listAccounts(userId);
  if (existing.length > 0) {
    // Still migrate any orphan legacy rows (accountId = 0) to the first account.
    const anchor = existing[0];
    await migrateLegacyRows(userId, anchor.id);
    return anchor;
  }
  const created = await createAccount(userId, {
    name: "My Trading Account",
    startingBalance: 0,
    accountType: "other",
    currency: "USD",
    color: "#0077B6",
  });
  await migrateLegacyRows(userId, created.id);
  return created;
}

async function migrateLegacyRows(userId: number, accountId: number) {
  const db = await getDb();
  if (!db) return;
  // Legacy rows have accountId = 0 because the column did not exist before the
  // multi-account migration. Reassign them to the newly-minted default account.
  await db
    .update(monthlySnapshots)
    .set({ accountId })
    .where(and(eq(monthlySnapshots.userId, userId), eq(monthlySnapshots.accountId, 0)));
  await db
    .update(trades)
    .set({ accountId })
    .where(and(eq(trades.userId, userId), eq(trades.accountId, 0)));
  await db
    .update(activeTrades)
    .set({ accountId })
    .where(and(eq(activeTrades.userId, userId), eq(activeTrades.accountId, 0)));
}

// =============================================================================
// Journal: monthly snapshots
// =============================================================================

export async function listMonthlySnapshots(userId: number, accountId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(monthlySnapshots)
    .where(
      and(
        eq(monthlySnapshots.userId, userId),
        eq(monthlySnapshots.accountId, accountId),
      ),
    );
}

export async function getMonthlySnapshot(userId: number, accountId: number, monthKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(monthlySnapshots)
    .where(
      and(
        eq(monthlySnapshots.userId, userId),
        eq(monthlySnapshots.accountId, accountId),
        eq(monthlySnapshots.monthKey, monthKey),
      ),
    )
    .limit(1);
  return rows[0];
}

export type SnapshotInput = Omit<
  InsertMonthlySnapshot,
  "id" | "userId" | "createdAt" | "updatedAt"
>;

export async function upsertMonthlySnapshot(userId: number, input: SnapshotInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const values: InsertMonthlySnapshot = { ...input, userId };
  const updateSet = {
    monthName: input.monthName,
    yearFull: input.yearFull,
    yearShort: input.yearShort,
    starting: input.starting,
    ending: input.ending,
    netResult: input.netResult,
    returnPct: input.returnPct,
    totalTrades: input.totalTrades,
    wins: input.wins,
    losses: input.losses,
    winRate: input.winRate,
    maxDrawdownPct: input.maxDrawdownPct,
    tradesJson: input.tradesJson,
  };

  await db.insert(monthlySnapshots).values(values).onDuplicateKeyUpdate({ set: updateSet });
  return getMonthlySnapshot(userId, input.accountId, input.monthKey);
}

export async function deleteMonthlySnapshot(
  userId: number,
  accountId: number,
  monthKey: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(monthlySnapshots)
    .where(
      and(
        eq(monthlySnapshots.userId, userId),
        eq(monthlySnapshots.accountId, accountId),
        eq(monthlySnapshots.monthKey, monthKey),
      ),
    );
}

// =============================================================================
// Journal: active trade (live floating)
// =============================================================================

export async function getActiveTrade(userId: number, accountId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(activeTrades)
    .where(and(eq(activeTrades.userId, userId), eq(activeTrades.accountId, accountId)))
    .limit(1);
  return rows[0];
}

export type ActiveTradeInput = Omit<
  InsertActiveTrade,
  "id" | "userId" | "updatedAt"
>;

export async function upsertActiveTrade(userId: number, input: ActiveTradeInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const values: InsertActiveTrade = { ...input, userId };
  const updateSet = {
    symbol: input.symbol,
    direction: input.direction,
    lots: input.lots,
    entry: input.entry,
    currentPrice: input.currentPrice,
    openTime: input.openTime,
    floatingPnl: input.floatingPnl,
    balance: input.balance,
  };
  await db.insert(activeTrades).values(values).onDuplicateKeyUpdate({ set: updateSet });
  return getActiveTrade(userId, input.accountId);
}

export async function deleteActiveTrade(userId: number, accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(activeTrades)
    .where(and(eq(activeTrades.userId, userId), eq(activeTrades.accountId, accountId)));
}

// =============================================================================
// Journal: per-trade rows (denormalized projection of monthlySnapshots.tradesJson)
// =============================================================================

export type TradeInput = Omit<InsertTrade, "id" | "userId" | "createdAt" | "updatedAt">;

export async function listTradesForMonth(
  userId: number,
  accountId: number,
  monthKey: string,
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(trades)
    .where(
      and(
        eq(trades.userId, userId),
        eq(trades.accountId, accountId),
        eq(trades.monthKey, monthKey),
      ),
    );
}

export async function listAllTrades(userId: number, accountId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(trades)
    .where(and(eq(trades.userId, userId), eq(trades.accountId, accountId)));
}

export async function upsertTrade(userId: number, input: TradeInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const values: InsertTrade = { ...input, userId };
  const updateSet = {
    symbol: input.symbol,
    direction: input.direction,
    lots: input.lots,
    entry: input.entry,
    closePrice: input.closePrice,
    sl: input.sl ?? null,
    tp: input.tp ?? null,
    tradeR: input.tradeR ?? null,
    pnl: input.pnl,
    swap: input.swap,
    commission: input.commission,
    netPct: input.netPct,
    tf: input.tf,
    chartBefore: input.chartBefore,
    chartAfter: input.chartAfter,
    openStr: input.openStr,
    closeTimeStr: input.closeTimeStr,
    day: input.day,
  };
  await db.insert(trades).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function deleteTrade(
  userId: number,
  accountId: number,
  monthKey: string,
  idx: number,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(trades)
    .where(
      and(
        eq(trades.userId, userId),
        eq(trades.accountId, accountId),
        eq(trades.monthKey, monthKey),
        eq(trades.idx, idx),
      ),
    );
}

export async function deleteTradesForMonth(
  userId: number,
  accountId: number,
  monthKey: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(trades)
    .where(
      and(
        eq(trades.userId, userId),
        eq(trades.accountId, accountId),
        eq(trades.monthKey, monthKey),
      ),
    );
}

/**
 * Replace the full set of per-trade rows for (userId, accountId, monthKey) with
 * the given list. Used by upsertSnapshot to keep both projections in sync
 * atomically (logically — we run sequential delete + inserts).
 */
export async function replaceTradesForMonth(
  userId: number,
  accountId: number,
  monthKey: string,
  inputs: TradeInput[],
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(trades)
    .where(
      and(
        eq(trades.userId, userId),
        eq(trades.accountId, accountId),
        eq(trades.monthKey, monthKey),
      ),
    );
  if (inputs.length === 0) return;
  const values: InsertTrade[] = inputs.map((i) => ({ ...i, userId }));
  await db.insert(trades).values(values);
}

// Unused but exported for potential future "show only active journals" filter
export const _archivedFilter = isNull(accounts.archivedAt);
