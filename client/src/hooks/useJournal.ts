// useJournal.ts — server-backed persistence for monthly snapshots and active trade.
//
// Provides:
//   - monthlyHistory: MonthSnapshot[] (always sorted desc by key, same shape as the
//     legacy localStorage helpers consumed)
//   - activeTrade: ActiveTrade | null
//   - saveMonth(data), deleteMonth(key), saveActiveTrade(t), clearActiveTrade()
//
// When the user is logged in (tRPC queries succeed), state is server-backed and
// survives reloads/devices. When not authenticated (e.g. anonymous visitors), we
// transparently fall back to localStorage so the page remains usable.

import { useAuth } from "@/_core/hooks/useAuth";
import { HISTORICAL_MONTHS } from "@/lib/historicalMonths";
import { monthSortValue } from "@/lib/monthlyHistory";
import { computeKPIs, type TradingData } from "@/lib/trading";
import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useMemo } from "react";

// ---- Shared UI types (kept identical to legacy shape) ---------------------

export interface MonthSnapshot {
  key: string; // "2026-04"
  month_name: string;
  year_full: string;
  year_short: string;
  starting: number;
  ending: number;
  net_result: number;
  return_pct: number;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  max_drawdown_pct: number;
  trades_json: string;
}

export interface ActiveTrade {
  symbol: string;
  direction: "BUY" | "SELL";
  lots: number;
  entry: number;
  currentPrice: number;
  openTime: string;
  floatingPnl: number;
  balance: number;
}

// ---- Helpers --------------------------------------------------------------

const MONTH_ORDER = [
  "ΙΑΝΟΥΑΡΙΟΣ",
  "ΦΕΒΡΟΥΑΡΙΟΣ",
  "ΜΑΡΤΙΟΣ",
  "ΑΠΡΙΛΙΟΣ",
  "ΜΑΙΟΣ",
  "ΙΟΥΝΙΟΣ",
  "ΙΟΥΛΙΟΣ",
  "ΑΥΓΟΥΣΤΟΣ",
  "ΣΕΠΤΕΜΒΡΙΟΣ",
  "ΟΚΤΩΒΡΙΟΣ",
  "ΝΟΕΜΒΡΙΟΣ",
  "ΔΕΚΕΜΒΡΙΟΣ",
];

function buildMonthKey(monthName: string, yearFull: string): string {
  const idx = MONTH_ORDER.indexOf(monthName);
  const padded = (idx + 1).toString().padStart(2, "0");
  return `${yearFull}-${padded}`;
}

export function dataToSnapshotInput(data: TradingData) {
  const { kpis, meta, trades } = data;
  const monthKey = buildMonthKey(meta.month_name, meta.year_full);
  return {
    monthKey,
    monthName: meta.month_name,
    yearFull: meta.year_full,
    yearShort: meta.year_short,
    starting: kpis.starting,
    ending: kpis.ending,
    netResult: kpis.net_result,
    returnPct: kpis.return_pct,
    totalTrades: kpis.total_trades,
    wins: kpis.wins,
    losses: kpis.losses,
    winRate: kpis.win_rate,
    maxDrawdownPct: kpis.max_drawdown_pct,
    tradesJson: JSON.stringify(trades),
  };
}

// Convert a DB row (camelCase) -> MonthSnapshot (snake_case the UI already uses).
function rowToSnapshot(row: {
  monthKey: string;
  monthName: string;
  yearFull: string;
  yearShort: string;
  starting: number;
  ending: number;
  netResult: number;
  returnPct: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  maxDrawdownPct: number;
  tradesJson: string;
}): MonthSnapshot {
  return {
    key: row.monthKey,
    month_name: row.monthName,
    year_full: row.yearFull,
    year_short: row.yearShort,
    starting: Number(row.starting) || 0,
    ending: Number(row.ending) || 0,
    net_result: Number(row.netResult) || 0,
    return_pct: Number(row.returnPct) || 0,
    total_trades: Number(row.totalTrades) || 0,
    wins: Number(row.wins) || 0,
    losses: Number(row.losses) || 0,
    win_rate: Number(row.winRate) || 0,
    max_drawdown_pct: Number(row.maxDrawdownPct) || 0,
    trades_json: row.tradesJson,
  };
}

// ---- LocalStorage fallback -------------------------------------------------
// Kept so the page still works for anonymous visitors.

const LS_HISTORY_KEY = "apexhub_monthly_history";
const LS_ACTIVE_KEY = "apexhub_active_trade";

