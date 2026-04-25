import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import {
  deleteActiveTrade,
  deleteMonthlySnapshot,
  deleteTrade,
  deleteTradesForMonth,
  getActiveTrade,
  listAllTrades,
  listMonthlySnapshots,
  listTradesForMonth,
  replaceTradesForMonth,
  type TradeInput,
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

function tradeToRowInput(
  monthKey: string,
  t: z.infer<typeof tradeFromJsonSchema>,
): TradeInput {
  return {
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
      // Keep the per-trade projection in sync so listTrades returns fresh rows.
      const parsed = parseTradesJson(input.tradesJson);
      const rowInputs = parsed.map((t) => tradeToRowInput(input.monthKey, t));
      try {
        await replaceTradesForMonth(ctx.user.id, input.monthKey, rowInputs);
      } catch (e) {
        // Never break the snapshot write because of projection sync issues.
        console.warn("[journal] replaceTradesForMonth failed", e);
      }
      return row;
    }),

  deleteSnapshot: protectedProcedure
    .input(z.object({ monthKey: z.string().min(1).max(16) }))
    .mutation(async ({ ctx, input }) => {
      await deleteMonthlySnapshot(ctx.user.id, input.monthKey);
      try {
        await deleteTradesForMonth(ctx.user.id, input.monthKey);
      } catch (e) {
        console.warn("[journal] deleteTradesForMonth failed", e);
      }
      return { success: true } as const;
    }),

  // Per-trade listing — flattened projection of all trades for the user, or a
  // single month when `monthKey` is provided. Used by analytics surfaces that
  // want to avoid pulling the monthly JSON blob.
  listTrades: protectedProcedure
    .input(z.object({ monthKey: z.string().min(1).max(16).optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (input?.monthKey) return listTradesForMonth(ctx.user.id, input.monthKey);
      return listAllTrades(ctx.user.id);
    }),

  upsertTrade: protectedProcedure
    .input(
      z.object({
        monthKey: z.string().min(1).max(16),
        trade: tradeFromJsonSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await upsertTrade(ctx.user.id, tradeToRowInput(input.monthKey, input.trade));
      return { success: true } as const;
    }),

  deleteTrade: protectedProcedure
    .input(
      z.object({
        monthKey: z.string().min(1).max(16),
        idx: z.number().int(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await deleteTrade(ctx.user.id, input.monthKey, input.idx);
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

  // Parses an MT5 trade screenshot via LLM vision and returns structured fields.
  // We upload the image to storage first so the LLM can see it via public URL.
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

      const imageUrl = url.startsWith("http") ? url : `${process.env.PUBLIC_BASE_URL ?? ""}${url}`;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You extract executed-trade details from a MetaTrader (MT5) or similar trading platform screenshot. " +
              "Return strictly the JSON schema. Use BUY or SELL (uppercase). " +
              "If a value is unreadable, use null for sl/tp, 0 for swap/commission, and empty strings for timestamps. " +
              "Profit is negative for losing trades.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the trade shown in this screenshot." },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
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

      const raw = response.choices?.[0]?.message?.content;
      if (!raw || typeof raw !== "string") throw new Error("LLM did not return a parsable response");
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error("LLM returned invalid JSON");
      }
      return { screenshotUrl: url, extracted: parsed };
    }),
});
