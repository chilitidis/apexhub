/**
 * fxRates.ts — live USD-per-unit FX rates for accurate lot sizing.
 *
 * Source: https://open.er-api.com/v6/latest/USD (free, no key). That API
 * returns `rates` as UNITS-PER-USD (e.g. rates.JPY ≈ 150 → 150 JPY per 1
 * USD), so we INVERT every entry to get USD-per-1-unit (JPY ≈ 0.0067),
 * which is the exact shape of the client's static USD_PER_UNIT fallback
 * table. Cached in memory for 6 hours; on any failure we return null and the
 * client silently falls back to the static table (flagged "estimated").
 */

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const FX_URL = "https://open.er-api.com/v6/latest/USD";

export interface FxRatesResult {
  /** USD value of 1 unit of each currency, e.g. { JPY: 0.0067, EUR: 1.08 }. */
  usdPerUnit: Record<string, number>;
  /** Epoch ms of the fetch that produced this snapshot. */
  fetchedAt: number;
}

interface ErApiPayload {
  result?: string;
  rates?: Record<string, number>;
}

/** Invert an er-api payload (units-per-USD) into USD-per-unit. */
export function buildUsdPerUnit(payload: ErApiPayload): Record<string, number> | null {
  if (payload?.result !== "success" || !payload.rates) return null;
  const out: Record<string, number> = {};
  for (const [ccy, unitsPerUsd] of Object.entries(payload.rates)) {
    if (typeof unitsPerUsd === "number" && Number.isFinite(unitsPerUsd) && unitsPerUsd > 0) {
      out[ccy] = 1 / unitsPerUsd;
    }
  }
  if (!out.USD) out.USD = 1;
  return Object.keys(out).length > 1 ? out : null;
}

let cache: FxRatesResult | null = null;

export async function getFxRates(): Promise<FxRatesResult | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache;
  try {
    const res = await fetch(FX_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = (await res.json()) as ErApiPayload;
    const usdPerUnit = buildUsdPerUnit(payload);
    if (!usdPerUnit) throw new Error("unexpected payload shape");
    cache = { usdPerUnit, fetchedAt: Date.now() };
    return cache;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[FxRates] fetch failed, falling back to static table:", msg);
    // Serve a stale cache rather than nothing — stale live beats static.
    return cache ?? null;
  }
}

/** Test hook. */
export function __resetFxCache(): void {
  cache = null;
}
