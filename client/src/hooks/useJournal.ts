// useJournal.ts — server-backed persistence for monthly snapshots and active
// trade, scoped to a single trading account.
//
// Multi-account model
// -------------------
// Every piece of journal data (monthly snapshots, trade rows, active trade) is
// keyed by (userId, accountId). Callers therefore MUST pass an `accountId`
// so we can only ever read/write one account at a time. The accounts list
// itself lives in the companion hook `useAccounts()` below.

import { useAuth } from "@/_core/hooks/useAuth";
import { DEMO_MODE } from "@/const";
import { monthSortValue } from "@/lib/monthlyHistory";
import { type TradingData } from "@/lib/trading";
import { trpc } from "@/lib/trpc";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

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

export interface TradingAccount {
  id: number;
  name: string;
  startingBalance: number;
  accountType: "prop" | "live" | "demo" | "other";
  currency: string;
  color: string;
  archivedAt: Date | null;
  createdAt: Date;
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

function normalizeGreek(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

const MONTH_ORDER_NORMALIZED = MONTH_ORDER.map(normalizeGreek);

function buildMonthKey(monthName: string, yearFull: string): string {
  const idx = MONTH_ORDER_NORMALIZED.indexOf(normalizeGreek(monthName));
  if (idx < 0) {
    throw new Error(
      `[buildMonthKey] Unknown Greek month name: ${JSON.stringify(monthName)}. ` +
        `Expected one of: ${MONTH_ORDER.join(", ")}.`,
    );
  }
  const padded = (idx + 1).toString().padStart(2, "0");
  return `${yearFull}-${padded}`;
}

export function dataToSnapshotInput(accountId: number, data: TradingData) {
  const { kpis, meta, trades } = data;
  const monthKey = buildMonthKey(meta.month_name, meta.year_full);
  return {
    accountId,
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

// ---- LocalStorage fallback (anonymous-only, pre-login) ---------------------

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

// ---- useAccounts — lifecycle helpers for the account catalog --------------

export function useAccounts() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const query = trpc.accounts.list.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const createMutation = trpc.accounts.create.useMutation({
    onSuccess: () => utils.accounts.list.invalidate(),
  });
  const updateMutation = trpc.accounts.update.useMutation({
    onSuccess: () => utils.accounts.list.invalidate(),
  });
  const deleteMutation = trpc.accounts.delete.useMutation({
    onSuccess: () => utils.accounts.list.invalidate(),
  });

  const accounts = useMemo<TradingAccount[]>(() => {
    const rows = (query.data ?? []) as TradingAccount[];
    return rows.filter((a) => !a.archivedAt);
  }, [query.data]);

  return {
    accounts,
    isLoading: query.isLoading,
    createAccount: async (input: {
      name: string;
      startingBalance: number;
      accountType: "prop" | "live" | "demo" | "other";
      currency: string;
      color: string;
    }) => {
      try {
        return await createMutation.mutateAsync(input);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Αποτυχία δημιουργίας λογαριασμού: ${msg}`);
        throw err;
      }
    },
    updateAccount: async (input: {
      accountId: number;
      name?: string;
      startingBalance?: number;
      accountType?: "prop" | "live" | "demo" | "other";
      currency?: string;
      color?: string;
    }) => {
      try {
        return await updateMutation.mutateAsync(input);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Αποτυχία ενημέρωσης λογαριασμού: ${msg}`);
        throw err;
      }
    },
    deleteAccount: async (accountId: number) => {
      try {
        return await deleteMutation.mutateAsync({ accountId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Αποτυχία διαγραφής λογαριασμού: ${msg}`);
        throw err;
      }
    },
    refresh: () => utils.accounts.list.invalidate(),
  };
}

// ---- useJournal — scoped to a single account ------------------------------

export function useJournal(accountId: number | null) {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const enabled = isAuthenticated && typeof accountId === "number" && accountId > 0;

  const snapshotsQuery = trpc.journal.listSnapshots.useQuery(
    enabled ? { accountId: accountId! } : (undefined as never),
    {
      enabled,
      refetchOnWindowFocus: false,
      retry: false,
    },
  );

  const activeTradeQuery = trpc.journal.getActiveTrade.useQuery(
    enabled ? { accountId: accountId! } : (undefined as never),
    {
      enabled,
      refetchOnWindowFocus: false,
      retry: false,
    },
  );

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

  const monthlyHistory = useMemo<MonthSnapshot[]>(() => {
    if (enabled && snapshotsQuery.data) {
      return snapshotsQuery.data
        .map(rowToSnapshot)
        .sort((a, b) => monthSortValue(b) - monthSortValue(a));
    }
    if (!isAuthenticated) {
      // Anonymous-only fallback, same shape as before.
      return lsGetHistory().sort((a, b) => monthSortValue(b) - monthSortValue(a));
    }
    return [];
  }, [enabled, snapshotsQuery.data, isAuthenticated]);

  const activeTrade = useMemo<ActiveTrade | null>(() => {
    if (enabled) {
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
    if (!isAuthenticated) return lsGetActive();
    return null;
  }, [enabled, activeTradeQuery.data, isAuthenticated]);

  const requireAccount = useCallback((): number => {
    if (typeof accountId !== "number" || accountId <= 0) {
      throw new Error("No account selected.");
    }
    return accountId;
  }, [accountId]);

  const saveMonth = useCallback(
    async (data: TradingData) => {
      if (enabled) {
        const input = dataToSnapshotInput(requireAccount(), data);
        try {
          await upsertMutation.mutateAsync(input);
          return;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(`Αποτυχία αποθήκευσης μήνα: ${msg}`);
          throw err;
        }
      }
      if (DEMO_MODE || isAuthenticated) {
        throw new Error("No account selected for save.");
      }
      const input = dataToSnapshotInput(-1, data);
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
    [enabled, upsertMutation, isAuthenticated, requireAccount],
  );

  const deleteMonth = useCallback(
    async (monthKey: string) => {
      if (enabled) {
        try {
          await deleteMutation.mutateAsync({
            accountId: requireAccount(),
            monthKey,
          });
          return;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(`Αποτυχία διαγραφής μήνα: ${msg}`);
          throw err;
        }
      }
      if (DEMO_MODE || isAuthenticated) {
        throw new Error("No account selected for delete.");
      }
      const history = lsGetHistory().filter((h) => h.key !== monthKey);
      lsSaveHistory(history);
    },
    [enabled, deleteMutation, isAuthenticated, requireAccount],
  );

  const saveActiveTrade = useCallback(
    async (t: ActiveTrade) => {
      if (enabled) {
        try {
          await upsertActiveMutation.mutateAsync({
            ...t,
            accountId: requireAccount(),
          });
          return;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(`Αποτυχία active trade save: ${msg}`);
          throw err;
        }
      }
      if (DEMO_MODE || isAuthenticated) {
        throw new Error("No account selected for active trade save.");
      }
      lsSaveActive(t);
    },
    [enabled, upsertActiveMutation, isAuthenticated, requireAccount],
  );

  const clearActiveTrade = useCallback(async () => {
    if (enabled) {
      try {
        await deleteActiveMutation.mutateAsync({ accountId: requireAccount() });
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Αποτυχία active trade clear: ${msg}`);
        throw err;
      }
    }
    if (DEMO_MODE || isAuthenticated) {
      throw new Error("No account selected for active trade clear.");
    }
    lsSaveActive(null);
  }, [enabled, deleteActiveMutation, isAuthenticated, requireAccount]);

  return {
    authLoading,
    isAuthenticated,
    user,
    accountId,
    monthlyHistory,
    activeTrade,
    isLoading:
      enabled &&
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

export function findCurrentMonthSnapshot(
  history: MonthSnapshot[],
  monthName: string,
  yearFull: string,
): MonthSnapshot | undefined {
  const key = buildMonthKey(monthName, yearFull);
  return history.find((h) => h.key === key);
}
