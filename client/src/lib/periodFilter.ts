import type { Trade } from './trading';
import type { MonthSnapshot } from '@/hooks/useJournal';

export type PeriodPreset = 'all' | 'this-month' | '30d' | '60d' | '90d' | 'custom';

export interface PeriodRange {
  preset: PeriodPreset;
  from: Date | null;
  to: Date | null;
}

export const DEFAULT_PERIOD: PeriodRange = { preset: 'all', from: null, to: null };

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  all: 'All',
  'this-month': 'This Month',
  '30d': '30D',
  '60d': '60D',
  '90d': '90D',
  custom: 'Custom',
};

// -----------------------------------------------------------------------------
// Date parsing
// -----------------------------------------------------------------------------

/**
 * Parse a trade's open string into a Date.
 *
 * Supports:
 *   - ISO 8601 ("2026-04-10T09:00:00Z")
 *   - Greek short form "DD.MM HH:mm" (uses fallbackYear/fallbackMonth)
 *   - "DD.MM.YYYY HH:mm"
 *
 * When fallbackMonth is supplied (1-12) and the string contains no month,
 * we use it instead of the one in the string — useful when trades come from
 * a specific monthly snapshot and do not carry a year.
 */
function parseTradeDate(
  open: string,
  fallbackYear: number,
  fallbackMonth?: number, // 1-12
): Date | null {
  if (!open) return null;
  const iso = new Date(open);
  if (!isNaN(iso.getTime())) return iso;

  // DD.MM.YYYY HH:mm
  const mFull = open.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (mFull) {
    const day = Number(mFull[1]);
    const month = Number(mFull[2]) - 1;
    let year = Number(mFull[3]);
    if (year < 100) year += 2000;
    const hour = Number(mFull[4] ?? '0');
    const minute = Number(mFull[5] ?? '0');
    const d = new Date(year, month, day, hour, minute);
    if (!isNaN(d.getTime())) return d;
  }

  // DD.MM HH:mm (no year)
  const m = open.match(/^(\d{1,2})\.(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (m) {
    const day = Number(m[1]);
    const month = fallbackMonth ? fallbackMonth - 1 : Number(m[2]) - 1;
    const hour = Number(m[3] ?? '0');
    const minute = Number(m[4] ?? '0');
    const d = new Date(fallbackYear, month, day, hour, minute);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

// -----------------------------------------------------------------------------
// Range resolution
// -----------------------------------------------------------------------------

export function resolveRange(
  preset: PeriodPreset,
  custom?: { from?: Date | null; to?: Date | null },
): PeriodRange {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (preset) {
    case 'all':
      return { preset, from: null, to: null };
    case 'this-month': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      return { preset, from, to: endOfDay(now) };
    }
    case '30d':
    case '60d':
    case '90d': {
      const days = preset === '30d' ? 30 : preset === '60d' ? 60 : 90;
      const from = new Date(now);
      from.setDate(from.getDate() - days);
      return { preset, from: startOfDay(from), to: endOfDay(now) };
    }
    case 'custom':
      return {
        preset,
        from: custom?.from ? startOfDay(custom.from) : null,
        to: custom?.to ? endOfDay(custom.to) : null,
      };
  }
}

// -----------------------------------------------------------------------------
// Flatten snapshots → trades stamped with a reliable timestamp
// -----------------------------------------------------------------------------

export interface StampedTrade extends Trade {
  month_key: string; // "YYYY-MM"
  timestamp: number; // ms since epoch
}

/**
 * Walk every snapshot and return one flat list of trades, each stamped with
 * a reliable timestamp derived from (trade.open || trade.close_time || month).
 */
export function flattenHistoryTrades(history: MonthSnapshot[]): StampedTrade[] {
  const out: StampedTrade[] = [];
  for (const snap of history) {
    let trades: Trade[] = [];
    try {
      const arr = JSON.parse(snap.trades_json);
      if (Array.isArray(arr)) trades = arr as Trade[];
    } catch {
      continue;
    }

    const [yStr, mStr] = snap.key.split('-');
    const year = Number(yStr) || Number(snap.year_full) || new Date().getFullYear();
    const month = Number(mStr) || 1;
    // Mid-month timestamp used when the trade itself provides nothing parseable.
    const fallbackTs = new Date(year, month - 1, 15, 12, 0, 0).getTime();

    for (const t of trades) {
      const d =
        parseTradeDate(t.open, year, month) ||
        parseTradeDate(t.close_time, year, month);
      const ts = d ? d.getTime() : fallbackTs;
      out.push({ ...t, month_key: snap.key, timestamp: ts });
    }
  }
  // Sort ascending by timestamp.
  out.sort((a, b) => a.timestamp - b.timestamp);
  return out;
}

// -----------------------------------------------------------------------------
// Filter by range
// -----------------------------------------------------------------------------

export function filterStampedByRange(trades: StampedTrade[], range: PeriodRange): StampedTrade[] {
  if (range.preset === 'all' || (!range.from && !range.to)) return trades;
  const fromMs = range.from ? range.from.getTime() : -Infinity;
  const toMs = range.to ? range.to.getTime() : Infinity;
  return trades.filter((t) => t.timestamp >= fromMs && t.timestamp <= toMs);
}

// -----------------------------------------------------------------------------
// KPIs aggregated across the filtered slice
// -----------------------------------------------------------------------------

export interface PeriodKpis {
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number; // 0..1
  gross_profit: number; // sum of positive pnl
  gross_loss: number; // sum of |negative pnl|
  net_result: number;
  profit_factor: number; // gross_profit / gross_loss (Infinity if no losses)
  avg_win: number;
  avg_loss: number; // positive number
  best_trade: Trade | null;
  worst_trade: Trade | null;
  max_win_streak: number;
  max_loss_streak: number;
  max_drawdown_abs: number;
  max_drawdown_pct: number; // 0..1, relative to `base`
  /** Net result as % of `base`. If base <= 0 this is 0. */
  return_pct: number;
  /** Baseline used for percentage calcs (normally the Global Current Balance). */
  base: number;
  symbols: SymbolAggregate[];
}

export interface SymbolAggregate {
  symbol: string;
  trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  pnl: number;
  /** pnl as % of base. */
  pnl_pct: number;
}

export function aggregateKpis(trades: StampedTrade[], base: number): PeriodKpis {
  const kpis: PeriodKpis = {
    total_trades: trades.length,
    wins: 0,
    losses: 0,
    win_rate: 0,
    gross_profit: 0,
    gross_loss: 0,
    net_result: 0,
    profit_factor: 0,
    avg_win: 0,
    avg_loss: 0,
    best_trade: null,
    worst_trade: null,
    max_win_streak: 0,
    max_loss_streak: 0,
    max_drawdown_abs: 0,
    max_drawdown_pct: 0,
    return_pct: 0,
    base,
    symbols: [],
  };
  if (!trades.length) return kpis;

  let peak = 0;
  let running = 0;
  let ddAbs = 0;
  let winStreak = 0;
  let lossStreak = 0;
  const symbolMap = new Map<string, { trades: number; wins: number; losses: number; pnl: number }>();

  for (const t of trades) {
    kpis.net_result += t.pnl;
    running += t.pnl;
    peak = Math.max(peak, running);
    ddAbs = Math.max(ddAbs, peak - running);

    if (t.pnl >= 0) {
      kpis.wins += 1;
      kpis.gross_profit += t.pnl;
      winStreak += 1;
      lossStreak = 0;
      kpis.max_win_streak = Math.max(kpis.max_win_streak, winStreak);
      if (!kpis.best_trade || t.pnl > kpis.best_trade.pnl) kpis.best_trade = t;
    } else {
      kpis.losses += 1;
      kpis.gross_loss += Math.abs(t.pnl);
      lossStreak += 1;
      winStreak = 0;
      kpis.max_loss_streak = Math.max(kpis.max_loss_streak, lossStreak);
      if (!kpis.worst_trade || t.pnl < kpis.worst_trade.pnl) kpis.worst_trade = t;
    }

    const s = symbolMap.get(t.symbol) ?? { trades: 0, wins: 0, losses: 0, pnl: 0 };
    s.trades += 1;
    if (t.pnl >= 0) s.wins += 1;
    else s.losses += 1;
    s.pnl += t.pnl;
    symbolMap.set(t.symbol, s);
  }

  kpis.win_rate = kpis.total_trades > 0 ? kpis.wins / kpis.total_trades : 0;
  kpis.profit_factor = kpis.gross_loss > 0 ? kpis.gross_profit / kpis.gross_loss : kpis.gross_profit > 0 ? Infinity : 0;
  kpis.avg_win = kpis.wins > 0 ? kpis.gross_profit / kpis.wins : 0;
  kpis.avg_loss = kpis.losses > 0 ? kpis.gross_loss / kpis.losses : 0;
  kpis.max_drawdown_abs = ddAbs;
  kpis.max_drawdown_pct = base > 0 ? ddAbs / base : 0;
  kpis.return_pct = base > 0 ? kpis.net_result / base : 0;

  kpis.symbols = Array.from(symbolMap.entries())
    .map(([symbol, v]) => ({
      symbol,
      trades: v.trades,
      wins: v.wins,
      losses: v.losses,
      win_rate: v.trades > 0 ? v.wins / v.trades : 0,
      pnl: v.pnl,
      pnl_pct: base > 0 ? v.pnl / base : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl);

  return kpis;
}

// Convenience: stamp + filter + aggregate in one call.
export function computePeriodView(
  history: MonthSnapshot[],
  range: PeriodRange,
  base: number,
): { trades: StampedTrade[]; kpis: PeriodKpis } {
  const all = flattenHistoryTrades(history);
  const filtered = filterStampedByRange(all, range);
  const kpis = aggregateKpis(filtered, base);
  return { trades: filtered, kpis };
}