function lsGetHistory(): MonthSnapshot[] {
  try {
    const raw = localStorage.getItem(LS_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MonthSnapshot[];
  } catch {
    return [];
  }
}
function lsSaveHistory(history: MonthSnapshot[]) {
  localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(history));
}
function lsGetActive(): ActiveTrade | null {
  try {
    const raw = localStorage.getItem(LS_ACTIVE_KEY);
    return raw ? (JSON.parse(raw) as ActiveTrade) : null;
  } catch {
    return null;
  }
}
function lsSaveActive(t: ActiveTrade | null) {
  if (t === null) localStorage.removeItem(LS_ACTIVE_KEY);
  else localStorage.setItem(LS_ACTIVE_KEY, JSON.stringify(t));
}

// ---- Seed helper (runs once per authenticated user) ------------------------

// v2 = re-seed with real data parsed from the user's uploaded Excel files
//      (Δεκ 2025 - Απρ 2026). Bumping the version forces a one-time refresh
//      that overwrites any previously seeded months while leaving the
//      currently-active month (where the user is adding trades) untouched.
const SERVER_SEED_FLAG_PREFIX = "apexhub_server_seeded_v4_";

function serverSeedKey(userId: number | string): string {
  return `${SERVER_SEED_FLAG_PREFIX}${userId}`;
}

// Months that we always (re)seed from HISTORICAL_MONTHS. The currently-
// active month is treated separately so that user-added trades there are
// never overwritten.
function historicalKey(hm: { month_name: string; year_full: string }): string {
  const monthOrder = [
    "ΙΑΝΟΥΑΡΙΟΣ", "ΦΕΒΡΟΥΑΡΙΟΣ", "ΜΑΡΤΙΟΣ", "ΑΠΡΙΛΙΟΣ",
    "ΜΑΪΟΣ", "ΙΟΥΝΙΟΣ", "ΙΟΥΛΙΟΣ", "ΑΥΓΟΥΣΤΟΣ", "ΣΕΠΤΕΜΒΡΙΟΣ",
    "ΟΚΤΩΒΡΙΟΣ", "ΝΟΕΜΒΡΙΟΣ", "ΔΕΚΕΜΒΡΙΟΣ",
  ];
  const idx = monthOrder.indexOf(hm.month_name);
  const padded = (idx + 1).toString().padStart(2, "0");
  return `${hm.year_full}-${padded}`;
}

// ---- Hook ------------------------------------------------------------------

