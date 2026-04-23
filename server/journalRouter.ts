import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  deleteActiveTrade,
  deleteMonthlySnapshot,
  getActiveTrade,
  listMonthlySnapshots,
  upsertActiveTrade,
  upsertMonthlySnapshot,
} from "./db";

const snapshotInputSchema = z.object({
  monthKey: z.string().min(1).max(16),
  monthName: z.string().min(1).max(32),
  yearFull: z.string().min(1).max(8),
  yearShort: z.string().min(1).max(4),
  starting: z.number(),
  ending: z.number(),
  netResult: z.number(),
  returnPct: z.number(),
  totalTrades: z.number().int(),
  wins: z.number().int(),
  losses: z.number().int(),
  winRate: z.number(),
  maxDrawdownPct: z.number(),
  tradesJson: z.string(),
});

const activeTradeSchema = z.object({
  symbol: z.string().min(1).max(32),
  direction: z.enum(["BUY", "SELL"]),
  lots: z.number(),
  entry: z.number(),
  currentPrice: z.number(),
  openTime: z.string().max(64),
  floatingPnl: z.number(),
  balance: z.number(),
});

export const journalRouter = router({
  listSnapshots: protectedProcedure.query(async ({ ctx }) => {
    return listMonthlySnapshots(ctx.user.id);
  }),

  upsertSnapshot: protectedProcedure
    .input(snapshotInputSchema)
    .mutation(async ({ ctx, input }) => {
      const row = await upsertMonthlySnapshot(ctx.user.id, input);
      return row;
    }),

  deleteSnapshot: protectedProcedure
    .input(z.object({ monthKey: z.string().min(1).max(16) }))
    .mutation(async ({ ctx, input }) => {
      await deleteMonthlySnapshot(ctx.user.id, input.monthKey);
      return { success: true } as const;
    }),

  getActiveTrade: protectedProcedure.query(async ({ ctx }) => {
    const row = await getActiveTrade(ctx.user.id);
    return row ?? null;
  }),

  upsertActiveTrade: protectedProcedure
    .input(activeTradeSchema)
    .mutation(async ({ ctx, input }) => {
      const row = await upsertActiveTrade(ctx.user.id, input);
      return row;
    }),

  deleteActiveTrade: protectedProcedure.mutation(async ({ ctx }) => {
    await deleteActiveTrade(ctx.user.id);
    return { success: true } as const;
  }),
});
