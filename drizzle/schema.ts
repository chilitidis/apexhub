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
    // ISO 4217 currency code for the starting balance, defaults to USD for
    // legacy rows that predate this column.
    currency: varchar("currency", { length: 8 }).notNull().default("USD"),
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
    // Serialized array of Adjustment objects (withdrawals + deposits) for the
    // month. NULL/legacy rows are treated as empty by the application. Affects
    // ending balance only — never enters trade KPIs (win rate, R, profit factor).
    // Nullable because TiDB does not support DEFAULT for TEXT columns.
    adjustmentsJson: text("adjustmentsJson"),
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

/**
 * MetaApi MT5/MT4 broker connections — one row per (user, server, login).
 * Stores credentials encrypted with AES-256-GCM keyed off JWT_SECRET.
 *
 * `metaapiAccountId` is the MetaApi-side account UUID returned by
 * `metatraderAccountApi.createAccount(...)`. It is the handle we use to
 * deploy / undeploy / fetch deals on behalf of the user.
 *
 * `state` mirrors MetaApi terminology: 'pending' (just inserted, not yet
 * provisioned), 'connecting' (deploy + waitConnected in flight),
 * 'connected' (deals can be fetched), 'error' (last sync failed —
 * `lastError` carries the message).
 */
export const mt5Accounts = mysqlTable(
  "mt5_accounts",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    accountId: int("accountId").notNull(),
    name: varchar("name", { length: 128 }).notNull().default(""),
    platform: mysqlEnum("platform", ["mt4", "mt5"]).notNull().default("mt5"),
    server: varchar("server", { length: 128 }).notNull(),
    login: varchar("login", { length: 64 }).notNull(),
    // AES-256-GCM ciphertext as base64; format: iv(12) | tag(16) | ct.
    passwordCipher: text("passwordCipher").notNull(),
    metaapiAccountId: varchar("metaapiAccountId", { length: 128 }).notNull().default(""),
    state: varchar("state", { length: 32 }).notNull().default("pending"),
    lastError: text("lastError"),
    lastSyncedAt: timestamp("lastSyncedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    uniqUserLoginServer: uniqueIndex("uniq_user_login_server").on(
      table.userId,
      table.server,
      table.login,
    ),
  }),
);
export type Mt5AccountRow = typeof mt5Accounts.$inferSelect;
export type InsertMt5Account = typeof mt5Accounts.$inferInsert;


/**
 * Subscription state — one row per user. We follow the Stripe-recommended
 * "store IDs, not duplicated data" principle: we keep the Stripe customer and
 * subscription IDs plus a small cached projection of the fields the paywall
 * reads on every request (status + period/trial end). Everything else is
 * fetched from Stripe on demand.
 *
 * `status` mirrors Stripe subscription statuses: trialing | active |
 * past_due | canceled | incomplete | incomplete_expired | unpaid | paused.
 * We treat `trialing` and `active` as "has access"; anything else is locked.
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 64 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 64 }),
  // Cached for fast paywall checks; the webhook keeps it fresh.
  status: varchar("status", { length: 32 }).notNull().default("none"),
  // Unix ms. End of current paid/trial period.
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  trialEnd: timestamp("trialEnd"),
  cancelAtPeriodEnd: int("cancelAtPeriodEnd").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;



/**
 * Trading Coach analyses — one row per screenshot the user submits to the AI
 * Trading Coach. We deliberately DO NOT store the screenshot bytes (no base64,
 * no data URL): only the structured result the UI renders. The image is sent
 * to the vision model in-flight and discarded.
 *
 * `criteriaJson` is a JSON array of `{ id, label, status, note }` matching the
 * CoachCriterionResult shape in shared/tradingCoach.ts.
 */
