import { computeKPIs, type Trade, type TradingData } from './trading';

export type PeriodPreset = 'all' | 'this-month' | '30d' | '60d' | '90d' | 'custom';

export interface PeriodRange {
  preset: PeriodPreset;
  from: Date | null;
  to: Date | null;
}

export const DEFAULT_PERIOD: PeriodRange = { preset: 'all', from: null, to: null };

// Helper to parse a trade's open time into a Date.
// Trades carry either ISO-ish strings or the Greek "DD.MM HH:mm" short form.
// We attempt ISO first (fast path), then fall back to DD.MM.
function parseTradeDate(open: string, fallbackYear: number): Date | null {
  if (!open) return null;
  const iso = new Date(open);
  if (!isNaN(iso.getTime())) return iso;

  const m = open.match(/^(\d{1,2})\.(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]) - 1;
    const hour = Number(m[3] ?? '0');
    const minute = Number(m[4] ?? '0');
    const d = new Date(fallbackYear, month, day, hour, minute);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export function resolveRange(preset: PeriodPreset, custom?: { from?: Date | null; to?: Date | null }): PeriodRange {
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

export function filterTradesByRange(trades: Trade[], range: PeriodRange, fallbackYear: number): Trade[] {
  if (range.preset === 'all' || (!range.from && !range.to)) return trades;
  const fromMs = range.from ? range.from.getTime() : -Infinity;
  const toMs = range.to ? range.to.getTime() : Infinity;
  return trades.filter(t => {
    const d = parseTradeDate(t.open, fallbackYear);
    if (!d) return true; // Keep trades whose date we cannot parse rather than silently hide them.
    const ms = d.getTime();
    return ms >= fromMs && ms <= toMs;
  });
}

/**
 * Produce a TradingData view restricted to a period.
 * Keeps the *original* starting balance (derived from the month's starting)
 * so KPIs are comparable, but ending/net/return reflect only the filtered set.
 */
export function applyPeriodFilter(
  full: TradingData,
  range: PeriodRange,
  fallbackYear: number,
): TradingData {
  const filtered = filterTradesByRange(full.trades, range, fallbackYear);
  if (filtered.length === full.trades.length) return full;

  const starting = full.kpis.starting;
  // Recompute on the filtered slice with the same starting balance baseline.
  const rebuilt = computeKPIs(filtered, starting);

  // Preserve the outer month labels (user is viewing the same month).
  rebuilt.meta = { ...full.meta, last_sync: rebuilt.meta.last_sync };

  return rebuilt;
}

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  all: 'All',
  'this-month': 'This Month',
  '30d': '30D',
  '60d': '60D',
  '90d': '90D',
  custom: 'Custom',
};
