// Regression tests for `buildExportFilename` — the helper that decides the
// downloaded `.xlsx` filename. The multi-account rollout introduced an optional
// `accountName` so the user can tell exports from different accounts apart.

import { describe, it, expect } from 'vitest';
import { buildExportFilename } from './exportExcel';
import type { TradingData } from './trading';

function mkData(month: string, year: string): TradingData {
  return {
    meta: {
      title: '',
      subtitle: '',
      month_name: month,
      year_full: year,
      year_short: year.slice(-2),
      last_sync: '',
      starting_balance: 0,
      current_balance: 0,
    },
    kpis: {} as any,
    trades: [],
  } as unknown as TradingData;
}

describe('buildExportFilename', () => {
  it('omits the account slug when no account name is provided', () => {
    const name = buildExportFilename(mkData('ΑΠΡΙΛΙΟΣ', '2026'));
    expect(name).toBe('UltimateTradingJournal_ΑΠΡΙΛΙΟΣ_2026.xlsx');
  });

  it('embeds a sanitized account slug when provided', () => {
    const name = buildExportFilename(
      mkData('ΑΠΡΙΛΙΟΣ', '2026'),
      'Prop 100k Challenge',
    );
    expect(name).toBe(
      'UltimateTradingJournal_Prop-100k-Challenge_ΑΠΡΙΛΙΟΣ_2026.xlsx',
    );
  });

  it('strips Greek accents / non-ASCII from the slug', () => {
    const name = buildExportFilename(
      mkData('ΑΠΡΙΛΙΟΣ', '2026'),
      'Προσωπικός Live',
    );
    // Greek letters are removed by NFKD + non-ASCII strip; whatever remains
    // collapses to hyphens. The important invariant is: no Greek survives in
    // the slug segment, so the filename is safe for every OS.
    expect(name.startsWith('UltimateTradingJournal_')).toBe(true);
    expect(name.endsWith('_ΑΠΡΙΛΙΟΣ_2026.xlsx')).toBe(true);
    expect(/[\u0370-\u03ff]/.test(name.split('_')[1] ?? '')).toBe(false);
  });

  it('collapses unsafe filesystem chars (slashes, colons) to a single hyphen', () => {
    const name = buildExportFilename(
      mkData('ΑΠΡΙΛΙΟΣ', '2026'),
      'Prop/FTMO: Phase 2',
    );
    expect(name).toBe(
      'UltimateTradingJournal_Prop-FTMO-Phase-2_ΑΠΡΙΛΙΟΣ_2026.xlsx',
    );
  });

  it('drops an account name that contains only non-ASCII chars (graceful fallback)', () => {
    const name = buildExportFilename(mkData('ΑΠΡΙΛΙΟΣ', '2026'), '📈💰');
    expect(name).toBe('UltimateTradingJournal_ΑΠΡΙΛΙΟΣ_2026.xlsx');
  });

  it('caps extremely long account names at 40 chars', () => {
    const long = 'A'.repeat(100);
    const name = buildExportFilename(mkData('ΑΠΡΙΛΙΟΣ', '2026'), long);
    const slug = name.split('_')[1] ?? '';
    expect(slug.length).toBeLessThanOrEqual(40);
  });
});
