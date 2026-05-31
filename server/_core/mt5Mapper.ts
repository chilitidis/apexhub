/**
 * Conversion helpers between MetaApi deals/orders and the APEXHUB Trade model.
 *
 * MetaApi exposes individual *deals* (DEAL_TYPE_BUY / DEAL_TYPE_SELL with an
 * `entryType` of DEAL_ENTRY_IN / DEAL_ENTRY_OUT) and *orders*. A round-trip
 * trade is the pair of an IN deal and one or more OUT deals sharing the same
 * `positionId`. The mapper here groups deals by `positionId`, computes the
 * net realised profit (sum of `profit` across all deals on the position),
 * derives entry/exit prices (volume-weighted on the OUT side for the exit),
 * and emits a single APEXHUB-compatible trade row per closed position.
 *
 * SL/TP comes from MetaApi *history orders* (the original entry order has
 * `stopLoss` and `takeProfit` populated; deals do not). Callers pass a list
 * of history orders alongside the deals; we look up the entry order by
 * `positionId` and copy its stopLoss/takeProfit into the trade.
 *
 * Open positions (no DEAL_ENTRY_OUT yet) are emitted with `status: 'open'`
 * so the journal can show them in the new open-trade lifecycle. Pending
 * orders that were never filled (no IN deal) are skipped entirely.
 */

export interface MetaApiDeal {
  id: string;
  type: string;            // DEAL_TYPE_BUY / DEAL_TYPE_SELL / DEAL_TYPE_BALANCE
  entryType?: string;      // DEAL_ENTRY_IN / DEAL_ENTRY_OUT / DEAL_ENTRY_INOUT
  positionId?: string;
  orderId?: string;
  symbol?: string;
  volume?: number;
  price?: number;
  profit?: number;
  swap?: number;
  commission?: number;
  time?: string | Date;
  comment?: string;
  brokerComment?: string;
  /**
   * Some brokers (notably mobile-routed flows) attach SL/TP to the closing
   * deal rather than the order. We accept these as a primary source.
   */
  stopLoss?: number;
  takeProfit?: number;
}

export interface MetaApiOrder {
  id: string;
  type: string;            // ORDER_TYPE_BUY / ORDER_TYPE_SELL / ...
  state?: string;
  positionId?: string;
  symbol?: string;
  stopLoss?: number;
  takeProfit?: number;
  openPrice?: number;
  volume?: number;
  time?: string | Date;
  doneTime?: string | Date;
}

export interface MappedTrade {
  positionId: string;
  symbol: string;
  direction: "BUY" | "SELL";
  lots: number;
  entry: number;
  close: number;
  /** Stop-loss price (from the history entry order). null when not set. */
  sl: number | null;
  /** Take-profit price (from the history entry order). null when not set. */
  tp: number | null;
  /** Greek 3-letter day code derived from close (or open) time. */
  day: string;
  /** R-multiple: sign(pnl) * |reward| / |risk|. null when SL is missing. */
  trade_r: number | null;
  /**
   * Net % return relative to balance at the moment the trade closed
   * (starting + cumulative pnl/swap/commission of all earlier trades).
   * Stored as a fraction (e.g. 0.025 = +2.5%).
   */
  net_pct: number;
  pnl: number;
  swap: number;
  commission: number;
  open: string;     // ISO 8601
  close_time: string;
  status: "open" | "closed";
}

const toIso = (t: string | Date | undefined): string => {
  if (!t) return "";
  const d = t instanceof Date ? t : new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
};

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

// 0 = Sunday … 6 = Saturday — match JS Date#getUTCDay
const GREEK_DAY_SHORT = ["ΚΥΡ", "ΔΕΥ", "ΤΡΙ", "ΤΕΤ", "ΠΕΜ", "ΠΑΡ", "ΣΑΒ"] as const;

/**
 * Greek 3-letter day-of-week label for an ISO timestamp. Empty string when
 * the timestamp is falsy or unparseable.
 */
export function dayOfWeekFromIso(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return GREEK_DAY_SHORT[d.getUTCDay()] ?? "";
}

/**
 * Group a flat list of MetaApi deals by `positionId` and reduce each group
 * into a single APEXHUB trade. Filters out balance/credit transactions
 * (entryType absent or DEAL_TYPE_BALANCE) which are not trading positions.
 *
 * `historyOrders` (optional) supplies stop-loss and take-profit prices that
 * deals do not carry. We pick the order whose type starts with ORDER_TYPE_BUY
 * or ORDER_TYPE_SELL (the entry market/limit/stop) for the position.
 *
 * `startingBalance` (optional, default 0) is used to compute `net_pct` as
 * (pnl + swap + commission) / balance_before_close, so syncing into a fresh
 * month produces percentages consistent with the manual Add-Trade modal.
 */
