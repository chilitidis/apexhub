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
}

export interface MappedTrade {
  positionId: string;
  symbol: string;
  direction: "BUY" | "SELL";
  lots: number;
  entry: number;
  close: number;
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

/**
 * Group a flat list of MetaApi deals by `positionId` and reduce each group
 * into a single APEXHUB trade. Filters out balance/credit transactions
 * (entryType absent or DEAL_TYPE_BALANCE) which are not trading positions.
 */
export function mapDealsToTrades(deals: MetaApiDeal[]): MappedTrade[] {
  const byPos = new Map<string, MetaApiDeal[]>();
  for (const d of deals) {
    if (!d || !d.positionId) continue;
    if (d.type === "DEAL_TYPE_BALANCE") continue;
    if (d.type !== "DEAL_TYPE_BUY" && d.type !== "DEAL_TYPE_SELL") continue;
    const list = byPos.get(d.positionId) ?? [];
    list.push(d);
    byPos.set(d.positionId, list);
  }

  const out: MappedTrade[] = [];
  for (const [positionId, group] of Array.from(byPos.entries())) {
    // Sort chronologically so the IN deal is first and OUT deals follow.
    group.sort((a: MetaApiDeal, b: MetaApiDeal) => {
      const ta = a.time ? new Date(a.time).getTime() : 0;
      const tb = b.time ? new Date(b.time).getTime() : 0;
      return ta - tb;
    });

    const inDeal = group.find((d: MetaApiDeal) => d.entryType === "DEAL_ENTRY_IN");
    if (!inDeal) continue; // Position never opened (orphan OUT, ignore).

    const outDeals = group.filter((d: MetaApiDeal) => d.entryType === "DEAL_ENTRY_OUT");
    const symbol = (inDeal.symbol ?? group[0]?.symbol ?? "").toUpperCase();
    // Direction: a BUY entry-in is a long (BUY) position; a SELL entry-in is short (SELL).
    const direction: "BUY" | "SELL" = inDeal.type === "DEAL_TYPE_BUY" ? "BUY" : "SELL";

    const lots = num(inDeal.volume);
    const entry = num(inDeal.price);

    // For the exit price use the volume-weighted average across OUT deals.
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

    // Net realised profit / swap / commission across the entire position
    // (entry deals usually carry commission, exit deals usually carry profit).
    const pnl = group.reduce((acc: number, d: MetaApiDeal) => acc + num(d.profit), 0);
    const swap = group.reduce((acc: number, d: MetaApiDeal) => acc + num(d.swap), 0);
    const commission = group.reduce((acc: number, d: MetaApiDeal) => acc + num(d.commission), 0);

    const status: "open" | "closed" = outDeals.length > 0 ? "closed" : "open";
    const open = toIso(inDeal.time);
    const close_time = status === "closed" ? toIso(outDeals[outDeals.length - 1].time) : "";

    out.push({
      positionId,
      symbol,
      direction,
      lots,
      entry,
      close: status === "closed" ? exit : 0,
      pnl: status === "closed" ? pnl : 0,
      swap: status === "closed" ? swap : 0,
      commission,
      open,
      close_time,
      status,
    });
  }

  // Newest first so the most recent activity appears at the top after import.
  out.sort((a, b) => {
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
  // Compare on the second resolution to absorb tiny clock skews.
  const op = (t.open ?? "").slice(0, 19);
  return `${sym}|${dir}|${lot}|${ent}|${op}`;
}
