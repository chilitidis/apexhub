/**
 * MT5 sync → monthly snapshot merger.
 *
 * Pure helper extracted from Home.tsx so the same logic can be triggered
 * from any page (e.g. the per-account Sync button on /accounts) without
 * navigating into the journal first.
 *
 * Given a flat list of mapped MT5 trades + the current monthly history for
 * the target account, this:
 *   1. Buckets trades into YYYY-MM groups using `close_time` (or `open` for
 *      still-open positions).
 *   2. For each bucket, merges with the existing snapshot (positions tagged
 *      with `[mt5:<positionId>]` in `notes` are replaced; untagged manual
 *      trades pass through). Brand-new buckets seed `starting` from the
 *      most recent prior month's `ending`.
 *   3. Re-runs `computeKPIs` for each merged bucket and returns the list of
 *      `TradingData` snapshots that should be persisted via `saveMonth`.
 *
 * The caller is responsible for actually persisting (`saveMonth`) and
 * updating in-memory state — this keeps the helper synchronous and easy to
 * unit-test, and avoids dragging tRPC into the lib layer.
 */
import { computeKPIs, type Trade, type TradingData, type CurrencyCode, type Adjustment } from "./trading";
import { parseAdjustmentsJson } from "./monthlyHistory";
import type { MonthSnapshot } from "@/hooks/useJournal";

export interface MappedMt5Trade {
  positionId: string;
  symbol: string;
  direction: "BUY" | "SELL";
  lots: number;
  entry: number;
  close: number;
  sl: number | null;
  tp: number | null;
  day: string;
  trade_r: number | null;
  net_pct: number;
  pnl: number;
  swap: number;
  commission: number;
  open: string;
  close_time: string;
  status: "open" | "closed";
}

const MONTH_ORDER = [
  "ΙΑΝΟΥΑΡΙΟΣ",
  "ΦΕΒΡΟΥΑΡΙΟΣ",
  "ΜΑΡΤΙΟΣ",
  "ΑΠΡΙΛΙΟΣ",
  "ΜΑΙΟΣ",
  "ΙΟΥΝΙΟΣ",
  "ΙΟΥΛΙΟΣ",
  "ΑΥΓΟΥΣΤΟΣ",
  "ΣΕΠΤΕΜΒΡΙΟΣ",
  "ΟΚΤΩΒΡΙΟΣ",
  "ΝΟΕΜΒΡΙΟΣ",
  "ΔΕΚΕΜΒΡΙΟΣ",
] as const;

const MT5_TAG_PREFIX = "[mt5:";

const tagFor = (pid: string) => `${MT5_TAG_PREFIX}${pid}]`;

const extractPid = (notes?: string | null): string | null => {
  if (!notes) return null;
  const m = notes.match(/\[mt5:([^\]]+)\]/);
  return m ? m[1] : null;
};

export interface MergeMt5Options {
  /** Currency code to stamp on new snapshots (so refresh keeps EUR/USD). */
  currency?: CurrencyCode;
  /** Account starting balance — used to seed the very first month if no prior history exists. */
  fallbackStarting?: number;
}

/**
 * Group `synced` MT5 trades into monthly buckets and merge with the matching
 * snapshots in `monthlyHistory`. Returns one `TradingData` per touched
 * month, ready to be sent to `saveMonth`.
 */
