import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { cleanProse } from "./sanitizers";
import {
  createPropFirmAccount,
  deletePropFirmAccount,
  getPropFirmState,
  listPropFirmAccounts,
  updatePropFirmAccount,
  upsertPropFirmState,
} from "./db";
import { FIRMS } from "@shared/propFirms";

/**
 * Prop Firm Tracker router.
 *
 * - CRUD for the user's monitored prop-firm accounts (firm + program + size + phase).
 * - A per-user singleton state row (currency preference, daily checklist, notes).
 * - An AI "rules assistant" that explains the exact rules and traps for a chosen
 *   account in the active UI language (EN/EL), grounded ONLY in our dataset so it
 *   never invents rules the user could be penalised for.
 */

const phaseEnum = z.enum(["eval", "funded"]);

const accountInput = z.object({
  firmName: z.string().min(1).max(64),
  programName: z.string().min(1).max(96),
  sizeUsd: z.number().int().positive(),
  phase: phaseEnum.default("eval"),
  label: z.string().max(120).optional(),
});

export function findRules(firmName: string, programName: string, phase: "eval" | "funded") {
  const firm = FIRMS.find((f) => f.name === firmName);
  if (!firm) return null;
  const program = firm.programs.find((p) => p.name === programName) ?? firm.programs[0];
  if (!program) return null;
  return { firm, program, stage: phase === "funded" ? program.funded : program.eval };
}

export function fallbackText(lang: "en" | "el"): string {
  return lang === "en"
    ? "The AI assistant is temporarily unavailable. Please review the rule table above for this account — pay special attention to the highlighted *trap* (daily/max drawdown type, news and weekend restrictions)."
    : "Ο AI βοηθός δεν είναι προσωρινά διαθέσιμος. Δες τον πίνακα κανόνων πιο πάνω για αυτό το account — δώσε ιδιαίτερη προσοχή στην επισημασμένη *παγίδα* (τύπος daily/max drawdown, περιορισμοί news και weekend).";
}

/**
 * Build the system + user prompt for the AI rules assistant. Exported so unit
 * tests can assert the language directive and grounding fact sheet without
 * hitting the LLM. Returns null when the firm/program cannot be resolved.
 */
export function buildAskPrompt(input: {
  firmName: string;
  programName: string;
  phase: "eval" | "funded";
  question?: string;
  lang: "en" | "el";
}): { system: string; user: string } | null {
  const rules = findRules(input.firmName, input.programName, input.phase);
  if (!rules) return null;
  const lang = input.lang;
  const { firm, program, stage } = rules;
  const stageLabel = input.phase === "funded" ? "FUNDED" : "EVALUATION/CHALLENGE";
  const factSheet = [
    `Firm: ${firm.name}`,
    `Program: ${program.name}`,
    `Stage: ${stageLabel}`,
    `Leverage: ${stage.lev ?? "-"}`,
    `Daily drawdown: ${stage.daily ?? "-"}`,
    `Max drawdown: ${stage.max ?? "-"}`,
    `Profit target: ${stage.target ?? "-"}`,
    `Min trading days: ${stage.mindays ?? "-"}`,
    `Consistency: ${stage.consistency ?? "-"}`,
    `Min hold: ${stage.hold ?? "-"}`,
    `News rule: ${stage.news ?? "-"}`,
    `Weekend rule: ${stage.weekend ?? "-"}`,
    `Profit split: ${stage.split ?? "-"}`,
    `Payout: ${stage.payout ?? "-"}`,
    `KEY TRAP: ${stage.trap ?? "-"}`,
    `Copy rule (cross-person): ${firm.copy.cross}`,
    `Copy rule (own accounts): ${firm.copy.own}`,
    `Allocation cap: ${firm.alloc.overall}`,
  ].join("\n");

  const langDirective =
    lang === "en" ? "Reply STRICTLY in English." : "Απάντησε ΑΥΣΤΗΡΑ στα Ελληνικά.";

  const system = [
    lang === "en"
      ? "You are a Prop Firm risk assistant for a trading journal app. You help a funded trader avoid breaching their account rules."
      : "Είσαι ένας βοηθός κανόνων Prop Firm για μια εφαρμογή trading journal. Βοηθάς έναν funded trader να μην παραβιάσει τους κανόνες του account του.",
    langDirective,
    lang === "en"
      ? "Use ONLY the FACT SHEET below. Do NOT invent rules, numbers, or restrictions that are not in it. If something is unknown, say it must be confirmed on the firm's dashboard."
      : "Χρησιμοποίησε ΜΟΝΟ το FACT SHEET παρακάτω. ΜΗΝ εφεύρεις κανόνες, αριθμούς ή περιορισμούς που δεν υπάρχουν. Αν κάτι είναι άγνωστο, πες ότι πρέπει να επιβεβαιωθεί στο dashboard της εταιρείας.",
    lang === "en"
      ? "Be concise and practical. Always emphasise the KEY TRAP and the drawdown type (static vs trailing) so the trader does not get caught out. Use Markdown (bold, short lists)."
      : "Να είσαι σύντομος και πρακτικός. Τόνισε πάντα την KEY TRAP και τον τύπο drawdown (static vs trailing) ώστε ο trader να μην πιαστεί. Χρησιμοποίησε Markdown (έντονα, σύντομες λίστες).",
    "==== FACT SHEET ====",
    factSheet,
  ].join("\n");

  const user =
    input.question && input.question.trim().length > 0
      ? input.question.trim()
      : lang === "en"
        ? `Give me a short, focused risk briefing for my ${firm.name} ${program.name} (${stageLabel}) account: what is the single most important rule to respect, and how do I avoid breaching it today?`
        : `Δώσε μου ένα σύντομο, στοχευμένο risk briefing για το ${firm.name} ${program.name} (${stageLabel}) account μου: ποιος είναι ο πιο σημαντικός κανόνας που πρέπει να σεβαστώ και πώς αποφεύγω το breach σήμερα;`;

  return { system, user };
}

