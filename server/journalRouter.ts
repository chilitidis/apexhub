import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import {
  createAccount,
  deleteAccount,
  deleteActiveTrade,
  deleteMonthlySnapshot,
  deleteTrade,
  deleteTradesForMonth,
  ensureDefaultAccount,
  getAccount,
  getActiveTrade,
  listAccounts,
  listAllTrades,
  listMonthlySnapshots,
  listTradesForMonth,
  replaceTradesForMonth,
  type TradeInput,
  updateAccount,
  upsertActiveTrade,
  upsertMonthlySnapshot,
  upsertTrade,
} from "./db";

const extractInputSchema = z.object({
  // Base64 data URL: "data:image/png;base64,AAAA..."
  dataUrl: z.string().min(32).max(20_000_000),
});

const extractedTradeSchema = {
  type: "object",
  properties: {
    symbol: { type: "string", description: "Trading instrument, e.g. EURUSD, XAUUSD, US30" },
    direction: { type: "string", enum: ["BUY", "SELL"], description: "Order side" },
    lots: { type: "number", description: "Volume in lots" },
    entry: { type: "number", description: "Entry / open price" },
    close: { type: "number", description: "Exit / close price" },
    sl: { type: ["number", "null"], description: "Stop loss price or null" },
    tp: { type: ["number", "null"], description: "Take profit price or null" },
    pnl: { type: "number", description: "Net profit in account currency (negative for losses)" },
    swap: { type: "number", description: "Swap charge; 0 if unknown" },
    commission: { type: "number", description: "Commission; 0 if unknown" },
    open_time: { type: "string", description: "Open date/time in ISO 8601 or MT5 native format, empty if unknown" },
    close_time: { type: "string", description: "Close date/time in ISO 8601 or MT5 native format, empty if unknown" },
  },
  required: [
    "symbol", "direction", "lots", "entry", "close", "sl", "tp", "pnl", "swap", "commission", "open_time", "close_time"
  ],
  additionalProperties: false,
} as const;

const snapshotInputSchema = z.object({
  accountId: z.number().int().positive(),
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

// Matches the UI Trade shape, with snake_case keys converted to the DB column
// names via the mapper below. Keep this loose on purpose (trade JSON can carry
// optional fields and historical seeds have varying shapes).
const tradeFromJsonSchema = z.object({
  idx: z.number().int(),
  symbol: z.string(),
  direction: z.enum(["BUY", "SELL"]),
  lots: z.number(),
  entry: z.number(),
  close: z.number().optional(),
  sl: z.number().nullable().optional(),
  tp: z.number().nullable().optional(),
  trade_r: z.number().nullable().optional(),
  pnl: z.number(),
  swap: z.number().optional(),
  commission: z.number().optional(),
  net_pct: z.number().optional(),
  tf: z.string().optional(),
  chart_before: z.string().optional(),
  chart_after: z.string().optional(),
  open: z.string().optional(),
  close_time: z.string().optional(),
  day: z.string().optional(),
});

/**
 * Best-effort JSON parser for LLM output. See inline notes.
 */
export function parseLooseJson(raw: string): unknown | undefined {
  const text = raw.trim();
  if (!text) return undefined;

  const attempts: string[] = [text];

  const fenced = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  if (fenced !== text) attempts.push(fenced);

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    attempts.push(text.slice(first, last + 1));
  }

  const f1 = fenced.indexOf("{");
  const f2 = fenced.lastIndexOf("}");
  if (f1 >= 0 && f2 > f1) {
    attempts.push(fenced.slice(f1, f2 + 1));
  }

  for (const candidate of attempts) {
    const cleaned = candidate.replace(/,(\s*[}\]])/g, "$1");
    try {
      return JSON.parse(cleaned);
    } catch {
      // try the next candidate
    }
  }
  return undefined;
}

function tradeToRowInput(
  accountId: number,
  monthKey: string,
  t: z.infer<typeof tradeFromJsonSchema>,
): TradeInput {
  return {
    accountId,
    monthKey,
    idx: t.idx,
    symbol: t.symbol,
    direction: t.direction,
    lots: t.lots,
    entry: t.entry,
    closePrice: t.close ?? 0,
    sl: t.sl ?? null,
    tp: t.tp ?? null,
    tradeR: t.trade_r ?? null,
    pnl: t.pnl,
    swap: t.swap ?? 0,
    commission: t.commission ?? 0,
    netPct: t.net_pct ?? 0,
    tf: t.tf ?? "",
    chartBefore: t.chart_before ?? "",
    chartAfter: t.chart_after ?? "",
    openStr: t.open ?? "",
    closeTimeStr: t.close_time ?? "",
    day: t.day ?? "",
  };
}

