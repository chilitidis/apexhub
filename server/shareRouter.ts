import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createShare,
  deleteShare,
  getAccount,
  getShareByToken,
  incrementShareViews,
  listSharesForUser,
} from "./db";

/**
 * Payload schema persisted inside `shares.payloadJson`. Kept intentionally
 * narrow so a share snapshot never leaks sensitive chart URLs or the full
 * trade notes — public viewers see KPIs + a small sample of trades.
 */
const sharePayloadSchema = z.object({
  version: z.literal(1),
  accountName: z.string().max(64),
  accountType: z.string().max(16).optional(),
  accountColor: z.string().max(16).optional(),
  monthLabel: z.string().max(32).optional(),
  // Optional visual theme. Mirrors the app's current theme at the moment
  // the snapshot was created so public viewers see the same look-and-feel
  // the trader saw when they hit Share. Defaults to "dark" server-side.
  theme: z.enum(["light", "dark"]).optional(),
  starting: z.number(),
  ending: z.number(),
  netResult: z.number(),
  returnPct: z.number(),
  winRate: z.number(),
  totalTrades: z.number().int(),
  wins: z.number().int(),
  losses: z.number().int(),
  bestTradeUsd: z.number().optional(),
  worstTradeUsd: z.number().optional(),
  bestSymbol: z.string().max(32).optional(),
  worstSymbol: z.string().max(32).optional(),
  profitFactor: z.number().optional(),
  avgR: z.number().optional(),
  maxDrawdownPct: z.number().optional(),
  // Full trade table rendered on the share card. Cap raised from 20 to 200
  // so users with heavy months still get every trade in the snapshot.
  // Still strictly limited to keep payloadJson bounded and to prevent
  // any individual share from bloating the DB.
  trades: z
    .array(
      z.object({
        symbol: z.string().max(32),
        direction: z.enum(["BUY", "SELL"]),
        pnl: z.number(),
        netPct: z.number().optional(),
      }),
    )
    .max(200),
});

export type SharePayload = z.infer<typeof sharePayloadSchema>;

export const shareRouter = router({
  /** Create a new public share from the currently-open journal data. */
  create: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        monthKey: z.string().max(16).optional(),
        payload: sharePayloadSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Defense in depth: make sure the caller actually owns the account.
      const account = await getAccount(ctx.user.id, input.accountId);
      if (!account) throw new Error("Account not found");

      const row = await createShare(ctx.user.id, {
        accountId: input.accountId,
        monthKey: input.monthKey,
        payloadJson: JSON.stringify(input.payload),
      });
      if (!row) throw new Error("Failed to create share");
      return { token: row.token, createdAt: row.createdAt };
    }),

  /** Public view: fetch the payload for a share token. Logs a view count. */
  view: publicProcedure
    .input(z.object({ token: z.string().min(4).max(32) }))
    .query(async ({ input }) => {
      const row = await getShareByToken(input.token);
      if (!row) return null;
      if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
      // Best-effort view counter; swallow errors so a failed update doesn't
      // block the read path.
      incrementShareViews(input.token).catch(() => undefined);

      let payload: SharePayload | null = null;
      try {
        payload = sharePayloadSchema.parse(JSON.parse(row.payloadJson));
      } catch {
        payload = null;
      }
      if (!payload) return null;
      return {
        token: row.token,
        createdAt: row.createdAt,
        views: row.views + 1,
        payload,
      };
    }),

  /** List the signed-in user's existing shares (for dashboard UI). */
  list: protectedProcedure.query(async ({ ctx }) =>
    listSharesForUser(ctx.user.id),
  ),

  /** Delete one of the caller's shares. */
  delete: protectedProcedure
    .input(z.object({ token: z.string().min(4).max(32) }))
    .mutation(async ({ ctx, input }) => {
      await deleteShare(ctx.user.id, input.token);
      return { success: true } as const;
    }),
});
