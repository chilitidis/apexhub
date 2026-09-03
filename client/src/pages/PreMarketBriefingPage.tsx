// PreMarketBriefingPage — "Pre-Market Briefing"
// Generates an AI daily briefing (Greek markdown) from today's High/Medium
// economic events. Renders the markdown with <Streamdown>. Dark navy theme.

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Streamdown } from "streamdown";
import html2canvas from "html2canvas-pro";
import { toast } from "sonner";
import { Sunrise, CalendarDays, RefreshCw, Loader2, Camera } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { MarketEvent } from "@/lib/marketNewsTypes";
import type { Trade } from "@/lib/trading";
import { topSymbolsByTradeCount } from "@/lib/coachContext";
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

export function PreMarketBriefingPage({ trades }: { trades?: Trade[] }) {
  const { t, lang } = useLanguage();
  // The user's most-traded symbols (by trade count across loaded months); the
  // briefing prioritises these in "Key Pairs to Watch". Empty = no focus sent.
  const focusSymbols = useMemo(() => topSymbolsByTradeCount(trades, 8), [trades]);
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
      lang,
      focusSymbols: focusSymbols.length > 0 ? focusSymbols : undefined,
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
  }, [dateLabel, todaysEvents, lang, focusSymbols]);

  // Auto-generate once events are loaded (only first time).
  useEffect(() => {
    if (!eventsQuery.isLoading && !markdown && !generate.isPending) {
      runBriefing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsQuery.isLoading]);

  const busy = generate.isPending || eventsQuery.isLoading;

  // ---- Snapshot: export the briefing card as a PNG (for the team chat) ----
  const cardRef = useRef<HTMLDivElement>(null);
  const [snapping, setSnapping] = useState(false);
  const takeSnapshot = useCallback(async () => {
    const node = cardRef.current;
    if (!node || snapping) return;
    setSnapping(true);
    try {
      const canvas = await html2canvas(node, {
        backgroundColor: "#0A1628",
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 4000,
      });
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob null"))),
          "image/png",
          0.95,
        );
      });
      // Best effort: also copy to clipboard so it can be pasted straight
      // into Telegram. Ignore failures (permissions / browser support).
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        toast.success(t("pm.snapCopied"));
      } catch {
        toast.success(t("pm.snapSaved"));
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const d = new Date();
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      a.download = `pre-market-briefing-${ymd}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch (err) {
      void err;
      toast.error(t("pm.snapFailed"));
    } finally {
      setSnapping(false);
    }
  }, [snapping, t]);

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

        <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={takeSnapshot}
          disabled={busy || snapping || !markdown}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-sm hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          {snapping ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Camera size={16} />
          )}
          {t("pm.snapshot")}
        </button>
        <button
          onClick={runBriefing}
          disabled={busy}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F4A261] text-[#0A1628] font-semibold text-sm hover:bg-[#f4b27e] transition-colors disabled:opacity-60"
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
      </div>

      {/* ===== Briefing card ===== */}
      <div ref={cardRef} className="bg-[#0D1E35]/70 border border-white/8 rounded-2xl overflow-hidden">
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