export function useJournal() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  // Snapshots query — enabled only when authenticated.
  const snapshotsQuery = trpc.journal.listSnapshots.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const activeTradeQuery = trpc.journal.getActiveTrade.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const upsertMutation = trpc.journal.upsertSnapshot.useMutation({
    onSuccess: () => utils.journal.listSnapshots.invalidate(),
  });
  const deleteMutation = trpc.journal.deleteSnapshot.useMutation({
    onSuccess: () => utils.journal.listSnapshots.invalidate(),
  });
  const upsertActiveMutation = trpc.journal.upsertActiveTrade.useMutation({
    onSuccess: () => utils.journal.getActiveTrade.invalidate(),
  });
  const deleteActiveMutation = trpc.journal.deleteActiveTrade.useMutation({
    onSuccess: () => utils.journal.getActiveTrade.invalidate(),
  });

  // First-run seed: when user just logged in and has no snapshots yet,
  // push the bundled HISTORICAL_MONTHS to the server so their account
  // starts with data. We gate this with a per-user, *versioned* localStorage
  // flag so:
  //   - Subsequent deletions are never revived (same version → no-op).
  //   - When we publish a new HISTORICAL_MONTHS dataset (version bumped),
  //     every previously seeded month is overwritten with the new data.
  //   - The user's currently-active month (where they are adding trades) is
  //     never overwritten by a re-seed.
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (snapshotsQuery.isLoading) return;
    if (snapshotsQuery.data === undefined) return;

    const flagKey = serverSeedKey((user as { id: number | string }).id);
    if (localStorage.getItem(flagKey)) return;

    // Determine which keys we already have on the server so we can decide
    // case-by-case whether to overwrite (historical re-seed) or skip
    // (active month with user-added trades).
    const existingKeys = new Set(
      snapshotsQuery.data.map((s) => s.monthKey as string),
    );
    // Build a per-key trade-count map so we can detect snapshots that the
    // user accidentally cleared (e.g. by typing a duplicate month into the
    // New Month modal before we added the duplicate guard). Those should be
    // safely repopulated from HISTORICAL_MONTHS even if they currently exist
    // on the server. We only skip overwriting when the server has *more*
    // trades than our seed (i.e. the user added new ones manually).
    const tradeCountByKey = new Map<string, number>();
    for (const s of snapshotsQuery.data) {
      tradeCountByKey.set(s.monthKey as string, (s.totalTrades as number) ?? 0);
    }

    (async () => {
      for (const hm of HISTORICAL_MONTHS) {
        const key = historicalKey(hm);
        const serverCount = tradeCountByKey.get(key) ?? 0;
        const seedCount = hm.trades.length;
        // If the server already has at least as many trades as our seed,
        // assume the user has been working in that month and leave it alone.
        // Otherwise, the snapshot is empty/stale (or never existed) → seed it.
        if (existingKeys.has(key) && serverCount >= seedCount && seedCount > 0) continue;
        try {
          const fullData = computeKPIs(hm.trades, hm.starting);
          const input = dataToSnapshotInput({
            ...fullData,
            meta: {
              ...fullData.meta,
              month_name: hm.month_name,
              year_full: hm.year_full,
              year_short: hm.year_short,
            },
          });
          await upsertMutation.mutateAsync(input);
        } catch (e) {
          console.warn("[journal seed] failed for", hm.month_name, e);
        }
      }
      localStorage.setItem(flagKey, "1");
      utils.journal.listSnapshots.invalidate();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, snapshotsQuery.isLoading, snapshotsQuery.data]);

  // Build derived state.
  const monthlyHistory = useMemo<MonthSnapshot[]>(() => {
    if (isAuthenticated && snapshotsQuery.data) {
      return snapshotsQuery.data
        .map(rowToSnapshot)
        .sort((a, b) => monthSortValue(b) - monthSortValue(a));
    }
    return lsGetHistory().sort((a, b) => monthSortValue(b) - monthSortValue(a));
  }, [isAuthenticated, snapshotsQuery.data]);

  const activeTrade = useMemo<ActiveTrade | null>(() => {
    if (isAuthenticated) {
      const row = activeTradeQuery.data;
      if (!row) return null;
      return {
        symbol: row.symbol,
        direction: row.direction as "BUY" | "SELL",
        lots: Number(row.lots) || 0,
        entry: Number(row.entry) || 0,
        currentPrice: Number(row.currentPrice) || 0,
        openTime: row.openTime || "",
        floatingPnl: Number(row.floatingPnl) || 0,
        balance: Number(row.balance) || 0,
      };
    }
    return lsGetActive();
  }, [isAuthenticated, activeTradeQuery.data]);

  // Mutations.
  const saveMonth = useCallback(
    async (data: TradingData) => {
      const input = dataToSnapshotInput(data);
      if (isAuthenticated) {
        await upsertMutation.mutateAsync(input);
        return;
      }
      // fallback: localStorage
      const snap: MonthSnapshot = {
        key: input.monthKey,
        month_name: input.monthName,
        year_full: input.yearFull,
        year_short: input.yearShort,
        starting: input.starting,
        ending: input.ending,
        net_result: input.netResult,
        return_pct: input.returnPct,
        total_trades: input.totalTrades,
        wins: input.wins,
        losses: input.losses,
        win_rate: input.winRate,
        max_drawdown_pct: input.maxDrawdownPct,
        trades_json: input.tradesJson,
      };
      const history = lsGetHistory();
      const existing = history.findIndex((h) => h.key === snap.key);
      if (existing >= 0) history[existing] = snap;
      else history.push(snap);
      history.sort((a, b) => monthSortValue(b) - monthSortValue(a));
      lsSaveHistory(history);
    },
    [isAuthenticated, upsertMutation],
  );

  const deleteMonth = useCallback(
    async (monthKey: string) => {
      if (isAuthenticated) {
        await deleteMutation.mutateAsync({ monthKey });
        return;
      }
      const history = lsGetHistory().filter((h) => h.key !== monthKey);
      lsSaveHistory(history);
    },
    [isAuthenticated, deleteMutation],
  );

  const saveActiveTrade = useCallback(
    async (t: ActiveTrade) => {
      if (isAuthenticated) {
        await upsertActiveMutation.mutateAsync(t);
        return;
      }
      lsSaveActive(t);
    },
    [isAuthenticated, upsertActiveMutation],
  );

  const clearActiveTrade = useCallback(async () => {
    if (isAuthenticated) {
      await deleteActiveMutation.mutateAsync();
      return;
    }
    lsSaveActive(null);
  }, [isAuthenticated, deleteActiveMutation]);

  return {
    authLoading,
    isAuthenticated,
    user,
    monthlyHistory,
    activeTrade,
    isLoading:
      isAuthenticated &&
      (snapshotsQuery.isLoading || activeTradeQuery.isLoading),
    saveMonth,
    deleteMonth,
    saveActiveTrade,
    clearActiveTrade,
    refresh: () => {
      utils.journal.listSnapshots.invalidate();
      utils.journal.getActiveTrade.invalidate();
    },
  };
}

// Helper that a consumer can use to build a blank "current month" TradingData
// when there is no snapshot for the current month yet.
export function findCurrentMonthSnapshot(
  history: MonthSnapshot[],
  monthName: string,
  yearFull: string,
): MonthSnapshot | undefined {
  const key = buildMonthKey(monthName, yearFull);
  return history.find((h) => h.key === key);
}
