/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { buildExcelBuffer } from './exportExcel';
import { importFromExcel } from './importExcel';
import { computeKPIs } from './trading';
import type { Trade } from './trading';

// Capture the buffer that exportToExcel hands to the (mocked) downloader.
let captured: ArrayBuffer | null = null;

vi.stubGlobal('URL', {
  createObjectURL: () => 'blob:mock',
  revokeObjectURL: () => undefined,
});

const origCreateElement = document.createElement.bind(document);
vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
  if (tag === 'a') {
    const fakeA = origCreateElement('a') as HTMLAnchorElement;
    Object.defineProperty(fakeA, 'click', { value: () => undefined });
    return fakeA;
  }
  return origCreateElement(tag);
});

// Patch Blob to capture the buffer
const origBlob = global.Blob;
class CapturingBlob extends origBlob {
  constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
    super(parts, opts);
    const part = parts[0];
    if (part instanceof ArrayBuffer) captured = part;
  }
}
// @ts-ignore
global.Blob = CapturingBlob;

function makeTrade(idx: number, partial: Partial<Trade> = {}): Trade {
  return {
    idx,
    day: 'ΔΕΥ',
    open: '2026-04-06T08:00:00.000Z',
    close_time: '2026-04-06T09:30:00.000Z',
    symbol: 'EURUSD',
    direction: 'BUY',
    lots: 0.5,
    entry: 1.0850,
    close: 1.0900,
    sl: 1.0820,
    tp: 1.0950,
    trade_r: null,
    pnl: 250,
    swap: 0,
    commission: -5,
    net_pct: 0.0005,
    tf: 'H1',
    chart_before: '',
    chart_after: '',
    ...partial,
  };
}

describe('importFromExcel — round-trip with exporter', () => {
  it('preserves trades, starting balance, and notes through export → import', async () => {
    captured = null;
    const trades: Trade[] = [
      makeTrade(1, {
        pre_checklist: '• HTF aligned\n• Liquidity sweep confirmed',
        psychology: 'Calm, followed plan',
        lessons_learned: 'Trail stop wider next time',
      }),
      makeTrade(2, {
        symbol: 'GBPUSD',
        direction: 'SELL',
        pnl: -120,
        psychology: 'Was rushed',
      }),
    ];
    const data = computeKPIs(trades, 100_000);
    data.meta = {
      ...data.meta,
      month_name: 'ΑΠΡΙΛΙΟΣ',
      year_full: '2026',
      year_short: '26',
    };

    const buf = await buildExcelBuffer(data);
    expect(buf).toBeDefined();

    const file = new File([buf], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const result = await importFromExcel(file);
    expect(result.data.meta.month_name).toBe('ΑΠΡΙΛΙΟΣ');
    expect(result.data.meta.year_full).toBe('2026');
    expect(result.data.kpis.starting).toBe(100_000);
    expect(result.data.trades).toHaveLength(2);
    expect(result.data.trades[0].symbol).toBe('EURUSD');
    expect(result.data.trades[0].pre_checklist).toContain('HTF aligned');
    expect(result.data.trades[0].psychology).toBe('Calm, followed plan');
    expect(result.data.trades[0].lessons_learned).toContain('Trail stop');
    expect(result.data.trades[1].direction).toBe('SELL');
    expect(result.data.trades[1].psychology).toBe('Was rushed');
  });

  it('returns a warning when no trades are found', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Journal');
    ws.getCell('B2').value = '◆ TRADING JOURNAL · ΜΑΙΟΣ 2026';
    ws.getCell('B8').value = 50000;
    ws.getCell('B13').value = 'DAY';
    const buf = await wb.xlsx.writeBuffer();
    const file = new File([buf as ArrayBuffer], 'empty.xlsx');
    const result = await importFromExcel(file);
    expect(result.data.trades).toHaveLength(0);
    expect(result.warnings.some(w => w.includes('Δεν βρέθηκαν trades'))).toBe(true);
    expect(result.data.meta.month_name).toBe('ΜΑΙΟΣ');
    expect(result.data.meta.year_full).toBe('2026');
  });
});
