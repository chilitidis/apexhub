import { z } from "zod";

/**
 * Optional "trader data" context the client can attach to coach chats and the
 * Weekly AI Review. Everything is optional and strictly size-capped: the block
 * is advisory grounding material, never a required input. The client computes
 * all numbers from the user's own journal (computeKPIs / analyzePatterns) —
 * the server only relays them to the model and never recomputes or stores them.
 */

const boundedNumber = z.number().finite();

const symbolPnlSchema = z.object({
  symbol: z.string().max(24),
  trades: z.number().int().nonnegative().max(1_000_000),
  pnl: boundedNumber,
});

const emotionStatSchema = z.object({
  key: z.string().max(32),
  trades: z.number().int().nonnegative().max(1_000_000),
  winRatePct: z.number().min(0).max(100),
  pnl: boundedNumber,
});

const dayStatSchema = z.object({
  key: z.string().max(32),
  trades: z.number().int().nonnegative().max(1_000_000),
  pnl: boundedNumber,
});

const recentTradeSchema = z.object({
  symbol: z.string().max(24),
  dir: z.enum(["BUY", "SELL"]),
  r: boundedNumber.nullable().optional(),
  net: boundedNumber,
  day: z.string().max(16).optional(),
  emotion: z.string().max(24).optional(),
});

export const coachContextSchema = z.object({
  stats: z
    .object({
      trades: z.number().int().nonnegative().max(1_000_000).optional(),
      winRatePct: z.number().min(0).max(100).optional(),
      totalPnl: boundedNumber.optional(),
      avgR: boundedNumber.optional(),
      bestDay: dayStatSchema.nullable().optional(),
      worstDay: dayStatSchema.nullable().optional(),
      topSymbolsByPnl: z.array(symbolPnlSchema).max(5).optional(),
      byEmotion: z.array(emotionStatSchema).max(6).optional(),
    })
    .optional(),
  recentTrades: z.array(recentTradeSchema).max(20).optional(),
});

export type CoachContext = z.infer<typeof coachContextSchema>;

/** Hard cap on the serialized context appended to the system prompt. */
export const COACH_CONTEXT_CHAR_CAP = 2000;

/**
 * Serialize the context compactly, staying under the char cap. Recent trades
 * are truncated first (they are the bulkiest and least essential part); as a
 * last resort the JSON itself is hard-sliced.
 */
export function serializeCoachContext(context: CoachContext): string {
  const recent = [...(context.recentTrades ?? [])];
  // Try with progressively fewer recent trades until we fit under the cap.
  for (let keep = recent.length; keep >= 0; keep--) {
    const candidate: CoachContext = {
      ...(context.stats ? { stats: context.stats } : {}),
      ...(keep > 0 ? { recentTrades: recent.slice(0, keep) } : {}),
    };
    const json = JSON.stringify(candidate);
    if (json.length <= COACH_CONTEXT_CHAR_CAP) return json;
  }
  return JSON.stringify(context.stats ?? {}).slice(0, COACH_CONTEXT_CHAR_CAP);
}

/**
 * Build the "TRADER DATA" block appended to a coach system prompt when the
 * client supplied real journal context. Tells the model to ground its advice
 * in this data, to mention it can see the trader's stats, and never to invent
 * numbers that are not present.
 */
export function buildTraderDataBlock(
  context: CoachContext,
  lang: "en" | "el" = "el",
): string {
  const json = serializeCoachContext(context);
  if (lang === "en") {
    return [
      "==== TRADER DATA (the user's real journal statistics) ====",
      "You CAN see this trader's actual performance data below (win rate, P&L, R, best/worst day, emotions, recent trades).",
      "Ground your advice in this data and reference its concrete numbers where relevant. Mention briefly (once) that you can see their journal stats.",
      "NEVER invent numbers, trades or statistics that are not present in this data.",
      json,
    ].join("\n");
  }
  return [
    "==== TRADER DATA (τα πραγματικά στατιστικά του journal του χρήστη) ====",
    "ΜΠΟΡΕΙΣ να δεις τα πραγματικά δεδομένα απόδοσης του trader παρακάτω (win rate, P&L, R, καλύτερη/χειρότερη ημέρα, συναισθήματα, πρόσφατα trades).",
    "Βάσισε τις συμβουλές σου σε αυτά τα δεδομένα και αναφέρσου στους συγκεκριμένους αριθμούς τους όπου ταιριάζει. Ανάφερε σύντομα (μία φορά) ότι βλέπεις τα στατιστικά του journal του.",
    "ΠΟΤΕ μην επινοείς αριθμούς, trades ή στατιστικά που δεν υπάρχουν σε αυτά τα δεδομένα.",
    json,
  ].join("\n");
}