export function mergeMt5TradesIntoMonths(
  synced: MappedMt5Trade[],
  monthlyHistory: MonthSnapshot[],
  options: MergeMt5Options = {},
): TradingData[] {
  if (!synced || synced.length === 0) return [];

  // 1. Bucket by YYYY-MM.
  const buckets = new Map<string, MappedMt5Trade[]>();
  for (const t of synced) {
    const stamp = t.close_time || t.open;
    if (!stamp) continue;
    const d = new Date(stamp);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const arr = buckets.get(key) ?? [];
    arr.push(t);
    buckets.set(key, arr);
  }

  const merged: TradingData[] = [];

  for (const [bucketKey, bucketTrades] of Array.from(buckets.entries())) {
    const [yearStr, monthStr] = bucketKey.split("-");
    const monthIdx = parseInt(monthStr, 10) - 1;
    const monthName = MONTH_ORDER[monthIdx] ?? "ΙΑΝΟΥΑΡΙΟΣ";

    const existing = monthlyHistory.find((h) => h.key === bucketKey);
    let baseTrades: Trade[] = [];
    let starting = 0;
    let adjustments: Adjustment[] = [];
    let currency: CurrencyCode = options.currency ?? "USD";
    if (existing) {
      try {
        baseTrades = JSON.parse(existing.trades_json) as Trade[];
      } catch {
        baseTrades = [];
      }
      starting = existing.starting;
      try {
        adjustments = parseAdjustmentsJson(existing.adjustments_json);
      } catch {
        adjustments = [];
      }
      currency = (existing.currency as CurrencyCode | undefined) ?? currency;
    } else {
      // Fresh bucket → seed from most recent prior month, else from the
      // caller-provided fallback (typically the account's starting balance).
      const prior = monthlyHistory
        .filter((h) => h.key < bucketKey)
        .sort((a, b) => (a.key < b.key ? 1 : -1))[0];
      starting = prior ? prior.ending : (options.fallbackStarting ?? 0);
    }

    // Index existing trades by their MetaApi positionId tag.
    const byPos = new Map<string, Trade>();
    const passthrough: Trade[] = [];
    for (const t of baseTrades) {
      const pid = extractPid(t.notes);
      if (pid) byPos.set(pid, t);
      else passthrough.push(t);
    }
    for (const s of bucketTrades) {
      const idStr = String(s.positionId);
      const prior = byPos.get(idStr);
      const priorNotes = prior?.notes ?? "";
      const cleanedPriorNotes = priorNotes.replace(/\s*\[mt5:[^\]]+\]/, "").trim();
      const mergedTrade: Trade = {
        idx: prior?.idx ?? 0,
        tf: prior?.tf ?? "",
        chart_before: prior?.chart_before ?? "",
        chart_after: prior?.chart_after ?? "",
        lessons_learned: prior?.lessons_learned,
        psychology: prior?.psychology,
        pre_checklist: prior?.pre_checklist,
        symbol: s.symbol,
        direction: s.direction,
        lots: s.lots,
        entry: s.entry,
        close: s.close,
        sl: s.sl ?? prior?.sl ?? null,
        tp: s.tp ?? prior?.tp ?? null,
        day: s.day || prior?.day || "",
        trade_r: s.trade_r ?? prior?.trade_r ?? null,
        net_pct: s.net_pct || prior?.net_pct || 0,
        pnl: s.pnl,
        swap: s.swap,
        commission: s.commission,
        open: s.open,
        close_time: s.close_time,
        status: s.status,
        notes: `${cleanedPriorNotes ? cleanedPriorNotes + " " : ""}${tagFor(idStr)}`,
      };
      byPos.set(idStr, mergedTrade);
    }
    const mergedTradesUnindexed = [...passthrough, ...Array.from(byPos.values())].sort((a, b) => {
      const ao = a.open ? new Date(a.open).getTime() : 0;
      const bo = b.open ? new Date(b.open).getTime() : 0;
      return ao - bo;
    });
    const mergedTrades = mergedTradesUnindexed.map((t, i) => ({ ...t, idx: i + 1 }));
    const recomputed = computeKPIs(mergedTrades, starting, adjustments);
    merged.push({
      ...recomputed,
      meta: {
        ...recomputed.meta,
        month_name: monthName,
        year_full: yearStr,
        year_short: yearStr.slice(2),
        currency,
      },
      adjustments,
    });
  }

  return merged;
}

/** Re-export for tests / callers that need the tag conventions. */
export const __MT5_MERGE_INTERNALS = { tagFor, extractPid };