export function mapDealsToTrades(
  deals: MetaApiDeal[],
  historyOrders: MetaApiOrder[] = [],
  startingBalance = 0,
): MappedTrade[] {
  // -- Index orders by positionId so we can pull SL/TP per trade. ---------
  const ordersByPos = new Map<string, MetaApiOrder[]>();
  for (const o of historyOrders) {
    if (!o || !o.positionId) continue;
    const arr = ordersByPos.get(o.positionId) ?? [];
    arr.push(o);
    ordersByPos.set(o.positionId, arr);
  }
  const pickEntryOrder = (positionId: string): MetaApiOrder | undefined => {
    const arr = ordersByPos.get(positionId);
    if (!arr || arr.length === 0) return undefined;
    // Prefer the actual market BUY/SELL entry; fall back to first order.
    const entry = arr.find((o) => {
      const t = o.type ?? "";
      return t === "ORDER_TYPE_BUY" || t === "ORDER_TYPE_SELL";
    });
    return entry ?? arr[0];
  };

  // -- Group deals by position. --------------------------------------------
  const byPos = new Map<string, MetaApiDeal[]>();
  for (const d of deals) {
    if (!d || !d.positionId) continue;
    if (d.type === "DEAL_TYPE_BALANCE") continue;
    if (d.type !== "DEAL_TYPE_BUY" && d.type !== "DEAL_TYPE_SELL") continue;
    const list = byPos.get(d.positionId) ?? [];
    list.push(d);
    byPos.set(d.positionId, list);
  }

  // First pass: build a temporary list with raw timestamps so we can sort
  // chronologically and compute net_pct against a running balance.
  interface Tmp extends MappedTrade {
    _closeMs: number;
    _openMs: number;
  }
  const tmp: Tmp[] = [];

  for (const [positionId, group] of Array.from(byPos.entries())) {
    group.sort((a: MetaApiDeal, b: MetaApiDeal) => {
      const ta = a.time ? new Date(a.time).getTime() : 0;
      const tb = b.time ? new Date(b.time).getTime() : 0;
      return ta - tb;
    });

    const inDeal = group.find((d: MetaApiDeal) => d.entryType === "DEAL_ENTRY_IN");
    if (!inDeal) continue;

    const outDeals = group.filter((d: MetaApiDeal) => d.entryType === "DEAL_ENTRY_OUT");
    const symbol = (inDeal.symbol ?? group[0]?.symbol ?? "").toUpperCase();
    const direction: "BUY" | "SELL" = inDeal.type === "DEAL_TYPE_BUY" ? "BUY" : "SELL";

    const lots = num(inDeal.volume);
    const entry = num(inDeal.price);

    let exit = 0;
    if (outDeals.length > 0) {
      let vol = 0;
      let weighted = 0;
      for (const d of outDeals) {
        const v = num(d.volume);
        weighted += num(d.price) * v;
        vol += v;
      }
      exit = vol > 0 ? weighted / vol : num(outDeals[outDeals.length - 1].price);
    }

    const pnl = group.reduce((acc: number, d: MetaApiDeal) => acc + num(d.profit), 0);
    const swap = group.reduce((acc: number, d: MetaApiDeal) => acc + num(d.swap), 0);
    const commission = group.reduce((acc: number, d: MetaApiDeal) => acc + num(d.commission), 0);

    const status: "open" | "closed" = outDeals.length > 0 ? "closed" : "open";
    const open = toIso(inDeal.time);
    const close_time = status === "closed" ? toIso(outDeals[outDeals.length - 1].time) : "";

    // SL / TP discovery. Different brokers stash these in different places:
    //   1. Some put them on the entry order (`stopLoss` / `takeProfit`).
    //   2. Some attach them later via a modify-position order — still on an
    //      order row tied to the same positionId.
    //   3. Many MT5 mobile flows put SL/TP on the *closing deal*
    //      (DEAL_ENTRY_OUT). The samplePair in the diagnostic confirmed this
    //      for the user's broker.
    // We scan all three sources and take the first finite, non-zero value.
    const ordersForPos = ordersByPos.get(positionId) ?? [];
    let sl: number | null = null;
    let tp: number | null = null;
    // (a) closing deals first — most authoritative when present, since they
    //     reflect the SL/TP that was active at the moment the position closed.
    for (const d of group) {
      if (d.entryType !== "DEAL_ENTRY_OUT") continue;
      if (sl === null && Number.isFinite(d.stopLoss) && (d.stopLoss as number) > 0) {
        sl = d.stopLoss as number;
      }
      if (tp === null && Number.isFinite(d.takeProfit) && (d.takeProfit as number) > 0) {
        tp = d.takeProfit as number;
      }
      if (sl !== null && tp !== null) break;
    }
    // (b) opening deals — some brokers stamp SL on the IN deal too.
    if (sl === null || tp === null) {
      for (const d of group) {
        if (d.entryType !== "DEAL_ENTRY_IN") continue;
        if (sl === null && Number.isFinite(d.stopLoss) && (d.stopLoss as number) > 0) {
          sl = d.stopLoss as number;
        }
        if (tp === null && Number.isFinite(d.takeProfit) && (d.takeProfit as number) > 0) {
          tp = d.takeProfit as number;
        }
        if (sl !== null && tp !== null) break;
      }
    }
    // (c) any order on this position (entry / modify / pending fallback).
    if (sl === null || tp === null) {
      for (const o of ordersForPos) {
        if (sl === null && Number.isFinite(o.stopLoss) && (o.stopLoss as number) > 0) {
          sl = o.stopLoss as number;
        }
        if (tp === null && Number.isFinite(o.takeProfit) && (o.takeProfit as number) > 0) {
          tp = o.takeProfit as number;
        }
        if (sl !== null && tp !== null) break;
      }
    }
    // Reference the entry order so future symbol/lookup logic can rely on it.
    void pickEntryOrder(positionId);

    // R-multiple: sign(pnl) * |reward| / |risk|. Only meaningful when SL is
    // present and the trade is closed.
    let trade_r: number | null = null;
    if (status === "closed" && sl !== null && Number.isFinite(entry) && Number.isFinite(exit)) {
      const reward = Math.abs(exit - entry);
      const risk = Math.abs(entry - sl);
      if (risk > 0) {
        const sign = pnl >= 0 ? 1 : -1;
        trade_r = sign * (reward / risk);
      }
    }

    // Day-of-week from close (closed) or open (open) timestamp.
    const day = dayOfWeekFromIso(close_time || open);

    tmp.push({
      positionId,
      symbol,
      direction,
      lots,
      entry,
      close: status === "closed" ? exit : 0,
      sl,
      tp,
      day,
      trade_r,
      net_pct: 0, // filled below from running balance
      pnl: status === "closed" ? pnl : 0,
      swap: status === "closed" ? swap : 0,
      commission,
      open,
      close_time,
      status,
      _openMs: open ? new Date(open).getTime() : 0,
      _closeMs: close_time ? new Date(close_time).getTime() : 0,
    });
  }

  // Compute net_pct against a running balance, in close-time order. Only
  // closed trades move the balance; open trades carry net_pct = 0.
  const closedSorted = tmp
    .filter((t) => t.status === "closed")
    .slice()
    .sort((a, b) => a._closeMs - b._closeMs);

  let running = startingBalance;
  for (const t of closedSorted) {
    const balanceBefore = running;
    if (balanceBefore > 0) {
      t.net_pct = (t.pnl + t.swap + t.commission) / balanceBefore;
    } else {
      t.net_pct = 0;
    }
    running = balanceBefore + t.pnl + t.swap + t.commission;
  }

  // Strip the temporary timestamp helpers and sort newest-first by open.
  const out: MappedTrade[] = tmp
    .map((t) => {
      const { _closeMs, _openMs, ...rest } = t;
      void _closeMs;
      void _openMs;
      return rest;
    })
    .sort((a, b) => {
      const ta = a.open ? new Date(a.open).getTime() : 0;
      const tb = b.open ? new Date(b.open).getTime() : 0;
      return tb - ta;
    });

  return out;
}

/**
 * Build a stable signature for an APEXHUB Trade so we can dedupe a freshly
 * mapped MetaApi position against an existing trade in the journal. We
 * combine symbol + side + lots + entry + open ISO; this is robust to floating
 * tail differences (lots/prices rounded to 5 decimals) and unique enough in
 * practice (a single account is unlikely to open two identical positions in
 * the same exact second).
 */
export function tradeSignature(t: {
  symbol?: string;
  direction?: string;
  lots?: number;
  entry?: number;
  open?: string;
}): string {
  const sym = (t.symbol ?? "").toUpperCase();
  const dir = (t.direction ?? "").toUpperCase();
  const lot = Number(t.lots ?? 0).toFixed(2);
  const ent = Number(t.entry ?? 0).toFixed(5);
  const op = (t.open ?? "").slice(0, 19);
  return `${sym}|${dir}|${lot}|${ent}|${op}`;
}
