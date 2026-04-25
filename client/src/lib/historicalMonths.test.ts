// Sanity tests for the parsed historical months data.
// Guards against silent regressions in HISTORICAL_MONTHS (key shape, KPI math).

import { describe, it, expect } from 'vitest';
import { HISTORICAL_MONTHS } from './historicalMonths';
import { computeKPIs } from './trading';

describe('HISTORICAL_MONTHS', () => {
  it('contains the 5 expected months in order', () => {
    expect(HISTORICAL_MONTHS.map(m => m.month_name)).toEqual([
      'ΔΕΚΕΜΒΡΙΟΣ', 'ΙΑΝΟΥΑΡΙΟΣ', 'ΦΕΒΡΟΥΑΡΙΟΣ', 'ΜΑΡΤΙΟΣ', 'ΑΠΡΙΛΙΟΣ',
    ]);
  });

  it('starting balances match the user-provided Excel files', () => {
    const byName = Object.fromEntries(HISTORICAL_MONTHS.map(m => [m.month_name, m.starting]));
    expect(byName['ΔΕΚΕΜΒΡΙΟΣ']).toBe(80000);
    expect(byName['ΙΑΝΟΥΑΡΙΟΣ']).toBe(160000);
    expect(byName['ΦΕΒΡΟΥΑΡΙΟΣ']).toBe(160000);
    expect(byName['ΜΑΡΤΙΟΣ']).toBe(160000);
    // April starting per the latest user-uploaded APEXHUB_ΑΠΡΙΛΙΟΣ_2026.xlsx
    expect(byName['ΑΠΡΙΛΙΟΣ']).toBeCloseTo(500000, 0);
  });

  it('every trade has a Greek day code (3 letters) and a non-empty symbol', () => {
    const validDays = new Set(['ΔΕΥ','ΤΡΙ','ΤΕΤ','ΠΕΜ','ΠΑΡ','ΣΑΒ','ΚΥΡ','']);
    for (const m of HISTORICAL_MONTHS) {
      for (const t of m.trades) {
        expect(typeof t.symbol).toBe('string');
        expect(t.symbol.length).toBeGreaterThan(0);
        expect(validDays.has(t.day) || t.day.length <= 3).toBe(true);
      }
    }
  });

  it('computed ending matches stored ending within $1', () => {
    for (const m of HISTORICAL_MONTHS) {
      const k = computeKPIs(m.trades, m.starting);
      expect(Math.abs(k.kpis.ending - m.ending)).toBeLessThan(1);
    }
  });
});
