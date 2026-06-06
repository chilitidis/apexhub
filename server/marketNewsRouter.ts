import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";

/**
 * Market News router.
 *
 * Pulls the weekly economic calendar published by Forex Factory (via the
 * faireconomy.media mirror, which exposes a stable JSON feed). The feed is
 * cached in-memory for a few minutes so a "Refresh" click is cheap and we do
 * not hammer the upstream source.
 *
 * We deliberately normalise the raw feed into a small, stable shape so the
 * frontend never depends on Forex Factory's exact field names.
 */

const FF_THIS_WEEK_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

export type MarketImpact = "High" | "Medium" | "Low" | "Holiday";

export interface MarketEvent {
  /** Stable id derived from title + date so React keys are stable. */
  id: string;
  title: string;
  /** 3-letter currency / country code, e.g. "USD". */
  currency: string;
  /** ISO-8601 timestamp (with upstream timezone offset). */
  date: string;
  /** Unix ms — convenient for client-side local formatting & grouping. */
  timestamp: number;
  impact: MarketImpact;
  forecast: string;
  previous: string;
}

interface RawEvent {
  title?: unknown;
  country?: unknown;
  date?: unknown;
  impact?: unknown;
  forecast?: unknown;
  previous?: unknown;
}

const eventSchema = z.object({
  id: z.string(),
  title: z.string(),
  currency: z.string(),
  date: z.string(),
  timestamp: z.number(),
  impact: z.enum(["High", "Medium", "Low", "Holiday"]),
  forecast: z.string(),
  previous: z.string(),
});

const responseSchema = z.object({
  events: z.array(eventSchema),
  fetchedAt: z.number(),
  source: z.string(),
  stale: z.boolean(),
});

export type MarketNewsResponse = z.infer<typeof responseSchema>;

// ---- in-memory cache -------------------------------------------------------

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cache: { events: MarketEvent[]; fetchedAt: number } | null = null;

function normaliseImpact(raw: unknown): MarketImpact {
  const s = String(raw ?? "").toLowerCase();
  if (s.startsWith("high")) return "High";
  if (s.startsWith("medium")) return "Medium";
  if (s.startsWith("holiday")) return "Holiday";
  return "Low";
}

function toEvent(raw: RawEvent, idx: number): MarketEvent | null {
  const title = String(raw.title ?? "").trim();
  const dateStr = String(raw.date ?? "").trim();
  if (!title || !dateStr) return null;
  const ts = Date.parse(dateStr);
  if (Number.isNaN(ts)) return null;
  const currency = String(raw.country ?? "").trim().toUpperCase();
  return {
    id: `${ts}-${currency}-${idx}-${title.slice(0, 24)}`,
    title,
    currency,
    date: dateStr,
    timestamp: ts,
    impact: normaliseImpact(raw.impact),
    forecast: String(raw.forecast ?? "").trim(),
    previous: String(raw.previous ?? "").trim(),
  };
}

/** Parse the raw upstream JSON array into normalised events. Exported for tests. */
export function parseForexFactoryFeed(rawJson: unknown): MarketEvent[] {
  if (!Array.isArray(rawJson)) return [];
  const out: MarketEvent[] = [];
  rawJson.forEach((item, idx) => {
    const ev = toEvent(item as RawEvent, idx);
    if (ev) out.push(ev);
  });
  out.sort((a, b) => a.timestamp - b.timestamp);
  return out;
}

async function fetchFeed(): Promise<MarketEvent[]> {
  const res = await fetch(FF_THIS_WEEK_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; UltimateTradingJournal/1.0; +https://ultimatradingjournal.com)",
      Accept: "application/json,text/plain,*/*",
    },
  });
  if (!res.ok) {
    throw new Error(`Forex Factory feed returned HTTP ${res.status}`);
  }
  const json = (await res.json()) as unknown;
  return parseForexFactoryFeed(json);
}

export const marketNewsRouter = router({
  /**
   * Returns this week's economic calendar events. Uses a short in-memory cache.
   * Pass `force: true` (the Refresh button) to bypass the cache.
   */
  events: protectedProcedure
    .input(
      z
        .object({ force: z.boolean().optional() })
        .optional()
        .default({}),
    )
    .query(async ({ input }): Promise<MarketNewsResponse> => {
      const now = Date.now();
      const fresh =
        cache && now - cache.fetchedAt < CACHE_TTL_MS && !input.force;

      if (fresh && cache) {
        return {
          events: cache.events,
          fetchedAt: cache.fetchedAt,
          source: "Forex Factory",
          stale: false,
        };
      }

      try {
        const events = await fetchFeed();
        cache = { events, fetchedAt: now };
        return {
          events,
          fetchedAt: now,
          source: "Forex Factory",
          stale: false,
        };
      } catch (err) {
        // On failure, serve stale cache if we have any; otherwise rethrow.
        if (cache) {
          return {
            events: cache.events,
            fetchedAt: cache.fetchedAt,
            source: "Forex Factory",
            stale: true,
          };
        }
        throw err;
      }
    }),
});
