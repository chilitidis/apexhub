// MarketNewsPage — "Market News" (Forex Factory economic calendar)
// Shows this week's economic events grouped by day, filterable by impact, in the
// app's dark navy theme. Times are rendered in the user's local timezone.

import { useMemo, useRef, useState } from "react";
import { captureNodeToBlob } from "@/lib/snapshot";
import { toast } from "sonner";
import {
  Newspaper,
  RefreshCw,
  Clock,
  Loader2,
  AlertTriangle,
  Camera,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { MarketEvent, MarketImpact } from "@/lib/marketNewsTypes";
import { useLanguage } from "@/contexts/LanguageContext";

type Filter = "high" | "all";

// ---- impact styling --------------------------------------------------------

function impactStyle(impact: MarketImpact): {
  label: string;
  dot: string;
  pillBg: string;
  pillText: string;
  badgeBg: string;
} {
  switch (impact) {
    case "High":
      return {
        label: "HIGH",
        dot: "#E5484D",
        pillBg: "bg-[#E5484D]/12 border-[#E5484D]/35",
        pillText: "text-[#E5484D]",
        badgeBg: "bg-[#E5484D]/15 text-[#E5484D] border-[#E5484D]/30",
      };
    case "Medium":
      return {
        label: "MEDIUM",
        dot: "#C9A24A",
        pillBg: "bg-[#C9A24A]/12 border-[#C9A24A]/35",
        pillText: "text-[#C9A24A]",
        badgeBg: "bg-[#C9A24A]/15 text-[#C9A24A] border-[#C9A24A]/30",
      };
    case "Holiday":
      return {
        label: "HOLIDAY",
        dot: "#C9A24A",
        pillBg: "bg-[#C9A24A]/12 border-[#C9A24A]/35",
        pillText: "text-[#C9A24A]",
        badgeBg: "bg-[#C9A24A]/15 text-[#C9A24A] border-[#C9A24A]/30",
      };
    default:
      return {
        label: "LOW",
        dot: "#C9A24A",
        pillBg: "bg-[#C9A24A]/12 border-[#C9A24A]/35",
        pillText: "text-[#C9A24A]",
        badgeBg: "bg-[#C9A24A]/15 text-[#C9A24A] border-[#C9A24A]/30",
      };
  }
}

// ---- date helpers (local timezone) -----------------------------------------

const TZ = "Europe/Athens";

function dayKey(ts: number): string {
  return new Date(ts).toLocaleDateString("en-CA", { timeZone: TZ });
}
function dayHeader(ts: number, lang: "en" | "el" = "en"): string {
  return new Date(ts)
    .toLocaleDateString(lang === "el" ? "el-GR" : "en-US", {
      timeZone: TZ,
      weekday: "long",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();
}
function eventTime(ts: number, lang: "en" | "el" = "en"): string {
  return new Date(ts).toLocaleString(lang === "el" ? "el-GR" : "en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ---- event row -------------------------------------------------------------

function EventCard({ ev, lang }: { ev: MarketEvent; lang: "en" | "el" }) {
  const s = impactStyle(ev.impact);
  const released = ev.timestamp < Date.now();
  return (
    <div className="bg-[#121214]/70 border border-white/8 rounded-2xl px-4 sm:px-5 py-4 flex items-start gap-4">
      {/* currency badge */}
      <div className="shrink-0 flex flex-col items-center gap-1 w-12">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center font-mono text-[11px] font-bold border"
          style={{
            background: `${s.dot}18`,
            borderColor: `${s.dot}55`,
            color: s.dot,
          }}
        >
          {ev.currency.slice(0, 3) || "—"}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h4 className="font-['Inter'] font-semibold text-white text-[15px]">
            {ev.title}
          </h4>
          <span
            className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.badgeBg}`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: s.dot }}
            />
            {s.label}
          </span>
        </div>
        {(ev.forecast || ev.previous) && (
          <div className="flex items-center gap-4 text-xs text-[#8E8A82] font-mono">
            {ev.forecast && (
              <span>
                {lang === "el" ? "Πρόβλεψη:" : "Forecast:"}{" "}
                <span className="text-[#C9C4B9] font-semibold">
                  {ev.forecast}
                </span>
              </span>
            )}
            {ev.previous && (
              <span>
                {lang === "el" ? "Προηγούμενο:" : "Previous:"}{" "}
                <span className="text-[#C9C4B9] font-semibold">
                  {ev.previous}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#B5B0A6]">
          <Clock size={12} className="text-[#8E8A82]" />
          {eventTime(ev.timestamp, lang)}
        </span>
        {released && (
          <span className="font-mono text-[9px] uppercase tracking-wider text-[#8E8A82] border border-white/10 rounded px-1.5 py-0.5">
            {lang === "el" ? "Ανακοινώθηκε" : "Released"}
          </span>
        )}
      </div>
    </div>
  );
}

// ---- main page -------------------------------------------------------------

export function MarketNewsPage() {
  const { t, lang } = useLanguage();
  const [filter, setFilter] = useState<Filter>("high");
  const query = trpc.marketNews.events.useQuery(
    {},
    { refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 },
  );

  const [refreshing, setRefreshing] = useState(false);

  // ---- Snapshot: export the week's news list as a PNG (for the team chat) ----
  const snapRef = useRef<HTMLDivElement>(null);
  const [snapping, setSnapping] = useState(false);
  const takeSnapshot = async () => {
    const node = snapRef.current;
    if (!node || snapping) return;
    setSnapping(true);
    try {
      const blob = await captureNodeToBlob(node);
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
      a.download = `market-news-${ymd}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch (err) {
      void err;
      toast.error(t("pm.snapFailed"));
    } finally {
      setSnapping(false);
    }
  };
  const utils = trpc.useUtils();
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await utils.marketNews.events.fetch({ force: true });
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const events = query.data?.events ?? [];

  const filtered = useMemo(() => {
    if (filter === "high") return events.filter((e) => e.impact === "High");
    return events.filter(
      (e) => e.impact === "High" || e.impact === "Medium",
    );
  }, [events, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, MarketEvent[]>();
    for (const e of filtered) {
      const k = dayKey(e.timestamp);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return Array.from(map.entries())
      .map(([, evs]) => evs)
      .sort((a, b) => a[0].timestamp - b[0].timestamp);
  }, [filtered]);

  const updatedLabel = query.data?.fetchedAt
    ? new Date(query.data.fetchedAt).toLocaleTimeString(lang === "el" ? "el-GR" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ===== Header ===== */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-2">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <span className="text-[#C9A24A]">
              <Newspaper size={24} />
            </span>
            <h1 className="font-display text-2xl sm:text-3xl text-[#F2EFE8]">
              {t("mn.title")}
            </h1>
          </div>
          <p className="text-sm text-[#B5B0A6]">
            {t("mn.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* filter toggle */}
          <div className="flex items-center rounded-full border border-white/10 bg-[#121214]/70 p-1">
            <button
              onClick={() => setFilter("high")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filter === "high"
                  ? "bg-[#E5484D]/20 text-[#E5484D]"
                  : "text-[#B5B0A6] hover:text-white"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#E5484D]" />
              {lang === "el" ? "Μόνο υψηλής σημασίας" : "High only"}
            </button>
            <button
              onClick={() => setFilter("all")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filter === "all"
                  ? "bg-[#C9A24A]/20 text-[#C9A24A]"
                  : "text-[#B5B0A6] hover:text-white"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#C9A24A]" />
              {lang === "el" ? "Υψηλής & μέτριας" : "High & medium"}
            </button>
          </div>

          <button
            onClick={takeSnapshot}
            disabled={snapping || query.isLoading || events.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/10 bg-[#121214]/70 text-sm font-semibold text-[#C9C4B9] hover:text-white hover:border-white/20 transition-colors disabled:opacity-60"
          >
            {snapping ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Camera size={15} />
            )}
            {t("pm.snapshot")}
          </button>

          <button
            onClick={onRefresh}
            disabled={refreshing || query.isFetching}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/10 bg-[#121214]/70 text-sm font-semibold text-[#C9C4B9] hover:text-white hover:border-white/20 transition-colors disabled:opacity-60"
          >
            <RefreshCw
              size={15}
              className={refreshing || query.isFetching ? "animate-spin" : ""}
            />
            {t("mn.refresh")}
          </button>
        </div>
      </div>

      <div ref={snapRef}>
      {/* ===== Meta line ===== */}
      <div className="flex items-center gap-2 text-xs text-[#8E8A82] mb-6 font-mono">
        <Clock size={12} />
        {t("mn.updated")} {updatedLabel} · {t("mn.source")} · {lang === "el" ? "ώρα Ελλάδος" : "Greece time"}
        {query.data?.stale && (
          <span className="text-[#C9A24A]">· (cached)</span>
        )}
      </div>

      {/* ===== Body ===== */}
      {query.isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-[#B5B0A6]">
          <Loader2 size={28} className="animate-spin text-[#C9A24A]" />
          <span className="text-sm">{t("mn.loading")}</span>
        </div>
      ) : query.isError ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <AlertTriangle size={28} className="text-[#E5484D]" />
          <p className="text-sm text-[#B5B0A6] max-w-md">
            {t("mn.loadError")}
          </p>
          <button
            onClick={onRefresh}
            className="mt-2 px-4 py-2 rounded-xl bg-[#C9A24A] text-[#0A0A0B] font-semibold text-sm"
          >
            {t("mn.tryAgain")}
          </button>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2 text-center">
          <Newspaper size={28} className="text-[#8E8A82]" />
          <p className="text-sm text-[#B5B0A6]">
            {t("mn.noEvents1")}{" "}
            {filter === "high" ? "high-impact" : "high/medium-impact"} {lang === "el" ? "γεγονότα" : "events"}{" "}
            {t("mn.noEvents2")}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((evs) => (
            <div key={dayKey(evs[0].timestamp)}>
              <div className="flex items-center gap-3 mb-3">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#B5B0A6] bg-white/5 rounded-md px-2.5 py-1">
                  {dayHeader(evs[0].timestamp, lang)}
                </span>
                <div className="flex-1 h-px bg-white/8" />
                <span className="font-mono text-[11px] text-[#8E8A82]">
                  {evs.length} {evs.length === 1 ? "event" : "events"}
                </span>
              </div>
              <div className="space-y-3">
                {evs.map((ev) => (
                  <EventCard key={ev.id} ev={ev} lang={lang} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== Footer ===== */}
      {groups.length > 0 && (
        <div className="text-center text-xs text-[#8E8A82] mt-10 font-mono">
          {t("mn.footer")}
        </div>
      )}
    </div>
    </div>
  );
}

export default MarketNewsPage;
