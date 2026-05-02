/**
 * What-If Calculator — replays a list of closed trades against a hypothetical
 * capital + risk-per-trade %, using R-multiples.
 *
 * R = (exit − entry) / |entry − SL|, signed by side (BUY → +, SELL → −).
 *
 * Trades without a usable SL fall back to ±1R based on whether the realised
 * P/L was positive or negative (Option B chosen by the user).
 *
 * Pure module — no React, no DOM. Easy to unit-test.
 */
import type { Trade } from "./trading";

export interface WhatIfParams {
  /** Hypothetical starting capital, in account currency. */
  capital: number;
  /** Risk per trade as a percent of (capital | running balance). 0–100. */
  riskPct: number;
  /**
   * If true, risk_in_money is recomputed from the running balance before
   * every trade. If false, it stays fixed at `capital * riskPct/100`.
   */
  compound: boolean;
}

export interface WhatIfTradePoint {
  /** 1-based ordinal in the input list (after filtering). */
  idx: number;
  symbol: string;
  /** R earned (+ for win, − for loss). */
  rMultiple: number;
  /** Hypothetical $ P/L for this trade in the simulation. */
  hypoPnl: number;
  /** Running hypothetical balance AFTER this trade settles. */
  balanceAfter: number;
  /** True if R came from the ±1R fallback (no usable SL on the original trade). */
  usedFallback: boolean;
}

export interface WhatIfResult {
  finalBalance: number;
  totalPnl: number;
  totalPct: number;
  winRate: number;
  bestTrade: number;
  worstTrade: number;
  maxDrawdown: number;
  /** Drawdown expressed as % of the peak balance reached. */
  maxDrawdownPct: number;
  equity: number[];
  trades: WhatIfTradePoint[];
  /** How many input trades had no usable SL and fell back to ±1R. */
  fallbackTradesCount: number;
  /** How many input trades were ignored entirely (no entry/exit, etc.). */
  skippedTradesCount: number;
  /** Total trades that contributed to the simulation. */
  consideredTradesCount: number;
}

/**
 * Computes the R-multiple for a single trade.
 *
 * Returns `{ r, usedFallback }`. `usedFallback === true` means we couldn't
 * compute a real R from prices and fell back to ±1R based on net P/L sign.
 */
export function computeR(trade: Trade): { r: number; usedFallback: boolean } | null {
  const entry = Number(trade.entry);
  const exit = Number(trade.close);
  if (!Number.isFinite(entry) || !Number.isFinite(exit)) {
    // Can't even tell direction → caller should skip this trade.
    return null;
  }

  const sl = Number(trade.sl);
  const slUsable = Number.isFinite(sl) && sl !== 0 && Math.abs(entry - sl) > 1e-9;

  if (slUsable) {
    const risk = Math.abs(entry - sl);
    const sideSign = trade.direction === "BUY" ? 1 : -1;
    const r = ((exit - entry) * sideSign) / risk;
    return { r, usedFallback: false };
  }

  // Fallback (Option B): ±1R based on realised P/L sign.
  const pnl = Number(trade.pnl) + Number(trade.swap || 0) + Number(trade.commission || 0);
  if (!Number.isFinite(pnl) || pnl === 0) {
    // No SL and no resolved P/L — treat as a no-op (0R).
    return { r: 0, usedFallback: true };
  }
  return { r: pnl > 0 ? 1 : -1, usedFallback: true };
}

/**
 * Replays the trades against the given params and returns aggregate stats
 * plus the per-trade equity walk.
 */
export function simulate(trades: Trade[], params: WhatIfParams): WhatIfResult {
  const capital = Math.max(0, Number(params.capital) || 0);
  const riskPct = Math.max(0, Number(params.riskPct) || 0);
  const fixedRisk = capital * (riskPct / 100);

  const sorted = [...trades].sort((a, b) => {
    const ao = a.open || a.close_time || "";
    const bo = b.open || b.close_time || "";
    return ao.localeCompare(bo);
  });

  let balance = capital;
  let peak = capital;
  let maxDD = 0;
  let wins = 0;
  let totalConsidered = 0;
  let fallbackCount = 0;
  let skipped = 0;
  let bestTrade = 0;
  let worstTrade = 0;

  const equity: number[] = [capital];
  const out: WhatIfTradePoint[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const trade = sorted[i];
    const r = computeR(trade);
    if (r === null) {
      skipped += 1;
      continue;
    }
    if (r.usedFallback) fallbackCount += 1;

    const riskInMoney = params.compound ? balance * (riskPct / 100) : fixedRisk;
    const hypoPnl = r.r * riskInMoney;
    balance += hypoPnl;

    if (balance > peak) peak = balance;
    const dd = peak - balance;
    if (dd > maxDD) maxDD = dd;

    if (hypoPnl > 0) wins += 1;
    if (hypoPnl > bestTrade) bestTrade = hypoPnl;
    if (hypoPnl < worstTrade) worstTrade = hypoPnl;

    totalConsidered += 1;

    out.push({
      idx: i + 1,
      symbol: trade.symbol,
      rMultiple: r.r,
      hypoPnl,
      balanceAfter: balance,
      usedFallback: r.usedFallback,
    });
    equity.push(balance);
  }

  const totalPnl = balance - capital;
  const totalPct = capital > 0 ? (totalPnl / capital) * 100 : 0;
  const winRate = totalConsidered > 0 ? (wins / totalConsidered) * 100 : 0;
  const maxDDPct = peak > 0 ? (maxDD / peak) * 100 : 0;

  return {
    finalBalance: balance,
    totalPnl,
    totalPct,
    winRate,
    bestTrade,
    worstTrade,
    maxDrawdown: maxDD,
    maxDrawdownPct: maxDDPct,
    equity,
    trades: out,
    fallbackTradesCount: fallbackCount,
    skippedTradesCount: skipped,
    consideredTradesCount: totalConsidered,
  };
}

/** Convenience: run a grid of (capitals × riskPcts) at once. */
export function simulateGrid(
  trades: Trade[],
  capitals: number[],
  riskPcts: number[],
  compound: boolean
): { capital: number; riskPct: number; result: WhatIfResult }[] {
  const out: { capital: number; riskPct: number; result: WhatIfResult }[] = [];
  for (const c of capitals) {
    for (const r of riskPcts) {
      out.push({
        capital: c,
        riskPct: r,
        result: simulate(trades, { capital: c, riskPct: r, compound }),
      });
    }
  }
  return out;
}