function parseTradesJson(tradesJson: string): z.infer<typeof tradeFromJsonSchema>[] {
  try {
    const arr = JSON.parse(tradesJson);
    if (!Array.isArray(arr)) return [];
    const parsed = tradeFromJsonSchema.array().safeParse(arr);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

const activeTradeSchema = z.object({
  accountId: z.number().int().positive(),
  symbol: z.string().min(1).max(32),
  direction: z.enum(["BUY", "SELL"]),
  lots: z.number(),
  entry: z.number(),
  currentPrice: z.number(),
  openTime: z.string().max(64),
  floatingPnl: z.number(),
  balance: z.number(),
});

async function assertAccount(userId: number, accountId: number) {
  const acc = await getAccount(userId, accountId);
  if (!acc) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Account not found or access denied.",
    });
  }
  return acc;
}

export const accountsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    // Ensure the user always has at least one account (auto-migrate legacy rows).
    await ensureDefaultAccount(ctx.user.id);
    return listAccounts(ctx.user.id);
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(128),
        startingBalance: z.number().default(0),
        accountType: z.enum(["prop", "live", "demo", "other"]).default("other"),
        currency: z.string().max(8).default("USD"),
        color: z.string().max(16).default("#0077B6"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return createAccount(ctx.user.id, input);
    }),

  update: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(128).optional(),
        startingBalance: z.number().optional(),
        accountType: z.enum(["prop", "live", "demo", "other"]).optional(),
        currency: z.string().max(8).optional(),
        color: z.string().max(16).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertAccount(ctx.user.id, input.accountId);
      const { accountId, ...patch } = input;
      return updateAccount(ctx.user.id, accountId, patch);
    }),

  delete: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertAccount(ctx.user.id, input.accountId);
      const remaining = await listAccounts(ctx.user.id);
      if (remaining.length <= 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete your last remaining account.",
        });
      }
      await deleteAccount(ctx.user.id, input.accountId);
      return { success: true } as const;
    }),
});