export const coachAnalyses = mysqlTable("coach_analyses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Optional: which journal/account the analysis was run from (0 = none).
  accountId: int("accountId").notNull().default(0),
  score: int("score").notNull().default(0),
  verdict: varchar("verdict", { length: 16 }).notNull().default("unsuitable"),
  pair: varchar("pair", { length: 24 }).notNull().default(""),
  timeframe: varchar("timeframe", { length: 24 }).notNull().default(""),
  direction: varchar("direction", { length: 8 }).notNull().default("unknown"),
  // What the model observed before judging (observe-before-judge).
  observations: text("observations").notNull().default(""),
  // Numeric risk/reward read from Entry & SL, e.g. "1:2.4".
  rr: varchar("rr", { length: 24 }).notNull().default(""),
  // Day + session read from the chart timestamp (Greece time).
  timeAnalysis: varchar("timeAnalysis", { length: 200 }).notNull().default(""),
  // Optional, non-scored Elliott observation.
  elliottNote: varchar("elliottNote", { length: 320 }).notNull().default(""),
  comment: text("comment").notNull(),
  suggestion: text("suggestion").notNull(),
  criteriaJson: text("criteriaJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CoachAnalysisRow = typeof coachAnalyses.$inferSelect;
export type InsertCoachAnalysis = typeof coachAnalyses.$inferInsert;

/**
 * Follow-up chat messages tied to a coach analysis. Lets the subscriber ask
 * the Coach what to fix / what to do. We store only the text turns; the
 * screenshot context is re-supplied to the model in-flight and never stored.
 */
export const coachMessages = mysqlTable("coach_messages", {
  id: int("id").autoincrement().primaryKey(),
  analysisId: int("analysisId").notNull(),
  userId: int("userId").notNull(),
  role: varchar("role", { length: 16 }).notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CoachMessageRow = typeof coachMessages.$inferSelect;
export type InsertCoachMessage = typeof coachMessages.$inferInsert;


/**
 * User feedback / feature requests. Lets any signed-in user tell us what they
 * want added or changed on the site. We store only the submitted text plus a
 * lightweight category and status so the owner can triage from the Admin panel.
 *
 * `category` is a small fixed set: 'feature' (add something), 'improvement'
 * (change/upgrade something), 'bug' (something is broken), 'other'.
 * `status` lets the owner mark progress: 'new' | 'planned' | 'done' | 'dismissed'.
 * We denormalise the submitter's name/email at insert time so the Admin list
 * stays readable even if the user row changes later.
 */
export const feedback = mysqlTable("feedback", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 256 }).notNull().default(""),
  userEmail: varchar("userEmail", { length: 320 }).notNull().default(""),
  category: varchar("category", { length: 24 }).notNull().default("feature"),
  message: text("message").notNull(),
  status: varchar("status", { length: 24 }).notNull().default("new"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FeedbackRow = typeof feedback.$inferSelect;
export type InsertFeedback = typeof feedback.$inferInsert;

/**
 * Prop Firm Tracker — saved accounts a user is monitoring.
 * firmName/programName/sizeUsd identify the rule set in shared/propFirms.ts.
 */
export const propFirmAccounts = mysqlTable("prop_firm_accounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  firmName: varchar("firmName", { length: 64 }).notNull(),
  programName: varchar("programName", { length: 96 }).notNull(),
  sizeUsd: int("sizeUsd").notNull(),
  phase: mysqlEnum("phase", ["eval", "funded"]).default("eval").notNull(),
  label: varchar("label", { length: 120 }).notNull().default(""),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PropFirmAccount = typeof propFirmAccounts.$inferSelect;
export type InsertPropFirmAccount = typeof propFirmAccounts.$inferInsert;

/**
 * Prop Firm Tracker — per-user singleton state (currency, checklist, notes).
 * Stored as one row per user; JSON-ish fields kept as text.
 */
export const propFirmState = mysqlTable("prop_firm_state", {
  userId: int("userId").primaryKey(),
  currency: mysqlEnum("currency", ["USD", "EUR"]).default("USD").notNull(),
  checks: text("checks").notNull().default(""),
  notes: text("notes").notNull().default(""),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PropFirmState = typeof propFirmState.$inferSelect;
export type InsertPropFirmState = typeof propFirmState.$inferInsert;
