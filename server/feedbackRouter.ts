import { z } from "zod";

import { adminProcedure, protectedProcedure, router } from "./_core/trpc";
import { notifyOwner } from "./_core/notification";
import { createFeedback, listAllFeedback, updateFeedbackStatus } from "./db";

/**
 * User feedback / feature requests.
 *
 * Any signed-in member can submit a request describing what they would like us
 * to add or change on the site. We persist it to the `feedback` table and fire
 * an owner notification so the request surfaces immediately. The owner reviews
 * and triages everything from the Admin panel (admin-only `list` /
 * `updateStatus`).
 */

export const FEEDBACK_CATEGORIES = [
  "feature",
  "improvement",
  "bug",
  "other",
] as const;

export const FEEDBACK_STATUSES = [
  "new",
  "planned",
  "done",
  "dismissed",
] as const;

const categoryLabel: Record<(typeof FEEDBACK_CATEGORIES)[number], string> = {
  feature: "Νέα λειτουργία",
  improvement: "Βελτίωση",
  bug: "Πρόβλημα / Bug",
  other: "Άλλο",
};

export const feedbackRouter = router({
  /**
   * Submit a feedback / feature request. Stores the message, denormalising the
   * submitter's name + email so the Admin list stays readable, then notifies
   * the owner. The notification is best-effort: a failed notify does NOT fail
   * the submission (the row is already saved and visible in Admin).
   */
  submit: protectedProcedure
    .input(
      z.object({
        category: z.enum(FEEDBACK_CATEGORIES).default("feature"),
        message: z.string().trim().min(4).max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await createFeedback({
        userId: ctx.user.id,
        userName: ctx.user.name ?? "",
        userEmail: ctx.user.email ?? "",
        category: input.category,
        message: input.message,
        status: "new",
      });

      // Best-effort owner notification — never blocks the user's submission.
      try {
        const who = ctx.user.name?.trim() || ctx.user.email || `User #${ctx.user.id}`;
        await notifyOwner({
          title: `Νέο feedback · ${categoryLabel[input.category]}`,
          content: `Από: ${who}\nΚατηγορία: ${categoryLabel[input.category]}\n\n${input.message}`,
        });
      } catch (err) {
        console.warn("[feedback] notifyOwner failed (non-fatal):", err);
      }

      return { id: row?.id ?? 0, ok: true } as const;
    }),

  /** Admin-only: full list of submitted feedback, newest first. */
  list: adminProcedure.query(async () => {
    return listAllFeedback();
  }),

  /** Admin-only: triage a feedback item by updating its status. */
  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(FEEDBACK_STATUSES),
      }),
    )
    .mutation(async ({ input }) => {
      await updateFeedbackStatus(input.id, input.status);
      return { ok: true } as const;
    }),
});
