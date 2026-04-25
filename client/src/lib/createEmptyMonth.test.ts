// Tests for the helpers used by the New Month flow.

import { describe, it, expect } from 'vitest';
import { createEmptyMonth } from './trading';
import { buildMonthKey } from '../components/NewMonthModal';

describe('createEmptyMonth', () => {
  it('builds zero-trade payload with the right starting balance and meta', () => {
    const data = createEmptyMonth('ΜΑΪΟΣ', '2026', 50000);
    expect(data.trades).toEqual([]);
    expect(data.kpis.starting).toBe(50000);
    expect(data.kpis.ending).toBe(50000);
    expect(data.kpis.net_result).toBe(0);
    expect(data.kpis.return_pct).toBe(0);
    expect(data.kpis.total_trades).toBe(0);
    expect(data.kpis.wins).toBe(0);
    expect(data.kpis.losses).toBe(0);
    expect(data.kpis.win_rate).toBe(0);
    expect(data.kpis.max_drawdown_pct).toBe(0);
    expect(data.meta.month_name).toBe('ΜΑΪΟΣ');
    expect(data.meta.year_full).toBe('2026');
    expect(data.meta.year_short).toBe('26');
  });

  it('does not surface a phantom best/worst trade', () => {
    const data = createEmptyMonth('ΙΟΥΝΙΟΣ', '2026', 100000);
    expect(data.kpis.best_trade.pnl).toBe(0);
    expect(data.kpis.worst_trade.pnl).toBe(0);
  });

  it('preserves the user-typed year exactly (no auto-shift to current)', () => {
    const data = createEmptyMonth('ΙΑΝΟΥΑΡΙΟΣ', '2027', 25000);
    expect(data.meta.year_full).toBe('2027');
    expect(data.meta.year_short).toBe('27');
  });
});

describe('buildMonthKey', () => {
  it('produces the canonical YYYY-MM dedupe key for every Greek month', () => {
    expect(buildMonthKey('ΙΑΝΟΥΑΡΙΟΣ', '2026')).toBe('2026-01');
    expect(buildMonthKey('ΑΠΡΙΛΙΟΣ', '2026')).toBe('2026-04');
    expect(buildMonthKey('ΜΑΪΟΣ', '2026')).toBe('2026-05');
    expect(buildMonthKey('ΔΕΚΕΜΒΡΙΟΣ', '2025')).toBe('2025-12');
  });
});
