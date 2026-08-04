// coachContext.ts — compact "trader data" context for the AI coaches, the
// Weekly AI Review and the Pre-Market Briefing focus symbols.
//
// All numbers are derived from the SAME helpers the dashboard already uses
// (computeKPIs, analyzePatterns) — no duplicated math. The output mirrors the
// server-side zod schema in server/coachContext.ts: everything optional,
// small, and rounded so the serialized payload stays tiny.

import type { Trade } from "./trading";
import { computeKPIs, isClosedTrade } from "./trading";
import { analyzePatterns, tradeEmotion, tradeWeekday } from "./patternAnalysis";

export interface CoachDayStat {
  key: string;
  trades: number;
  pnl: number;
}

export interface CoachEmotionStat {
  key: string;
  trades: number;
  winRatePct: number;
  pnl: number;
}

export interface CoachRecentTrade {
  symbol: string;
  dir: "BUY" | "SELL";
  r?: number | null;
  net: number;
  day?: string;
  emotion?: string;
}

export interface CoachTradeContext {
  stats?: {
    trades?: number;
    winRatePct?: number;
    totalPnl?: number;
    avgR?: number;
    bestDay?: CoachDayStat | null;
    worstDay?: CoachDayStat | null;
    topSymbolsByPnl?: Array<{ symbol: string; trades: number; pnl: number }>;
    byEmotion?: CoachEmotionStat[];
  };
  recentTrades?: CoachRecentTrade[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Best-effort timestamp for sorting trades chronologically. */
function tradeTime(t: Trade): number {
  const ts = new Date(t.close_time || t.open).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

/**
 * Build the coach context from the loaded trades. Returns `undefined` when
 * there are no closed trades (the coaches then simply get no TRADER DATA
 * block — e.g. on the standalone /trading-coach route with an empty journal).
 */
export function buildCoachContext(
  trades: Trade[] | undefined | null,
): CoachTradeContext | undefined {
  const closed = (trades ?? []).filter(isClosedTrade);
  if (closed.length === 0) return undefined;

  // computeKPIs mutates trades in place (R back-fill), so feed it copies.
  const kpis = computeKPIs(closed.map((t) => ({ ...t }))).kpis;
  const patterns = analyzePatterns(closed);

  const dayStat = (g: { key: string; trades: number; pnl: number } | null) =>
    g ? { key: g.key, trades: g.trades, pnl: round2(g.pnl) } : null;

  const recentTrades: CoachRecentTrade[] = [...closed]
    .sort((a, b) => tradeTime(b) - tradeTime(a))
    .slice(0, 20)
    .map((t) => ({
      symbol: (t.symbol || "?").slice(0, 24),
      dir: t.direction,
      r: t.trade_r === null || t.trade_r === undefined ? null : round2(t.trade_r),
      net: round2((Number(t.pnl) || 0) + (Number(t.swap) || 0)),
      day: (tradeWeekday(t) ?? t.day ?? "").slice(0, 16) || undefined,
      emotion: t.emotion ? tradeEmotion(t).slice(0, 24) : undefined,
    }));

  return {
    stats: {
      trades: closed.length,
      winRatePct: round2(kpis.win_rate * 100),
      totalPnl: round2(kpis.net_result),
      avgR: round2(kpis.avg_r),
      bestDay: dayStat(patterns.bestDay),
      worstDay: dayStat(patterns.worstDay),
      topSymbolsByPnl: patterns.closedTrades > 0
        ? topSymbolsByPnl(closed, 5)
        : [],
      byEmotion: patterns.byEmotion
        .filter((g) => g.key !== "Not specified")
        .slice(0, 6)
        .map((g) => ({
          key: g.key.slice(0, 32),
          trades: g.trades,
          winRatePct: round2(g.win_rate * 100),
          pnl: round2(g.pnl),
        })),
    },
    recentTrades,
  };
}

/** Top symbols by total P&L (descending), for the coach stats block. */
function topSymbolsByPnl(
  closed: Trade[],
  max: number,
): Array<{ symbol: string; trades: number; pnl: number }> {
  const map = new Map<string, { trades: number; pnl: number }>();
  for (const t of closed) {
    const sym = (t.symbol || "?").toUpperCase();
    const cur = map.get(sym) ?? { trades: 0, pnl: 0 };
    cur.trades += 1;
    cur.pnl += Number(t.pnl) || 0;
    map.set(sym, cur);
  }
  return Array.from(map.entries())
    .map(([symbol, s]) => ({ symbol: symbol.slice(0, 24), trades: s.trades, pnl: round2(s.pnl) }))
    .sort((a, b) => b.pnl - a.pnl)
    .slice(0, max);
}

/**
 * The user's most-traded symbols by trade count (for the Pre-Market Briefing
 * focus list). Open trades count too — they show what the trader trades.
 */
export function topSymbolsByTradeCount(
  trades: Trade[] | undefined | null,
  max = 8,
): string[] {
  const counts = new Map<string, number>();
  for (const t of trades ?? []) {
    const sym = (t.symbol || "").toUpperCase().trim();
    if (!sym) continue;
    counts.set(sym, (counts.get(sym) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([sym]) => sym);
}

/** ISO-8601 week key for a date, e.g. "2026-W32". */
export function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7; // Mon=1 … Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum); // nearest Thursday
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Closed trades whose (close/open) timestamp falls within the last N days. */
export function tradesInLastDays(
  trades: Trade[] | undefined | null,
  days: number,
  now: Date = new Date(),
): Trade[] {
  const cutoff = now.getTime() - days * 86_400_000;
  return (trades ?? []).filter(
    (t) => isClosedTrade(t) && tradeTime(t) >= cutoff && tradeTime(t) <= now.getTime() + 86_400_000,
  );
}
