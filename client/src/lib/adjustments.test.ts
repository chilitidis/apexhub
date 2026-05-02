// Adjustments compute layer — withdrawals shift ending balance but do NOT
// pollute trade KPIs (win rate, profit factor, R-multiples).

import { describe, it, expect } from 'vitest';
import {
  type Trade,
  type Adjustment,
  computeKPIs,
  sumAdjustments,
  endingWithAdjustments,
} from './trading';

const mkTrade = (idx: number, pnl: number, day = '01.01'): Trade => ({
  idx,
  day,
  open: `2026-01-0${idx} 10:00:00`,
  close_time: `2026-01-0${idx} 11:00:00`,
  symbol: 'XAUUSD',
  direction: pnl >= 0 ? 'BUY' : 'SELL',
  lots: 0.5,
  entry: 2000,
  close: 2000 + pnl / 5,
  sl: 1990,
  tp: 2020,
  trade_r: pnl >= 0 ? 1 : -1,
  pnl,
  swap: 0,
  commission: 0,
  net_pct: 0,
  tf: 'H1',
  chart_before: '',
  chart_after: '',
});

describe('sumAdjustments', () => {
  it('returns 0 for empty/undefined input', () => {
    expect(sumAdjustments(undefined)).toBe(0);
    expect(sumAdjustments(null)).toBe(0);
    expect(sumAdjustments([])).toBe(0);
  });

  it('treats deposits as +amount and withdrawals as −amount', () => {
    const adj: Adjustment[] = [
      { id: '1', date: '2026-01-15', type: 'withdrawal', amount: 500 },
      { id: '2', date: '2026-01-20', type: 'deposit', amount: 200 },
      { id: '3', date: '2026-01-25', type: 'withdrawal', amount: 100 },
    ];
    expect(sumAdjustments(adj)).toBe(-400); // -500 + 200 - 100
  });

  it('uses absolute value of amount (defensive against negative input)', () => {
    const adj: Adjustment[] = [
      { id: 'x', date: '2026-01-15', type: 'withdrawal', amount: -200 },
    ];
    expect(sumAdjustments(adj)).toBe(-200);
  });
});

describe('endingWithAdjustments', () => {
  it('shifts the trades ending by the net adjustment', () => {
    expect(endingWithAdjustments(10_000, undefined)).toBe(10_000);
    expect(endingWithAdjustments(10_000, [
      { id: '1', date: '2026-01-15', type: 'withdrawal', amount: 1500 },
    ])).toBe(8_500);
    expect(endingWithAdjustments(10_000, [
      { id: '1', date: '2026-01-15', type: 'deposit', amount: 750 },
    ])).toBe(10_750);
  });
});

describe('computeKPIs with adjustments', () => {
  it('subtracts a withdrawal from ending but keeps win rate intact', () => {
    const trades = [mkTrade(1, 200), mkTrade(2, -100), mkTrade(3, 300)];
    const adj: Adjustment[] = [
      { id: 'w1', date: '2026-01-15', type: 'withdrawal', amount: 500 },
    ];
    const out = computeKPIs(trades, 10_000, adj);

    // ending = 10000 + (200 - 100 + 300) - 500 = 9_900
    expect(out.kpis.ending).toBe(9_900);
    // net_result = 9900 - 10000 = -100
    expect(out.kpis.net_result).toBe(-100);
    // win rate stays as 2 wins / 3 trades = 0.6666…
    expect(out.kpis.wins).toBe(2);
    expect(out.kpis.losses).toBe(1);
    expect(out.kpis.win_rate).toBeCloseTo(2 / 3, 6);
    expect(out.kpis.total_trades).toBe(3);
    // adjustments are returned through TradingData
    expect(out.adjustments).toHaveLength(1);
    expect(out.adjustments?.[0]?.id).toBe('w1');
  });

  it('adds a deposit to ending but keeps profit factor intact', () => {
    const trades = [mkTrade(1, 400), mkTrade(2, -200)];
    const adj: Adjustment[] = [
      { id: 'd1', date: '2026-01-10', type: 'deposit', amount: 1000 },
    ];
    const out = computeKPIs(trades, 5_000, adj);

    // ending = 5000 + (400 - 200) + 1000 = 6200
    expect(out.kpis.ending).toBe(6_200);
    expect(out.kpis.net_result).toBe(1_200);
    // profit factor = 400/200 = 2 (independent of deposit)
    expect(out.kpis.profit_factor).toBeCloseTo(2, 4);
  });

  it('handles many adjustments in one month', () => {
    const trades = [mkTrade(1, 100), mkTrade(2, 200)];
    const adj: Adjustment[] = [
      { id: 'a', date: '2026-01-05', type: 'withdrawal', amount: 50 },
      { id: 'b', date: '2026-01-10', type: 'deposit', amount: 200 },
      { id: 'c', date: '2026-01-20', type: 'withdrawal', amount: 75 },
      { id: 'd', date: '2026-01-25', type: 'deposit', amount: 25 },
    ];
    const out = computeKPIs(trades, 1_000, adj);
    // ending = 1000 + 300 + (-50 + 200 - 75 + 25) = 1_400
    expect(out.kpis.ending).toBe(1_400);
    expect(out.kpis.total_trades).toBe(2);
  });

  it('return_pct uses trade-only P/L (deposits do not inflate it)', () => {
    const trades = [mkTrade(1, 500)];
    const adj: Adjustment[] = [
      { id: 'd', date: '2026-01-10', type: 'deposit', amount: 5_000 },
    ];
    const out = computeKPIs(trades, 10_000, adj);
    // tradesNet = 500, return_pct = 500 / 10000 = 0.05
    expect(out.kpis.return_pct).toBeCloseTo(0.05, 6);
    // ending still includes the deposit
    expect(out.kpis.ending).toBe(15_500);
  });

  it('does not store adjustments field when input is empty/undefined', () => {
    const trades = [mkTrade(1, 100)];
    const a = computeKPIs(trades, 1_000);
    expect(a.adjustments).toBeUndefined();
    const b = computeKPIs(trades, 1_000, []);
    expect(b.adjustments).toBeUndefined();
  });
});
