// Tests for the helpers used by the New Month flow.

import { describe, it, expect } from 'vitest';
import { createEmptyMonth, currencySymbol, resolveCurrency } from './trading';
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

  it('defaults currency to USD when not specified (back-compat)', () => {
    const data = createEmptyMonth('ΙΟΥΝΙΟΣ', '2026', 10000);
    expect(data.meta.currency).toBe('USD');
  });

  it('persists the chosen currency on meta when EUR is requested', () => {
    const data = createEmptyMonth('ΙΟΥΝΙΟΣ', '2026', 10000, 'EUR');
    expect(data.meta.currency).toBe('EUR');
  });
});

describe('currencySymbol / resolveCurrency', () => {
  it('falls back to USD/$ for legacy meta missing currency', () => {
    expect(resolveCurrency(undefined)).toBe('USD');
    expect(currencySymbol(undefined)).toBe('$');
    expect(resolveCurrency({})).toBe('USD');
    expect(currencySymbol({})).toBe('$');
  });

  it('returns € for EUR meta', () => {
    expect(resolveCurrency({ currency: 'EUR' })).toBe('EUR');
    expect(currencySymbol({ currency: 'EUR' })).toBe('€');
  });

  it('returns $ for USD meta', () => {
    expect(resolveCurrency({ currency: 'USD' })).toBe('USD');
    expect(currencySymbol({ currency: 'USD' })).toBe('$');
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
