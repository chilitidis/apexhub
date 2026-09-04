import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createInvestorLink,
  getAccount,
  getActiveInvestorLinkForAccount,
  getInvestorLinkByToken,
  incrementInvestorViews,
  listAllTrades,
  listMonthlySnapshots,
  revokeInvestorLinks,
} from "./db";

/**
 * Investor Link router — MT5-investor-password-style live read-only view.
 *
 * The owner generates a SECRET per-account token (`/i/<token>`); anyone
 * holding the link sees a LIVE dashboard of that account without logging in
 * and with zero write ability. Rotating creates a fresh token and kills the
 * old one instantly; revoking kills the link outright.
 *
 * The public `data` payload is assembled server-side from the same monthly
 * snapshots + trades tables the journal uses, but is STRICTLY narrowed:
 * no notes, no psychology, no chart URLs, no user ids/emails — only the
 * whitelisted stats fields below ever leave the server.
 */

const accountIdInput = z.object({ accountId: z.number().int().positive() });

/** Hard cap on the number of trades a public investor view can pull. */
const MAX_INVESTOR_TRADES = 2000;

export const investorRouter = router({
  /** Current link state for one of the caller's accounts. */
  get: protectedProcedure.input(accountIdInput).query(async ({ ctx, input }) => {
    const account = await getAccount(ctx.user.id, input.accountId);
    if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
    const link = await getActiveInvestorLinkForAccount(ctx.user.id, input.accountId);
    return { token: link?.token ?? null, views: link?.views ?? 0 };
  }),

  /** Create (or rotate) the investor link — the previous token dies instantly. */
  create: protectedProcedure.input(accountIdInput).mutation(async ({ ctx, input }) => {
    const account = await getAccount(ctx.user.id, input.accountId);
    if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
    const link = await createInvestorLink(ctx.user.id, input.accountId);
    if (!link) throw new Error("Failed to create investor link");
    return { token: link.token };
  }),

  /** Revoke every active investor link for the account. */
  revoke: protectedProcedure.input(accountIdInput).mutation(async ({ ctx, input }) => {
    const account = await getAccount(ctx.user.id, input.accountId);
    if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
    await revokeInvestorLinks(ctx.user.id, input.accountId);
    return { success: true } as const;
  }),

  /**
   * Public live payload for a token. Returns null for unknown / revoked
   * tokens so the page can render a clean "link no longer active" state.
   */
  data: publicProcedure
    .input(z.object({ token: z.string().min(4).max(32) }))
    .query(async ({ input }) => {
      const link = await getInvestorLinkByToken(input.token);
      if (!link) return null;

      const account = await getAccount(link.userId, link.accountId);
      if (!account) return null;

      // Best-effort view counter; never blocks the read path.
      incrementInvestorViews(input.token).catch(() => undefined);

      const snapshots = await listMonthlySnapshots(link.userId, link.accountId);
      const months = snapshots
        .slice()
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
        .map((s) => ({
          monthKey: s.monthKey,
          starting: s.starting,
          ending: s.ending,
          netResult: s.netResult,
          returnPct: s.returnPct,
        }));

      const rows = await listAllTrades(link.userId, link.accountId);
      const trades = rows
        .slice()
        // Newest first (monthKey then idx), keep the most recent 2000, then
        // restore chronological order for the client.
        .sort((a, b) => b.monthKey.localeCompare(a.monthKey) || b.idx - a.idx)
        .slice(0, MAX_INVESTOR_TRADES)
        .reverse()
        // Whitelist projection — NEVER add notes/psychology/chart URLs here.
        .map((t) => ({
          monthKey: t.monthKey,
          symbol: t.symbol,
          direction: t.direction,
          pnl: t.pnl,
          netPct: t.netPct,
          rMultiple: t.tradeR ?? null,
          lot: t.lots,
          closedAt: t.closeTimeStr || t.day || "",
        }));

      return {
        account: {
          name: account.name,
          currency: account.currency,
          type: account.accountType,
          startingBalance: account.startingBalance,
        },
        months,
        trades,
      };
    }),
});
