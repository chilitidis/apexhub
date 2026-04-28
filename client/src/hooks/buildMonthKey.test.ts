import { describe, it, expect } from 'vitest';
import { dataToSnapshotInput } from './useJournal';
import { computeKPIs } from '@/lib/trading';

describe('dataToSnapshotInput / buildMonthKey', () => {
  function makeData(monthName: string, yearFull: string) {
    const base = computeKPIs([], 1000);
    return {
      ...base,
      meta: {
        ...base.meta,
        month_name: monthName,
        year_full: yearFull,
        year_short: yearFull.slice(-2),
      },
    };
  }

  it.each([
    ['ΙΑΝΟΥΑΡΙΟΣ', '2026', '2026-01'],
    ['ΦΕΒΡΟΥΑΡΙΟΣ', '2026', '2026-02'],
    ['ΜΑΡΤΙΟΣ', '2026', '2026-03'],
    ['ΑΠΡΙΛΙΟΣ', '2026', '2026-04'],
    ['ΜΑΪΟΣ', '2026', '2026-05'], // with dialytika
    ['ΜΑΙΟΣ', '2026', '2026-05'], // without dialytika
    ['ΔΕΚΕΜΒΡΙΟΣ', '2025', '2025-12'],
  ])('builds key %s %s → %s', (name, year, expected) => {
    const out = dataToSnapshotInput(7, makeData(name, year));
    expect(out.monthKey).toBe(expected);
  });

  it('throws (does NOT silently produce YYYY-00) when month name is unknown', () => {
    expect(() => dataToSnapshotInput(7, makeData('ΓΑΡΥΦΑΛΛΟΣ', '2026'))).toThrow(/Unknown Greek month name/);
  });

  it('handles whitespace and lowercase variants', () => {
    expect(dataToSnapshotInput(7, makeData(' απρίλιος ', '2026')).monthKey).toBe('2026-04');
  });
});
