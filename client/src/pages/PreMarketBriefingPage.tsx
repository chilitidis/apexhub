// PreMarketBriefingPage — "Pre-Market Briefing"
// Generates an AI daily briefing (Greek markdown) from today's High/Medium
// economic events. Renders the markdown with <Streamdown>. Dark navy theme.

import { useMemo, useState, useEffect, useCallback } from "react";
import { Streamdown } from "streamdown";
import { Sunrise, CalendarDays, RefreshCw, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { MarketEvent } from "@/lib/marketNewsTypes";
import { useLanguage } from "@/contexts/LanguageContext";

// ---- date helpers ----------------------------------------------------------

function sameLocalDay(ts: number, ref: Date): boolean {
  const d = new Date(ts);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function localeDateLabel(d: Date, locale: string): string {
  return d.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function utcTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} UTC`;
}

// ---- main page -------------------------------------------------------------

export function PreMarketBriefingPage() {
  const { t, lang } = useLanguage();
  const [today] = useState(() => new Date());
  const locale = lang === "el" ? "el-GR" : "en-US";
  const dateLabel = useMemo(() => localeDateLabel(today, locale), [today, locale]);

  const eventsQuery = trpc.marketNews.events.useQuery(
    {},
    { refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 },
  );

  const todaysEvents = useMemo(() => {
    const all: MarketEvent[] = eventsQuery.data?.events ?? [];
    return all
      .filter((e) => sameLocalDay(e.timestamp, today))
      .filter((e) => e.impact === "High" || e.impact === "Medium")
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [eventsQuery.data, today]);

  const generate = trpc.briefing.generate.useMutation();
  const [markdown, setMarkdown] = useState<string>("");
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  const runBriefing = useCallback(() => {
    const payload = {
      dateLabel,
      events: todaysEvents.map((e) => ({
        time: utcTime(e.timestamp),
        currency: e.currency,
        title: e.title,
        impact: e.impact,
        forecast: e.forecast,
        previous: e.previous,
      })),
    };
    generate.mutate(payload, {
      onSuccess: (res) => {
        setMarkdown(res.markdown);
        setGeneratedAt(new Date(res.generatedAt));
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateLabel, todaysEvents]);

  // Auto-generate once events are loaded (only first time).
  useEffect(() => {
    if (!eventsQuery.isLoading && !markdown && !generate.isPending) {
      runBriefing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsQuery.isLoading]);

  const busy = generate.isPending || eventsQuery.isLoading;

  return (
    <div className="max-w-[920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ===== Header ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#F4A261]/15 text-[#F4A261]">
            <Sunrise size={22} />
          </span>
          <div>
            <h1 className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-bold text-white leading-tight">
              Pre-Market Briefing
            </h1>
            <p className="flex items-center gap-1.5 text-sm text-[#A8B5C7] mt-0.5">
              <CalendarDays size={14} className="text-[#4A6080]" />
              {dateLabel}
            </p>
          </div>
        </div>

        <button
          onClick={runBriefing}
          disabled={busy}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F4A261] text-[#0A1628] font-semibold text-sm hover:bg-[#f4b27e] transition-colors disabled:opacity-60"
        >
          {generate.isPending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {t("pm.generating")}
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              {t("pm.refresh")}
            </>
          )}
        </button>
      </div>

      {/* ===== Briefing card ===== */}
      <div className="bg-[#0D1E35]/70 border border-white/8 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-b border-white/8">
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#F4A261] flex items-center gap-2">
            <Sunrise size={13} /> {t("pm.dailyAnalysis")}
          </span>
          {generatedAt && (
            <span className="font-mono text-[11px] text-[#4A6080]">
              {generatedAt.toLocaleTimeString(locale, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>

        <div className="px-5 sm:px-8 py-6">
          {generate.isPending && !markdown ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={30} className="animate-spin text-[#F4A261]" />
              <span className="text-sm text-[#A8B5C7]">
                {t("pm.analyzing")}
              </span>
            </div>
          ) : markdown ? (
            <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none">
              <Streamdown>{markdown}</Streamdown>
            </div>
          ) : (
            <div className="text-sm text-[#A8B5C7] py-10 text-center">
              {t("pm.pressRefresh")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PreMarketBriefingPage;
