import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";

/**
 * Pattern Analysis router.
 *
 * The deterministic math (win rate by day/instrument/setup/emotion, etc.) is
 * computed on the client from the trader's own trades. This router only adds an
 * optional natural-language *narrative* on top of those already-computed
 * numbers — it never invents statistics. We pass a compact, pre-aggregated
 * summary to the LLM and ask for a short Greek paragraph.
 */

const groupStatSchema = z.object({
  key: z.string().max(64),
  trades: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  win_rate: z.number().min(0).max(1),
  pnl: z.number(),
  avg_pnl: z.number(),
});

const summaryInputSchema = z.object({
  closedTrades: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  winRate: z.number().min(0).max(1),
  totalPnl: z.number(),
  byDay: z.array(groupStatSchema).max(10),
  byInstrument: z.array(groupStatSchema).max(15),
  bySetup: z.array(groupStatSchema).max(20),
  byEmotion: z.array(groupStatSchema).max(20),
  bestDay: groupStatSchema.nullable(),
  bestInstrument: groupStatSchema.nullable(),
});

export const patternRouter = router({
  /**
   * Returns a short Greek narrative summarising the trader's patterns. Falls
   * back to a deterministic sentence if the LLM is unavailable, so the UI never
   * breaks.
   */
  summarize: protectedProcedure
    .input(summaryInputSchema)
    .mutation(async ({ input }) => {
      // Nothing to summarise.
      if (input.closedTrades === 0) {
        return {
          summary:
            "Δεν υπάρχουν ακόμη ολοκληρωμένες συναλλαγές για ανάλυση. Κατέγραψε μερικά trades και ξανατρέξε την ανάλυση.",
          source: "fallback" as const,
        };
      }

      const fallback = buildFallback(input);

      try {
        const res = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "Είσαι έμπειρος trading performance coach. Γράφεις στα Ελληνικά, " +
                "σε επαγγελματικό αλλά φιλικό τόνο. Σου δίνονται ΗΔΗ υπολογισμένα " +
                "στατιστικά ενός trader. ΜΗΝ εφεύρεις νέους αριθμούς — χρησιμοποίησε " +
                "μόνο όσα σου δίνονται. Έγραψε μία σύντομη παράγραφο (2-4 προτάσεις) " +
                "που συνοψίζει την εικόνα: τι πάει καλά, ποια η βασική αδυναμία, και " +
                "ποια είναι η άμεση προτεραιότητα. Απόφυγε λίστες.",
            },
            {
              role: "user",
              content: JSON.stringify(compact(input)),
            },
          ],
        });

        const text = res?.choices?.[0]?.message?.content;
        const summary =
          typeof text === "string" && text.trim().length > 0
            ? text.trim()
            : fallback;
        return {
          summary,
          source: (summary === fallback ? "fallback" : "llm") as
            | "llm"
            | "fallback",
        };
      } catch {
        return { summary: fallback, source: "fallback" as const };
      }
    }),
});

function compact(input: z.infer<typeof summaryInputSchema>) {
  const pickTop = (arr: z.infer<typeof groupStatSchema>[]) =>
    arr
      .slice(0, 5)
      .map((g) => ({
        k: g.key,
        n: g.trades,
        wr: Math.round(g.win_rate * 100),
        pnl: Math.round(g.pnl),
      }));
  return {
    trades: input.closedTrades,
    winRatePct: Math.round(input.winRate * 100),
    totalPnl: Math.round(input.totalPnl),
    byDay: pickTop(input.byDay),
    byInstrument: pickTop(input.byInstrument),
    bySetup: pickTop(input.bySetup),
    byEmotion: pickTop(input.byEmotion),
    bestDay: input.bestDay?.key ?? null,
    bestInstrument: input.bestInstrument?.key ?? null,
  };
}

function buildFallback(input: z.infer<typeof summaryInputSchema>): string {
  const wr = Math.round(input.winRate * 100);
  const pnl = Math.round(input.totalPnl);
  const pnlStr = `${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toLocaleString(
    "en-US",
  )}`;
  const parts: string[] = [];
  parts.push(
    `Με ${input.closedTrades} συναλλαγές, το ποσοστό επιτυχίας σου είναι ${wr}% και το συνολικό P&L ${pnlStr}.`,
  );
  if (input.bestDay) {
    parts.push(`Καλύτερη ημέρα: ${input.bestDay.key}.`);
  }
  if (input.bestInstrument) {
    parts.push(`Ισχυρότερη κατηγορία: ${input.bestInstrument.key}.`);
  }
  if (input.closedTrades < 20) {
    parts.push(
      "Άμεση προτεραιότητα: αύξησε τον όγκο και τη λεπτομέρεια καταγραφής για πιο αξιόπιστα συμπεράσματα.",
    );
  }
  return parts.join(" ");
}