export const journalRouter = router({
  listSnapshots: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertAccount(ctx.user.id, input.accountId);
      return listMonthlySnapshots(ctx.user.id, input.accountId);
    }),

  upsertSnapshot: protectedProcedure
    .input(snapshotInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertAccount(ctx.user.id, input.accountId);
      const row = await upsertMonthlySnapshot(ctx.user.id, input);
      // Keep the per-trade projection in sync so listTrades returns fresh rows.
      const parsed = parseTradesJson(input.tradesJson);
      const rowInputs = parsed.map((t) => tradeToRowInput(input.accountId, input.monthKey, t));
      try {
        await replaceTradesForMonth(ctx.user.id, input.accountId, input.monthKey, rowInputs);
      } catch (e) {
        // Never break the snapshot write because of projection sync issues.
        console.warn("[journal] replaceTradesForMonth failed", e);
      }
      return row;
    }),

  deleteSnapshot: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        monthKey: z.string().min(1).max(16),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertAccount(ctx.user.id, input.accountId);
      await deleteMonthlySnapshot(ctx.user.id, input.accountId, input.monthKey);
      try {
        await deleteTradesForMonth(ctx.user.id, input.accountId, input.monthKey);
      } catch (e) {
        console.warn("[journal] deleteTradesForMonth failed", e);
      }
      return { success: true } as const;
    }),

  // Per-trade listing — flattened projection of all trades for the (user, account)
  // pair, or a single month when `monthKey` is provided.
  listTrades: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        monthKey: z.string().min(1).max(16).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertAccount(ctx.user.id, input.accountId);
      if (input.monthKey) return listTradesForMonth(ctx.user.id, input.accountId, input.monthKey);
      return listAllTrades(ctx.user.id, input.accountId);
    }),

  upsertTrade: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        monthKey: z.string().min(1).max(16),
        trade: tradeFromJsonSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertAccount(ctx.user.id, input.accountId);
      await upsertTrade(
        ctx.user.id,
        tradeToRowInput(input.accountId, input.monthKey, input.trade),
      );
      return { success: true } as const;
    }),

  deleteTrade: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        monthKey: z.string().min(1).max(16),
        idx: z.number().int(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertAccount(ctx.user.id, input.accountId);
      await deleteTrade(ctx.user.id, input.accountId, input.monthKey, input.idx);
      return { success: true } as const;
    }),

  getActiveTrade: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertAccount(ctx.user.id, input.accountId);
      const row = await getActiveTrade(ctx.user.id, input.accountId);
      return row ?? null;
    }),

  upsertActiveTrade: protectedProcedure
    .input(activeTradeSchema)
    .mutation(async ({ ctx, input }) => {
      await assertAccount(ctx.user.id, input.accountId);
      const row = await upsertActiveTrade(ctx.user.id, input);
      return row;
    }),

  deleteActiveTrade: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertAccount(ctx.user.id, input.accountId);
      await deleteActiveTrade(ctx.user.id, input.accountId);
      return { success: true } as const;
    }),

  // Parses an MT5 trade screenshot via the server-side Manus LLM vision model and
  // returns structured fields. The image is persisted to storage so the UI can
  // show a thumbnail next to the saved trade.
  extractTradeFromScreenshot: protectedProcedure
    .input(extractInputSchema)
    .mutation(async ({ ctx, input }) => {
      const match = input.dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) throw new Error("Invalid image data URL");
      const [, mime, b64] = match;
      const buffer = Buffer.from(b64, "base64");
      const ext = mime.split("/")[1] || "png";
      const key = `${ctx.user.id}/trade-screenshots/${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, mime);

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You extract executed-trade details from a MetaTrader (MT5) or similar trading platform screenshot. " +
              "Return ONLY a single JSON object that satisfies the schema, with no surrounding prose or markdown. " +
              "Use BUY or SELL (uppercase). If a value is unreadable, use null for sl/tp, 0 for swap/commission, " +
              "and empty strings for timestamps. Profit is negative for losing trades. " +
              "\n\nCRITICAL TIMESTAMP RULES (read carefully):\n" +
              "1. MT5 screenshots show two timestamps in the format `YYYY.MM.DD HH:MM:SS` separated by an arrow `\u2192`. " +
              "The LEFT one is open_time, the RIGHT one is close_time.\n" +
              "2. COPY THE DIGITS EXACTLY AS THEY APPEAR. Do NOT add hours, do NOT shift timezones, do NOT convert AM/PM, do NOT round seconds. " +
              "If the screenshot says `05:09:22` you must return `05:09:22`, never `08:09` or `13:09`.\n" +
              "3. Return timestamps as `YYYY-MM-DDTHH:MM:SS` (no `Z`, no `+HH:MM` suffix, no fractional seconds). " +
              "Example: screenshot `2026.04.28 05:09:22` \u2192 `2026-04-28T05:09:22`.\n" +
              "4. MT5 timestamps are already in broker time. They are NOT UTC. Do NOT perform any timezone conversion under any circumstances.\n" +
              "5. If only one timestamp is visible, put it in open_time and leave close_time empty.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the trade shown in this screenshot." },
              { type: "image_url", image_url: { url: input.dataUrl, detail: "high" } },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "trade_extraction",
            strict: true,
            schema: extractedTradeSchema,
          },
        },
      });

      const rawMessage = response.choices?.[0]?.message?.content;
      const raw = typeof rawMessage === "string"
        ? rawMessage
        : Array.isArray(rawMessage)
          ? rawMessage
              .map((c: unknown) => {
                if (typeof c === "string") return c;
                if (c && typeof c === "object" && "text" in c) {
                  const t = (c as { text?: unknown }).text;
                  return typeof t === "string" ? t : "";
                }
                return "";
              })
              .join("")
          : "";

      if (!raw.trim()) {
        throw new Error(
          "The screenshot scanner did not get a response from the AI model. Please try again.",
        );
      }

      const parsed = parseLooseJson(raw);
      if (parsed === undefined || typeof parsed !== "object" || parsed === null) {
        throw new Error(
          "The AI model returned a response we could not parse. Please fill the trade manually.",
        );
      }

      return { screenshotUrl: url, extracted: parsed };
    }),
});
