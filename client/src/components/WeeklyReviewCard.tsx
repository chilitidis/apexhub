// WeeklyReviewCard — collapsed "Weekly AI Review" card for the account
// dashboard. Computes a compact stats/trades summary for the last 7 days
// (client-side, from the already-loaded trades) and asks the server for a
// structured AI review. Reviews are cached per (user, ISO week) server-side,
// so an existing review shows instantly; "Regenerate" forces a fresh one.

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Streamdown } from "streamdown";
import { ChevronDown, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { Trade } from "@/lib/trading";
import {
  buildCoachContext,
  isoWeekKey,
  tradesInLastDays,
} from "@/lib/coachContext";
import { useLanguage } from "@/contexts/LanguageContext";

const ACCENT = "#5E60CE"; // coach/AI violet used app-wide

export default function WeeklyReviewCard({ trades }: { trades: Trade[] }) {
  const { t, lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [markdown, setMarkdown] = useState<string>("");

  const weekKey = useMemo(() => isoWeekKey(new Date()), []);
  const weekTrades = useMemo(() => tradesInLastDays(trades, 7), [trades]);
  const context = useMemo(() => buildCoachContext(weekTrades), [weekTrades]);

  const cachedQuery = trpc.weeklyReview.get.useQuery(
    { weekKey },
    { refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000, retry: false },
  );

  const generate = trpc.weeklyReview.generate.useMutation({
    onSuccess: (res) => {
      setMarkdown(res.markdown);
      if (res.source === "fallback") toast.error(t("wr.failed"));
    },
    onError: () => toast.error(t("wr.failed")),
  });

  const shown = markdown || cachedQuery.data?.markdown || "";
  const hasReview = shown.trim().length > 0;

  const run = (force: boolean) => {
    if (!context) return;
    generate.mutate({ weekKey, context, language: lang, force });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="bg-[#0D1E35]/80 border border-white/8 rounded-2xl backdrop-blur-sm overflow-hidden"
    >
      {/* Header — always visible; toggles the collapsed body */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
            style={{ background: `${ACCENT}1A`, color: ACCENT }}
          >
            <Sparkles size={15} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-['Space_Grotesk'] font-semibold text-sm text-white">
                {t("wr.title")}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#4A6080]">
                {weekKey}
              </span>
            </div>
            <p className="font-mono text-[10px] text-[#6E8AA8] truncate">
              {t("wr.subtitle")}
            </p>
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#6E8AA8] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-4 sm:px-5 pb-4 border-t border-white/5 pt-4">
          {hasReview ? (
            <>
              <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-white prose-p:my-2">
                <Streamdown>{shown}</Streamdown>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#4A6080]">
                  {t("wr.cachedNote")}
                </span>
                <button
                  type="button"
                  onClick={() => run(true)}
                  disabled={generate.isPending || !context}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:border-[#5E60CE]/50 font-mono text-[10px] uppercase tracking-wider text-[#A8B5C7] hover:text-white transition-all disabled:opacity-50"
                >
                  {generate.isPending ? (
                    <>
                      <Loader2 size={11} className="animate-spin" /> {t("wr.generating")}
                    </>
                  ) : (
                    <>
                      <RefreshCw size={11} /> {t("wr.regenerate")}
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <p className="text-xs text-[#A8B5C7] max-w-md">
                {context ? t("wr.empty") : t("wr.noTrades")}
              </p>
              <button
                type="button"
                onClick={() => run(false)}
                disabled={generate.isPending || cachedQuery.isLoading || !context}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-[11px] font-semibold uppercase tracking-wider text-white transition-all disabled:opacity-50"
                style={{ background: ACCENT }}
              >
                {generate.isPending || cachedQuery.isLoading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> {t("wr.generating")}
                  </>
                ) : (
                  <>
                    <Sparkles size={13} /> {t("wr.generate")}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
