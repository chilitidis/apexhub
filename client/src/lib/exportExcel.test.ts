// @vitest-environment jsdom
// Tests for the ExcelJS-based exporter. We mock the DOM download bits and
// instead read the produced workbook back through ExcelJS to assert structure.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { exportToExcel } from './exportExcel';
import type { TradingData, Trade } from './trading';

function makeTrade(over: Partial<Trade> = {}): Trade {
  return {
    idx: 1,
    day: 'ΤΡΙ',
    open: '2026-04-07T12:44:00.000Z',
    close_time: '2026-04-07T13:30:00.000Z',
    symbol: 'EURUSD',
    direction: 'BUY',
    lots: 10,
    entry: 1.085,
    close: 1.09,
    sl: 1.08,
    tp: 1.1,
    trade_r: null,
    pnl: 250,
    swap: 0,
    commission: 0,
    net_pct: 0,
    tf: 'H1',
    chart_before: 'https://www.tradingview.com/x/abc/',
    chart_after: 'https://www.tradingview.com/x/def/',
    ...over,
  };
}

function makeData(trades: Trade[]): TradingData {
  return {
    trades,
    kpis: {
      starting: 500000,
      ending: 500000 + trades.reduce((s, t) => s + t.pnl + t.swap, 0),
      net_result: trades.reduce((s, t) => s + t.pnl + t.swap, 0),
      return_pct: 0.01,
      total_trades: trades.length,
      wins: trades.filter(t => t.pnl > 0).length,
      losses: trades.filter(t => t.pnl < 0).length,
      win_rate: trades.length === 0 ? 0 : trades.filter(t => t.pnl > 0).length / trades.length,
      profit_factor: 1.5,
      avg_win: 250,
      avg_loss: 0,
      max_win_streak: 1,
      max_loss_streak: 0,
      best_trade: { pnl: 250, symbol: 'EURUSD', idx: 1 },
      worst_trade: { pnl: 0, symbol: '', idx: 0 },
      max_drawdown_pct: 0,
      avg_r: 1,
      total_r: 1,
    },
    symbols: [],
    meta: {
      month_name: 'ΑΠΡΙΛΙΟΣ',
      year_short: '26',
      year_full: '2026',
      subtitle: 'INNER CIRCLE  ·  PRIVATE ACCOUNT',
      last_sync: '2026-04-18T14:28:00.000Z',
    },
  };
}

// Capture the buffer that exportToExcel writes by stubbing DOM globals
let captured: ArrayBuffer | null = null;

beforeEach(() => {
  captured = null;
  // jsdom URL.createObjectURL returns a fake; we just need it to exist
  (globalThis as any).URL.createObjectURL = vi.fn((blob: Blob) => {
    // Read the blob into our captured buffer synchronously (jsdom Blob has arrayBuffer)
    blob.arrayBuffer().then(buf => { captured = buf; });
    return 'blob:fake';
  });
  (globalThis as any).URL.revokeObjectURL = vi.fn();
  // anchor click is harmless in jsdom; no override needed
});

async function runExport(data: TradingData): Promise<ExcelJS.Workbook> {
  await exportToExcel(data);
  // Wait a tick for the blob.arrayBuffer().then(...) to resolve
  await new Promise(r => setTimeout(r, 10));
  expect(captured).not.toBeNull();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(captured!);
  return wb;
}

describe('exportToExcel', () => {
  it('produces a workbook with a "Journal" sheet', async () => {
    const wb = await runExport(makeData([makeTrade()]));
    expect(wb.getWorksheet('Journal')).toBeDefined();
  });

  it('writes the title in B2 with month and year', async () => {
    const wb = await runExport(makeData([makeTrade()]));
    const ws = wb.getWorksheet('Journal')!;
    const title = ws.getCell('B2').value;
    expect(String(title)).toContain('ΑΠΡΙΛΙΟΣ');
    expect(String(title)).toContain('2026');
    expect(String(title)).toContain('TRADING JOURNAL');
  });

  it('places the starting balance literal in B8', async () => {
    const wb = await runExport(makeData([makeTrade()]));
    const ws = wb.getWorksheet('Journal')!;
    expect(ws.getCell('B8').value).toBe(500000);
  });

  it('writes trade headers in row 13', async () => {
    const wb = await runExport(makeData([makeTrade()]));
    const ws = wb.getWorksheet('Journal')!;
    expect(ws.getCell('B13').value).toBe('DAY');
    expect(ws.getCell('M13').value).toBe('P/L ($)');
    expect(ws.getCell('P13').value).toBe('NET %');
    expect(ws.getCell('S13').value).toBe('CHART AFTER');
  });

  it('writes the first trade into row 14 with the expected fields', async () => {
    const t = makeTrade({ symbol: 'XAUUSD', direction: 'SELL', pnl: -100 });
    const wb = await runExport(makeData([t]));
    const ws = wb.getWorksheet('Journal')!;
    expect(ws.getCell('E14').value).toBe('XAUUSD');
    expect(ws.getCell('F14').value).toBe('SELL');
    expect(ws.getCell('M14').value).toBe(-100);
    // L (R) and P (NET %) should be formulas
    const lVal: any = ws.getCell('L14').value;
    const pVal: any = ws.getCell('P14').value;
    expect(lVal && lVal.formula).toBeTypeOf('string');
    expect(pVal && pVal.formula).toBeTypeOf('string');
    // First-row P denominator references $B$8
    expect(pVal.formula).toContain('$B$8');
  });

  it('uses prior T row for subsequent NET% formulas', async () => {
    const wb = await runExport(makeData([makeTrade(), makeTrade({ idx: 2 })]));
    const ws = wb.getWorksheet('Journal')!;
    const p15: any = ws.getCell('P15').value;
    expect(p15.formula).toContain('T14');
  });

  it('places the running-balance formula in column T for every trade row', async () => {
    const wb = await runExport(makeData([makeTrade(), makeTrade()]));
    const ws = wb.getWorksheet('Journal')!;
    const t14: any = ws.getCell('T14').value;
    const t15: any = ws.getCell('T15').value;
    expect(t14.formula).toBe('$B$8+M14+N14+O14');
    expect(t15.formula).toBe('T14+M15+N15+O15');
  });

  it('writes the Performance Analytics section at row 42', async () => {
    const wb = await runExport(makeData([makeTrade()]));
    const ws = wb.getWorksheet('Journal')!;
    expect(String(ws.getCell('B42').value)).toContain('PERFORMANCE ANALYTICS');
    expect(ws.getCell('B44').value).toBe('TOTAL P/L (BROKER)');
    expect(ws.getCell('I49').value).toBe('WIN RATE');
    const e44: any = ws.getCell('E44').value;
    expect(e44.formula).toBe('SUM(M14:M40)');
  });
});
