// MarketNewsPage — "Market News" (Forex Factory economic calendar)
// Shows this week's economic events grouped by day, filterable by impact, in the
// app's dark navy theme. Times are rendered in the user's local timezone.

import { useMemo, useState } from "react";
import {
  Newspaper,
  RefreshCw,
  Clock,
  Loader2,
  AlertTriangle,
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
        dot: "#E94F37",
        pillBg: "bg-[#E94F37]/12 border-[#E94F37]/35",
        pillText: "text-[#FF7A66]",
        badgeBg: "bg-[#E94F37]/15 text-[#FF8C7A] border-[#E94F37]/30",
      };
    case "Medium":
      return {
        label: "MEDIUM",
        dot: "#F4A261",
        pillBg: "bg-[#F4A261]/12 border-[#F4A261]/35",
        pillText: "text-[#F4A261]",
        badgeBg: "bg-[#F4A261]/15 text-[#F4A261] border-[#F4A261]/30",
      };
    case "Holiday":
      return {
        label: "HOLIDAY",
        dot: "#5E60CE",
        pillBg: "bg-[#5E60CE]/12 border-[#5E60CE]/35",
        pillText: "text-[#9B9CF0]",
        badgeBg: "bg-[#5E60CE]/15 text-[#9B9CF0] border-[#5E60CE]/30",
      };
    default:
      return {
        label: "LOW",
        dot: "#0077B6",
        pillBg: "bg-[#0077B6]/12 border-[#0077B6]/35",
        pillText: "text-[#4FA9DC]",
        badgeBg: "bg-[#0077B6]/15 text-[#4FA9DC] border-[#0077B6]/30",
      };
  }
}

// ---- date helpers (local timezone) -----------------------------------------

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function dayHeader(ts: number): string {
  return new Date(ts)
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();
}
function eventTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ---- event row -------------------------------------------------------------

function EventCard({ ev }: { ev: MarketEvent }) {
  const s = impactStyle(ev.impact);
  const released = ev.timestamp < Date.now();
  return (
    <div className="bg-[#0D1E35]/70 border border-white/8 rounded-2xl px-4 sm:px-5 py-4 flex items-start gap-4">
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
          <h4 className="font-['Space_Grotesk'] font-semibold text-white text-[15px]">
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
          <div className="flex items-center gap-4 text-xs text-[#4A6080] font-mono">
            {ev.forecast && (
              <span>
                Forecast:{" "}
                <span className="text-[#C7D2E0] font-semibold">
                  {ev.forecast}
                </span>
              </span>
            )}
            {ev.previous && (
              <span>
                Previous:{" "}
                <span className="text-[#C7D2E0] font-semibold">
                  {ev.previous}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#A8B5C7]">
          <Clock size={12} className="text-[#4A6080]" />
          {eventTime(ev.timestamp)}
        </span>
        {released && (
          <span className="font-mono text-[9px] uppercase tracking-wider text-[#4A6080] border border-white/10 rounded px-1.5 py-0.5">
            Released
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
            <span className="text-[#F4A261]">
              <Newspaper size={24} />
            </span>
            <h1 className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-bold text-white">
              {t("mn.title")}
            </h1>
          </div>
          <p className="text-sm text-[#A8B5C7]">
            {t("mn.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* filter toggle */}
          <div className="flex items-center rounded-full border border-white/10 bg-[#0D1E35]/70 p-1">
            <button
              onClick={() => setFilter("high")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filter === "high"
                  ? "bg-[#E94F37]/20 text-[#FF7A66]"
                  : "text-[#A8B5C7] hover:text-white"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#E94F37]" />
              High Only
            </button>
            <button
              onClick={() => setFilter("all")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filter === "all"
                  ? "bg-[#F4A261]/20 text-[#F4A261]"
                  : "text-[#A8B5C7] hover:text-white"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#F4A261]" />
              High &amp; Medium
            </button>
          </div>

          <button
            onClick={onRefresh}
            disabled={refreshing || query.isFetching}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/10 bg-[#0D1E35]/70 text-sm font-semibold text-[#C7D2E0] hover:text-white hover:border-white/20 transition-colors disabled:opacity-60"
          >
            <RefreshCw
              size={15}
              className={refreshing || query.isFetching ? "animate-spin" : ""}
            />
            {t("mn.refresh")}
          </button>
        </div>
      </div>

      {/* ===== Meta line ===== */}
      <div className="flex items-center gap-2 text-xs text-[#4A6080] mb-6 font-mono">
        <Clock size={12} />
        {t("mn.updated")} {updatedLabel} · {t("mn.source")}
        {query.data?.stale && (
          <span className="text-[#F4A261]">· (cached)</span>
        )}
      </div>

      {/* ===== Body ===== */}
      {query.isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-[#A8B5C7]">
          <Loader2 size={28} className="animate-spin text-[#F4A261]" />
          <span className="text-sm">{t("mn.loading")}</span>
        </div>
      ) : query.isError ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <AlertTriangle size={28} className="text-[#E94F37]" />
          <p className="text-sm text-[#A8B5C7] max-w-md">
            {t("mn.loadError")}
          </p>
          <button
            onClick={onRefresh}
            className="mt-2 px-4 py-2 rounded-xl bg-[#F4A261] text-[#0A1628] font-semibold text-sm"
          >
            {t("mn.tryAgain")}
          </button>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2 text-center">
          <Newspaper size={28} className="text-[#4A6080]" />
          <p className="text-sm text-[#A8B5C7]">
            {t("mn.noEvents1")}{" "}
            {filter === "high" ? "high-impact" : "high/medium-impact"} events{" "}
            {t("mn.noEvents2")}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((evs) => (
            <div key={dayKey(evs[0].timestamp)}>
              <div className="flex items-center gap-3 mb-3">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#A8B5C7] bg-white/5 rounded-md px-2.5 py-1">
                  {dayHeader(evs[0].timestamp)}
                </span>
                <div className="flex-1 h-px bg-white/8" />
                <span className="font-mono text-[11px] text-[#4A6080]">
                  {evs.length} {evs.length === 1 ? "event" : "events"}
                </span>
              </div>
              <div className="space-y-3">
                {evs.map((ev) => (
                  <EventCard key={ev.id} ev={ev} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== Footer ===== */}
      {groups.length > 0 && (
        <div className="text-center text-xs text-[#4A6080] mt-10 font-mono">
          {t("mn.footer")}
        </div>
      )}
    </div>
  );
}

export default MarketNewsPage;
