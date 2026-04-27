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

/**
 * Best-effort JSON parser for LLM output.
 *
 * Production providers occasionally:
 *   - wrap JSON in ```json ... ``` markdown fences
 *   - prefix with explanatory prose ("Sure! Here is the JSON:")
 *   - emit trailing commas or smart quotes
 *
 * We:
 *   1. try `JSON.parse` directly
 *   2. strip code fences and try again
 *   3. extract the substring between the first `{` and the last `}`
 *   4. drop trailing commas before `}` / `]`
 *
 * Returns `undefined` if every attempt fails.
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

  // Same again on the fenced version, in case fences contained surrounding prose.
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

  // Parses an MT5 trade screenshot via the server-side Manus LLM vision model and
  // returns structured fields (symbol / direction / entry / SL / TP / lots / P&L /
  // open+close time). The image is ALSO persisted to storage so the UI can show a
  // thumbnail next to the saved trade. Client-side Tesseract was removed because
  // it could not reliably extract MT5 text; the LLM path is the one that worked in
  // production.
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
              "Always emit timestamps as ISO 8601 (e.g. 2026-04-25T12:30:00Z). MT5 native format " +
              "`YYYY.MM.DD HH:mm[:ss]` MUST be converted to ISO 8601 before returning.",
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
