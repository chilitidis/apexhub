import { describe, it, expect } from 'vitest';
import { monthSortValue } from './monthlyHistory';

describe('monthSortValue', () => {
  it('orders months chronologically across years', () => {
    const dec25 = { key: '2025-12', month_name: 'ΔΕΚΕΜΒΡΙΟΣ', year_full: '2025' };
    const jan26 = { key: '2026-01', month_name: 'ΙΑΝΟΥΑΡΙΟΣ', year_full: '2026' };
    const apr26 = { key: '2026-04', month_name: 'ΑΠΡΙΛΙΟΣ', year_full: '2026' };
    const may26 = { key: '2026-05', month_name: 'ΜΑΪΟΣ', year_full: '2026' };

    const arr = [jan26, dec25, may26, apr26];
    arr.sort((a, b) => monthSortValue(b) - monthSortValue(a));

    expect(arr.map(m => m.month_name)).toEqual([
      'ΜΑΪΟΣ', 'ΑΠΡΙΛΙΟΣ', 'ΙΑΝΟΥΑΡΙΟΣ', 'ΔΕΚΕΜΒΡΙΟΣ',
    ]);
  });

  it('handles MAΪΟΣ vs MAIΟΣ spelling variants', () => {
    expect(monthSortValue({ key: '', month_name: 'ΜΑΪΟΣ', year_full: '2026' })).toBe(202605);
    expect(monthSortValue({ key: '', month_name: 'ΜΑΙΟΣ', year_full: '2026' })).toBe(202605);
  });

  it('falls back to parsing the key when name is unknown', () => {
    expect(monthSortValue({ key: '2026-07', month_name: '', year_full: '' })).toBe(202607);
  });

  it('returns 0 when nothing usable is provided', () => {
    expect(monthSortValue({ key: '', month_name: '', year_full: '' })).toBe(0);
  });
});
