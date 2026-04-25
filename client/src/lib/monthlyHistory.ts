// monthlyHistory.ts — Monthly history management for APEXHUB Trading Journal
// Stores multiple months of trading data in localStorage

import type { TradingData } from './trading';
import { HISTORICAL_MONTHS } from './historicalMonths';
import { computeKPIs } from './trading';

export interface MonthSnapshot {
  key: string;           // e.g. "2026-04"
  month_name: string;    // e.g. "ΑΠΡΙΛΙΟΣ"
  year_full: string;     // e.g. "2026"
  year_short: string;    // e.g. "26"
  starting: number;
  ending: number;
  net_result: number;
  return_pct: number;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  max_drawdown_pct: number;
  // Serialized trades for full reload
  trades_json: string;
}

const STORAGE_KEY = 'apexhub_monthly_history';

export function getMonthlyHistory(): MonthSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MonthSnapshot[];
  } catch {
    return [];
  }
}

export function saveMonthToHistory(data: TradingData): MonthSnapshot {
  const { kpis, meta, trades } = data;

  // Build key from month index
  const monthOrder = [
    'ΙΑΝΟΥΑΡΙΟΣ', 'ΦΕΒΡΟΥΑΡΙΟΣ', 'ΜΑΡΤΙΟΣ', 'ΑΠΡΙΛΙΟΣ', 'ΜΑΙΟΣ', 'ΙΟΥΝΙΟΣ',
    'ΙΟΥΛΙΟΣ', 'ΑΥΓΟΥΣΤΟΣ', 'ΣΕΠΤΕΜΒΡΙΟΣ', 'ΟΚΤΩΒΡΙΟΣ', 'ΝΟΕΜΒΡΙΟΣ', 'ΔΕΚΕΜΒΡΙΟΣ',
  ];
  const monthIdx = monthOrder.indexOf(meta.month_name);
  const paddedMonth = (monthIdx + 1).toString().padStart(2, '0');
  const key = `${meta.year_full}-${paddedMonth}`;

  const snapshot: MonthSnapshot = {
    key,
    month_name: meta.month_name,
    year_full: meta.year_full,
    year_short: meta.year_short,
    starting: kpis.starting,
    ending: kpis.ending,
    net_result: kpis.net_result,
    return_pct: kpis.return_pct,
    total_trades: kpis.total_trades,
    wins: kpis.wins,
    losses: kpis.losses,
    win_rate: kpis.win_rate,
    max_drawdown_pct: kpis.max_drawdown_pct,
    trades_json: JSON.stringify(trades),
  };

  const history = getMonthlyHistory();
  const existingIdx = history.findIndex(h => h.key === key);
  if (existingIdx >= 0) {
    history[existingIdx] = snapshot;
  } else {
    history.push(snapshot);
  }

  // Sort by key descending (newest first)
  history.sort((a, b) => b.key.localeCompare(a.key));

  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  return snapshot;
}

export function deleteMonthFromHistory(key: string): void {
  const history = getMonthlyHistory().filter(h => h.key !== key);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

/**
 * Seeds the monthly history with historical months from the bundled data.
 * Only runs if the user has never seeded before (tracked via flag).
 * User can still delete individual months and they won't be re-seeded.
 */
const SEED_FLAG_KEY = 'apexhub_history_seeded_v2';

export function ensureHistoricalSeed(): MonthSnapshot[] {
  const alreadySeeded = localStorage.getItem(SEED_FLAG_KEY);
  const existing = getMonthlyHistory();

  // If never seeded before, add all historical months that don't already exist
  if (!alreadySeeded) {
    const monthOrder = [
      'ΙΑΝΟΥΑΡΙΟΣ', 'ΦΕΒΡΟΥΑΡΙΟΣ', 'ΜΑΡΤΙΟΣ', 'ΑΠΡΙΛΙΟΣ', 'ΜΑΙΟΣ', 'ΙΟΥΝΙΟΣ',
      'ΙΟΥΛΙΟΣ', 'ΑΥΓΟΥΣΤΟΣ', 'ΣΕΠΤΕΜΒΡΙΟΣ', 'ΟΚΤΩΒΡΙΟΣ', 'ΝΟΕΜΒΡΙΟΣ', 'ΔΕΚΕΜΒΡΙΟΣ',
    ];

    for (const hm of HISTORICAL_MONTHS) {
      const monthIdx = monthOrder.indexOf(hm.month_name);
      const paddedMonth = (monthIdx + 1).toString().padStart(2, '0');
      const key = `${hm.year_full}-${paddedMonth}`;

      // Skip if already exists
      if (existing.find(e => e.key === key)) continue;

      // Compute KPIs from trades
      const fullData = computeKPIs(hm.trades, hm.starting);
      saveMonthToHistory(fullData);
    }

    localStorage.setItem(SEED_FLAG_KEY, '1');
  }

  return getMonthlyHistory();
}

export function getOverallGrowthData(history: MonthSnapshot[]): Array<{
  label: string;
  balance: number;
  pnl: number;
  /** Monthly return as percentage (already x100). */
  return_pct: number;
  /** Cumulative balance growth from the first month's starting equity, in %. */
  growth_pct: number;
}> {
  if (history.length === 0) return [];

  // Sort ascending for chart
  const sorted = [...history].sort((a, b) => a.key.localeCompare(b.key));
  const baseStart = sorted[0]?.starting || 0;

  return sorted.map(h => ({
    label: h.month_name.slice(0, 3) + ' ' + h.year_short,
    balance: h.ending,
    pnl: h.net_result,
    return_pct: h.return_pct * 100,
    growth_pct: baseStart > 0 ? ((h.ending - baseStart) / baseStart) * 100 : 0,
  }));
}
