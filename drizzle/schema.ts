import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, double, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Monthly snapshot — one row per (user, month). Stores all trades as JSON blob plus
 * precomputed KPI summary for fast listing. This is the single source of truth for
 * the journal; any edit / add / delete of trades overwrites the row for that month.
 */
export const monthlySnapshots = mysqlTable(
  "monthly_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    // e.g. "2026-04"
    monthKey: varchar("monthKey", { length: 16 }).notNull(),
    monthName: varchar("monthName", { length: 32 }).notNull(),
    yearFull: varchar("yearFull", { length: 8 }).notNull(),
    yearShort: varchar("yearShort", { length: 4 }).notNull(),
    starting: double("starting").notNull().default(0),
    ending: double("ending").notNull().default(0),
    netResult: double("netResult").notNull().default(0),
    returnPct: double("returnPct").notNull().default(0),
    totalTrades: int("totalTrades").notNull().default(0),
    wins: int("wins").notNull().default(0),
    losses: int("losses").notNull().default(0),
    winRate: double("winRate").notNull().default(0),
    maxDrawdownPct: double("maxDrawdownPct").notNull().default(0),
    // Serialized array of Trade objects.
    tradesJson: text("tradesJson").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    uniqUserMonth: uniqueIndex("uniq_user_month").on(table.userId, table.monthKey),
  }),
);

export type MonthlySnapshot = typeof monthlySnapshots.$inferSelect;
export type InsertMonthlySnapshot = typeof monthlySnapshots.$inferInsert;

/**
 * Active trade — optional "live" floating trade banner state. One per user.
 */
export const activeTrades = mysqlTable("active_trades", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  symbol: varchar("symbol", { length: 32 }).notNull(),
  direction: mysqlEnum("direction", ["BUY", "SELL"]).notNull(),
  lots: double("lots").notNull().default(0),
  entry: double("entry").notNull().default(0),
  currentPrice: double("currentPrice").notNull().default(0),
  openTime: varchar("openTime", { length: 64 }).notNull().default(""),
  floatingPnl: double("floatingPnl").notNull().default(0),
  balance: double("balance").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ActiveTradeRow = typeof activeTrades.$inferSelect;
export type InsertActiveTrade = typeof activeTrades.$inferInsert;