export const propFirmRouter = router({
  // ---------- accounts ----------
  listAccounts: protectedProcedure.query(async ({ ctx }) => {
    return listPropFirmAccounts(ctx.user.id);
  }),

  addAccount: protectedProcedure
    .input(accountInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await listPropFirmAccounts(ctx.user.id);
      const row = await createPropFirmAccount({
        userId: ctx.user.id,
        firmName: input.firmName,
        programName: input.programName,
        sizeUsd: input.sizeUsd,
        phase: input.phase,
        label: input.label ?? "",
        sortOrder: existing.length,
      });
      return row;
    }),

  updateAccount: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        phase: phaseEnum.optional(),
        label: z.string().max(120).optional(),
        programName: z.string().min(1).max(96).optional(),
        sizeUsd: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;
      await updatePropFirmAccount(ctx.user.id, id, patch);
      return { ok: true };
    }),

  removeAccount: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await deletePropFirmAccount(ctx.user.id, input.id);
      return { ok: true };
    }),

  // ---------- per-user state ----------
  getState: protectedProcedure.query(async ({ ctx }) => {
    const s = await getPropFirmState(ctx.user.id);
    return (
      s ?? { userId: ctx.user.id, currency: "USD" as const, checks: "", notes: "", updatedAt: new Date() }
    );
  }),

  saveState: protectedProcedure
    .input(
      z.object({
        currency: z.enum(["USD", "EUR"]).optional(),
        checks: z.string().max(4000).optional(),
        notes: z.string().max(20000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await upsertPropFirmState(ctx.user.id, input);
      return { ok: true };
    }),

  // ---------- AI rules assistant ----------
  ask: protectedProcedure
    .input(
      z.object({
        firmName: z.string().min(1).max(64),
        programName: z.string().min(1).max(96),
        phase: phaseEnum,
        question: z.string().max(2000).optional(),
        lang: z.enum(["en", "el"]).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const lang = input.lang ?? "el";
      const fallback = fallbackText(lang);
      const prompt = buildAskPrompt({ ...input, lang });

      if (!prompt) {
        return { reply: fallback, source: "fallback" as const, generatedAt: Date.now() };
      }

      try {
        const res = await invokeLLM({
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
        });
        const text = res?.choices?.[0]?.message?.content;
        const cleaned = typeof text === "string" ? cleanProse(text) : "";
        const reply = cleaned.trim().length > 0 ? cleaned.trim() : fallback;
        return {
          reply,
          source: (reply === fallback ? "fallback" : "llm") as "llm" | "fallback",
          generatedAt: Date.now(),
        };
      } catch {
        return { reply: fallback, source: "fallback" as const, generatedAt: Date.now() };
      }
    }),
});
