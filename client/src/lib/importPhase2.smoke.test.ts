/**
 * Smoke test: feed every generated per-month workbook into the production
 * importExcel parser to confirm they are accepted and produce valid trades.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { importFromExcel } from './importExcel';

const DIR = '/home/ubuntu/journal_split/per_month';

describe('Phase 2 100K month workbooks', () => {
  const files = readdirSync(DIR).filter(f => f.endsWith('.xlsx')).sort();
  expect(files.length).toBeGreaterThan(0);

  for (const fn of files) {
    it(`imports ${fn}`, async () => {
      const buf = readFileSync(join(DIR, fn));
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      const blob = new Blob([ab], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const file = new File([blob], fn, { type: blob.type });
      const result = await importFromExcel(file);
      expect(result.data.trades.length).toBeGreaterThan(0);
      expect(result.data.kpis.starting).toBeGreaterThan(0);
      expect(result.data.meta.month_name).toBeTruthy();
      expect(Number(result.data.meta.year_full)).toBeGreaterThan(2024);
    });
  }
});
