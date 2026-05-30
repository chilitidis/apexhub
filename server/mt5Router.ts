import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  deleteMt5Account,
  getAccount,
  getMt5Account,
  listMt5Accounts,
  updateMt5State,
  upsertMt5Account,
} from "./db";
import { decryptPassword } from "./_core/cryptoCreds";
import {
  deployAndWait,
  ensureMetaApiAccount,
  fetchDealsForRange,
} from "./_core/metaapiClient";
import { mapDealsToTrades, type MetaApiDeal } from "./_core/mt5Mapper";

/**
 * MT5 / MetaApi router.
 *
 * The shape mirrors the existing `accountsRouter`: a small CRUD surface for
 * the connection metadata, plus a `sync` mutation that performs the live
 * MetaApi round-trip (provision → deploy → fetch deals → map to trades).
 *
 * Sync flow:
 *  1. Look up the row, verify the user owns the linked APEXHUB account.
 *  2. Decrypt the password, ensure a MetaApi account exists for (login, server),
 *     persist its UUID back so we don't re-create on subsequent syncs.
 *  3. Deploy + waitConnected (idempotent — fast on already-deployed accounts).
 *  4. Pull deals from `since` (default: 90 days back) up to now, run the
 *     mapper, and return the resulting trades. The frontend is responsible
 *     for splitting them by month and writing them via the existing
 *     `journal.upsertSnapshot` mutations — this keeps the sync stateless on
 *     the server and avoids touching the journal write path twice.
 */

const platformSchema = z.enum(["mt4", "mt5"]);

async function assertOwnsAccount(userId: number, accountId: number) {
  const acc = await getAccount(userId, accountId);
  if (!acc) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
  }
  return acc;
}

export const mt5Router = router({
  /** List broker connections for the current user (no decrypted passwords). */
  list: protectedProcedure.query(async ({ ctx }) => {
    return listMt5Accounts(ctx.user.id);
  }),

  /**
   * Create or update a broker connection. Re-saving with the same
   * (server, login) overwrites the password (intended — users rotate
   * broker passwords or fix typos and click Save again).
   */
  upsert: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(128).default(""),
        platform: platformSchema.default("mt5"),
        server: z.string().min(1).max(128),
        login: z.string().min(1).max(64),
        password: z.string().min(1).max(256),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnsAccount(ctx.user.id, input.accountId);
      const row = await upsertMt5Account(ctx.user.id, {
        accountId: input.accountId,
        name: input.name || `${input.platform.toUpperCase()} ${input.login}`,
        platform: input.platform,
        server: input.server,
        login: input.login,
        password: input.password,
      });
      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to persist MT5 connection",
        });
      }
      // Strip cipher before returning to client.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordCipher: _omit, ...safe } = row;
      return safe;
    }),

  /** Hard-delete a broker connection (does not touch trades already imported). */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const row = await getMt5Account(ctx.user.id, input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      await deleteMt5Account(ctx.user.id, input.id);
      return { success: true } as const;
    }),

  /**
   * Run a sync. Fetches deals via MetaApi, maps to APEXHUB trades, and
   * returns them along with updated state metadata. The frontend writes
   * them into the journal so the user can review before persisting.
   *
   * `sinceMs` defaults to 90 days back to keep the first MetaApi sync
   * within the free-tier history window; callers can override for a wider
   * back-fill.
   */
  sync: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        sinceMs: z.number().int().nonnegative().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await getMt5Account(ctx.user.id, input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found" });
      await assertOwnsAccount(ctx.user.id, row.accountId);

      await updateMt5State(ctx.user.id, row.id, { state: "connecting", lastError: null });

      try {
        const password = decryptPassword(row.passwordCipher);
        const { id: metaapiAccountId, account } = await ensureMetaApiAccount({
          login: row.login,
          password,
          server: row.server,
          platform: row.platform as "mt4" | "mt5",
          name: row.name || `APEXHUB ${row.platform.toUpperCase()} ${row.login}`,
        });

        if (metaapiAccountId !== row.metaapiAccountId) {
          await updateMt5State(ctx.user.id, row.id, { metaapiAccountId });
        }

        await deployAndWait(account);

        const since = new Date(input.sinceMs ?? Date.now() - 90 * 24 * 60 * 60 * 1000);
        const until = new Date();
        const deals = (await fetchDealsForRange(account, since, until)) as MetaApiDeal[];
        const trades = mapDealsToTrades(deals);

        await updateMt5State(ctx.user.id, row.id, {
          state: "connected",
          lastError: null,
          lastSyncedAt: new Date(),
        });

        return {
          accountId: row.accountId,
          metaapiAccountId,
          dealCount: deals.length,
          trades,
          since: since.toISOString(),
          until: until.toISOString(),
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown sync error";
        await updateMt5State(ctx.user.id, row.id, {
          state: "error",
          lastError: message.slice(0, 1000),
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),
});
