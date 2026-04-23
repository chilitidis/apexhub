import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  activeTrades,
  InsertActiveTrade,
  InsertMonthlySnapshot,
  InsertUser,
  monthlySnapshots,
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
// Journal: monthly snapshots
// =============================================================================

export async function listMonthlySnapshots(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(monthlySnapshots)
    .where(eq(monthlySnapshots.userId, userId));
}

export async function getMonthlySnapshot(userId: number, monthKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(monthlySnapshots)
    .where(and(eq(monthlySnapshots.userId, userId), eq(monthlySnapshots.monthKey, monthKey)))
    .limit(1);
  return rows[0];
}

export type SnapshotInput = Omit<InsertMonthlySnapshot, "id" | "userId" | "createdAt" | "updatedAt">;

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
  return getMonthlySnapshot(userId, input.monthKey);
}

export async function deleteMonthlySnapshot(userId: number, monthKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(monthlySnapshots)
    .where(and(eq(monthlySnapshots.userId, userId), eq(monthlySnapshots.monthKey, monthKey)));
}

// =============================================================================
// Journal: active trade (live floating)
// =============================================================================

export async function getActiveTrade(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(activeTrades).where(eq(activeTrades.userId, userId)).limit(1);
  return rows[0];
}

export type ActiveTradeInput = Omit<InsertActiveTrade, "id" | "userId" | "updatedAt">;

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
  return getActiveTrade(userId);
}

export async function deleteActiveTrade(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(activeTrades).where(eq(activeTrades.userId, userId));
}
