import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { findInstrument, normalizeSymbol } from "../shared/instruments";
import { adminProcedure, protectedProcedure, router } from "./_core/trpc";
import { insertSignal, listRecentSignals, updateSignalStatus } from "./db";
import { getFxRates } from "./fxRates";

/**
 * Team Signals router.
 *
 * `list` + `fxRates` are member-facing (any signed-in user); `create` and
 * `close` are the admin-only manual fallback for when Telegram is down or the
 * owner wants to post from the site directly. The primary ingestion path is
 * the Telegram webhook in server/telegram.ts.
 */

const priceSchema = z.number().positive().finite();

const createSchema = z.object({
  symbol: z.string().min(3).max(20),
  direction: z.enum(["BUY", "SELL"]),
  entry: priceSchema.nullish(),
  sl: priceSchema,
  tp1: priceSchema.nullish(),
  tp2: priceSchema.nullish(),
  tp3: priceSchema.nullish(),
});

/** decimal columns want strings; keep full precision without float notation. */
function dec(n: number | null | undefined): string | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  return n.toFixed(6);
}

export const signalsRouter = router({
  /** Latest 20 signals, all statuses, newest first. */
  list: protectedProcedure.query(async () => {
    return listRecentSignals(20);
  }),

  /**
   * Live USD-per-1-unit FX map (6h server cache) for exact cross-currency
   * lot sizing. Returns null when the upstream feed is unavailable — the
   * client then falls back to its static table and flags the estimate.
   */
  fxRates: protectedProcedure.query(async () => {
    return getFxRates();
  }),

  /** Admin-only manual signal (fallback when Telegram is unavailable). */
  create: adminProcedure.input(createSchema).mutation(async ({ input }) => {
    const symbol = normalizeSymbol(input.symbol);
    if (!findInstrument(symbol)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown instrument: ${input.symbol}` });
    }
    const entry = input.entry ?? null;
    if (entry !== null) {
      const wrongSide = input.direction === "BUY" ? input.sl >= entry : input.sl <= entry;
      if (wrongSide) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "SL on wrong side" });
      }
    }
    const id = await insertSignal({
      symbol,
      direction: input.direction,
      entryType: entry !== null ? "limit" : "market",
      entry: dec(entry),
      sl: dec(input.sl)!,
      tp1: dec(input.tp1),
      tp2: dec(input.tp2),
      tp3: dec(input.tp3),
      rawText: null,
    });
    return { id } as const;
  }),

  /** Admin-only status change (close / cancel / reactivate). */
  close: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["closed", "cancelled", "active"]).default("closed"),
      }),
    )
    .mutation(async ({ input }) => {
      await updateSignalStatus(input.id, input.status);
      return { success: true } as const;
    }),
});
