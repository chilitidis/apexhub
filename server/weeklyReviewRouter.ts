import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { coachContextSchema, buildTraderDataBlock } from "./coachContext";
import { createCoachAnalysis, getWeeklyReviewRow } from "./db";
import { cleanProse } from "./sanitizers";

/**
 * Weekly AI Review router.
 *
 * Produces one short structured review per ISO week ("2026-W32") from the
 * stats + trades summary the client computed for the last 7 days (same shape
 * as the coach context — the server never recomputes journal math).
 *
 * Caching reuses the existing `coach_analyses` table rather than a new one:
 * a review row is stored with `timeframe = 'weekly_review'` (the kind marker)
 * and `pair = weekKey`, with the markdown in `comment`. Those rows are
 * excluded from the Trading Coach history listing (see listCoachAnalyses).
 */

export const WEEKLY_REVIEW_KIND = "weekly_review";

const weekKeySchema = z.string().regex(/^\d{4}-W\d{2}$/);

const generateInputSchema = z.object({
  weekKey: weekKeySchema,
  context: coachContextSchema,
  language: z.enum(["en", "el"]).optional().default("en"),
  force: z.boolean().optional().default(false),
});

function buildSystemPrompt(lang: "en" | "el"): string {
  if (lang === "en") {
    return [
      "You are an experienced trading performance coach writing a short WEEKLY REVIEW for one trader.",
      "You are given the trader's real journal statistics for the last 7 days. Use ONLY these numbers — never invent trades, numbers or statistics.",
      "Write in ENGLISH, in Markdown, 150-250 words total, warm but direct. Structure it EXACTLY as:",
      "",
      "### ✅ What went well",
      "(2-3 sentences grounded in the data)",
      "",
      "### ⚠️ What hurt",
      "(2-3 sentences on the main leaks — losing days, emotions, symbols)",
      "",
      "### 🎯 One focus for next week",
      "(ONE concrete, actionable focus — not a list)",
      "",
      "### 🧠 Discipline note",
      "(1-2 sentences on psychology/discipline)",
      "",
      "If there are very few trades, say so honestly and keep conclusions modest. No investment advice, no price predictions.",
    ].join("\n");
  }
  return [
    "Είσαι έμπειρος trading performance coach και γράφεις ένα σύντομο ΕΒΔΟΜΑΔΙΑΙΟ REVIEW για έναν trader.",
    "Σου δίνονται τα πραγματικά στατιστικά του journal του για τις τελευταίες 7 ημέρες. Χρησιμοποίησε ΜΟΝΟ αυτούς τους αριθμούς — μην επινοήσεις ποτέ trades, αριθμούς ή στατιστικά.",
    "Γράψε στα ΕΛΛΗΝΙΚΑ, σε Markdown, 150-250 λέξεις συνολικά, με ζεστό αλλά ευθύ τόνο. Δομή ΑΚΡΙΒΩΣ ως εξής:",
    "",
    "### ✅ Τι πήγε καλά",
    "(2-3 προτάσεις βασισμένες στα δεδομένα)",
    "",
    "### ⚠️ Τι πόνεσε",
    "(2-3 προτάσεις για τις βασικές διαρροές — ζημιογόνες ημέρες, συναισθήματα, σύμβολα)",
    "",
    "### 🎯 Ένας στόχος για την επόμενη εβδομάδα",
    "(ΕΝΑΣ συγκεκριμένος, εφαρμόσιμος στόχος — όχι λίστα)",
    "",
    "### 🧠 Σημείωση πειθαρχίας",
    "(1-2 προτάσεις ψυχολογίας/πειθαρχίας)",
    "",
    "Αν τα trades είναι πολύ λίγα, πες το ειλικρινά και κράτησε τα συμπεράσματα μετρημένα. Καμία επενδυτική συμβουλή, καμία πρόβλεψη τιμών.",
  ].join("\n");
}

function buildFallback(weekKey: string, lang: "en" | "el"): string {
  return lang === "en"
    ? `### Weekly Review — ${weekKey}\n\nThe AI service is temporarily unavailable, so this week's review could not be generated. Your data is safe — try again in a few minutes.`
    : `### Εβδομαδιαίο Review — ${weekKey}\n\nΗ υπηρεσία AI είναι προσωρινά μη διαθέσιμη και το review της εβδομάδας δεν δημιουργήθηκε. Τα δεδομένα σου είναι ασφαλή — δοκίμασε ξανά σε λίγα λεπτά.`;
}

function extractText(message: unknown): string {
  if (typeof message === "string") return message;
  if (Array.isArray(message)) {
    return message
      .map((c) => {
        if (typeof c === "string") return c;
        if (c && typeof c === "object" && "text" in c) {
          const t = (c as { text?: unknown }).text;
          return typeof t === "string" ? t : "";
        }
        return "";
      })
      .join("");
  }
  return "";
}

export const weeklyReviewRouter = router({
  /** Cheap cache lookup so the UI can show an existing review instantly. */
  get: protectedProcedure
    .input(z.object({ weekKey: weekKeySchema }))
    .query(async ({ ctx, input }) => {
      const row = await getWeeklyReviewRow(ctx.user.id, input.weekKey);
      if (!row) return null;
      return {
        markdown: row.comment,
        generatedAt: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
      };
    }),

  /**
   * Generate (or return the cached) weekly review for one ISO week. The LLM
   * result is cached per (user, weekKey); pass `force: true` to regenerate.
   */
  generate: protectedProcedure
    .input(generateInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!input.force) {
        const cached = await getWeeklyReviewRow(ctx.user.id, input.weekKey);
        if (cached) {
          return {
            markdown: cached.comment,
            cached: true,
            source: "llm" as const,
            generatedAt: cached.createdAt
              ? new Date(cached.createdAt).getTime()
              : Date.now(),
          };
        }
      }

      const lang = input.language;
      try {
        const res = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                buildSystemPrompt(lang) +
                "\n\n" +
                buildTraderDataBlock(input.context, lang),
            },
            {
              role: "user",
              content: JSON.stringify({ week: input.weekKey }),
            },
          ],
        });

        const markdown = cleanProse(
          extractText(res?.choices?.[0]?.message?.content),
        ).trim();
        if (!markdown) {
          return {
            markdown: buildFallback(input.weekKey, lang),
            cached: false,
            source: "fallback" as const,
            generatedAt: Date.now(),
          };
        }

        // Cache in coach_analyses (kind marker in `timeframe`, weekKey in `pair`).
        await createCoachAnalysis({
          userId: ctx.user.id,
          accountId: 0,
          score: 0,
          verdict: "weekly",
          pair: input.weekKey,
          timeframe: WEEKLY_REVIEW_KIND,
          direction: "unknown",
          observations: "",
          rr: "",
          timeAnalysis: "",
          elliottNote: "",
          comment: markdown,
          suggestion: "",
          criteriaJson: "[]",
        });

        return {
          markdown,
          cached: false,
          source: "llm" as const,
          generatedAt: Date.now(),
        };
      } catch {
        // LLM unavailable — return a deterministic fallback and do NOT cache
        // it, so the next attempt can still produce a real review.
        return {
          markdown: buildFallback(input.weekKey, lang),
          cached: false,
          source: "fallback" as const,
          generatedAt: Date.now(),
        };
      }
    }),
});

export const __test__ = { buildSystemPrompt, buildFallback, WEEKLY_REVIEW_KIND };
