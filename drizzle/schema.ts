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

/**
 * Dedicated per-trade table. This is a denormalized projection of what lives
 * inside `monthly_snapshots.tradesJson`, kept in sync every time we upsert a
 * snapshot. It lets us query trades directly (e.g. for analytics, exports)
 * without pulling the entire month JSON.
 *
 * Natural key: (userId, monthKey, idx). `idx` matches the `Trade.idx` used by
 * the UI (1-based within a month).
 */
export const trades = mysqlTable(
  "trades",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    monthKey: varchar("monthKey", { length: 16 }).notNull(),
    idx: int("idx").notNull(),
    symbol: varchar("symbol", { length: 32 }).notNull(),
    direction: mysqlEnum("direction", ["BUY", "SELL"]).notNull(),
    lots: double("lots").notNull().default(0),
    entry: double("entry").notNull().default(0),
    closePrice: double("closePrice").notNull().default(0),
    sl: double("sl"),
    tp: double("tp"),
    tradeR: double("tradeR"),
    pnl: double("pnl").notNull().default(0),
    swap: double("swap").notNull().default(0),
    commission: double("commission").notNull().default(0),
    netPct: double("netPct").notNull().default(0),
    tf: varchar("tf", { length: 16 }).notNull().default(""),
    chartBefore: text("chartBefore").notNull(),
    chartAfter: text("chartAfter").notNull(),
    balanceBefore: double("balanceBefore").notNull().default(0),
    balanceAfter: double("balanceAfter").notNull().default(0),
    // Trade open/close are stored as ISO strings (or whatever the UI produces)
    // so we stay schema-compatible with the existing `Trade` shape.
    openStr: varchar("openStr", { length: 64 }).notNull().default(""),
    closeTimeStr: varchar("closeTimeStr", { length: 64 }).notNull().default(""),
    day: varchar("day", { length: 16 }).notNull().default(""),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    uniqUserMonthIdx: uniqueIndex("uniq_user_month_idx").on(table.userId, table.monthKey, table.idx),
  }),
);

export type TradeRow = typeof trades.$inferSelect;
export type InsertTrade = typeof trades.$inferInsert;
