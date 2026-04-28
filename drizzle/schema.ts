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
 * Trading accounts — a user can own multiple independent journals (e.g. a prop
 * firm challenge, a personal live account, and a demo). Each row here is a
 * self-contained journal: its own starting balance, its own monthly snapshots,
 * its own trades, its own active-trade banner.
 *
 * `archivedAt` is reserved for soft-delete; for now deletions are hard. The
 * `color` / `accountType` columns are purely presentational metadata used by
 * the Accounts picker to differentiate journals at a glance.
 */
export const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  startingBalance: double("startingBalance").notNull().default(0),
  accountType: mysqlEnum("accountType", ["prop", "live", "demo", "other"]).default("other").notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("USD"),
  color: varchar("color", { length: 16 }).notNull().default("#0077B6"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  archivedAt: timestamp("archivedAt"),
});

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;

/**
 * Monthly snapshot — one row per (user, account, month). Stores all trades as
 * a JSON blob plus precomputed KPI summary for fast listing. This is the
 * single source of truth for each journal; any edit / add / delete of trades
 * overwrites the row for that month.
 *
 * The `accountId` column lets the same user run multiple independent journals
 * over the same calendar month.
 */
export const monthlySnapshots = mysqlTable(
  "monthly_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    accountId: int("accountId").notNull(),
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
    uniqUserAccountMonth: uniqueIndex("uniq_user_account_month").on(
      table.userId,
      table.accountId,
      table.monthKey,
    ),
  }),
);

export type MonthlySnapshot = typeof monthlySnapshots.$inferSelect;
export type InsertMonthlySnapshot = typeof monthlySnapshots.$inferInsert;

/**
 * Active trade — the "live" floating trade banner state. Scoped per account so
 * a user following two accounts in parallel can have one live trade open on
 * each simultaneously.
 */
export const activeTrades = mysqlTable(
  "active_trades",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    accountId: int("accountId").notNull(),
    symbol: varchar("symbol", { length: 32 }).notNull(),
    direction: mysqlEnum("direction", ["BUY", "SELL"]).notNull(),
    lots: double("lots").notNull().default(0),
    entry: double("entry").notNull().default(0),
    currentPrice: double("currentPrice").notNull().default(0),
    openTime: varchar("openTime", { length: 64 }).notNull().default(""),
    floatingPnl: double("floatingPnl").notNull().default(0),
    balance: double("balance").notNull().default(0),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    uniqUserAccount: uniqueIndex("uniq_user_account_active_trade").on(
      table.userId,
      table.accountId,
    ),
  }),
);

export type ActiveTradeRow = typeof activeTrades.$inferSelect;
export type InsertActiveTrade = typeof activeTrades.$inferInsert;

/**
 * Dedicated per-trade table. This is a denormalized projection of what lives
 * inside `monthly_snapshots.tradesJson`, kept in sync every time we upsert a
 * snapshot. It lets us query trades directly (e.g. for analytics, exports)
 * without pulling the entire month JSON.
 *
 * Natural key: (userId, accountId, monthKey, idx). `idx` matches the
 * `Trade.idx` used by the UI (1-based within a month).
 */
export const trades = mysqlTable(
  "trades",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    accountId: int("accountId").notNull(),
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
    // Trade open/close are stored as ISO strings (or whatever the UI produces)
    // so we stay schema-compatible with the existing `Trade` shape.
    openStr: varchar("openStr", { length: 64 }).notNull().default(""),
    closeTimeStr: varchar("closeTimeStr", { length: 64 }).notNull().default(""),
    day: varchar("day", { length: 16 }).notNull().default(""),
    // Free-text journal fields. Optional: the UI treats empty string as "no note".
    psychology: text("psychology"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    uniqUserAccountMonthIdx: uniqueIndex("uniq_user_account_month_idx").on(
      table.userId,
      table.accountId,
      table.monthKey,
      table.idx,
    ),
  }),
);

export type TradeRow = typeof trades.$inferSelect;
export type InsertTrade = typeof trades.$inferInsert;


/**
 * Public share snapshots. When a user clicks "Share" on their journal, we
 * persist a read-only copy of the KPIs + a small, rendered-once subset of
 * trades into this table and give them back a short token. Anybody (even
 * logged-out) can then visit `/share/:token` and see the snapshot.
 *
 * Design notes:
 * - Data is denormalised on purpose (the user's journal can change/delete
 *   after the fact and the share preview must keep working).
 * - `payloadJson` is a JSON blob of `{ accountName, starting, ending,
 *   netResult, returnPct, winRate, totalTrades, wins, losses, trades: [...] }`.
 * - `expiresAt` is optional; null = never expires.
 * - Tokens are random 10-char URL-safe ids (enough entropy for a public,
 *   non-sequential handle).
 */
export const shares = mysqlTable("shares", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 32 }).notNull().unique(),
  userId: int("userId").notNull(),
  accountId: int("accountId").notNull(),
  monthKey: varchar("monthKey", { length: 16 }).notNull().default(""),
  payloadJson: text("payloadJson").notNull(),
  views: int("views").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
});
export type ShareRow = typeof shares.$inferSelect;
export type InsertShare = typeof shares.$inferInsert;
