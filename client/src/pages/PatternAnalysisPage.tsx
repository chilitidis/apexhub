// PatternAnalysisPage — "Ανάλυση Patterns"
// Aggregates the trader's whole history (all months) and surfaces win-rate
// breakdowns by day / instrument / setup / emotion, headline patterns,
// strengths & weaknesses, and an action plan. An optional LLM narrative is
// layered on top of the deterministic numbers.

import { useMemo, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  Zap,
  CalendarDays,
  Heart,
  Target,
  BarChart3,
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Loader2,
  Clock,
} from "lucide-react";
import type { Trade } from "@/lib/trading";
import {
  analyzePatterns,
  type GroupStat,
  type PatternAnalysis,
} from "@/lib/patternAnalysis";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

// ---- helpers ---------------------------------------------------------------

function fmtMoney(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toLocaleString("el-GR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
function pctText(n: number): string {
  return `${Math.round(n * 100)}%`;
}

// ---- win-rate bar row ------------------------------------------------------

function StatRow({ g }: { g: GroupStat }) {
  const { lang } = useLanguage();
  const keyLabel = g.key === "Not specified" && lang !== "en" ? "Χωρίς καταγραφή" : g.key;
  const positive = g.pnl >= 0;
  const barColor = positive ? "#3FB68B" : "#E5484D";
  const pnlColor = positive ? "text-[#3FB68B]" : "text-[#E5484D]";
  const width = Math.round(g.win_rate * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm text-[#C9C4B9]">{keyLabel}</span>
        <span className={`font-mono text-sm font-semibold ${pnlColor}`}>
          {fmtMoney(g.pnl)}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-white/8 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${width}%`, background: barColor }}
          />
        </div>
        <span className="font-mono text-xs font-semibold text-[#C9C4B9] w-10 text-right">
          {pctText(g.win_rate)}
        </span>
        <span className="font-mono text-xs text-[#8E8A82] w-7 text-right">
          ({g.trades})
        </span>
      </div>
    </div>
  );
}

function StatCard({
  title,
  icon,
  rows,
  emptyHint,
}: {
  title: string;
  icon: React.ReactNode;
  rows: GroupStat[];
  emptyHint?: string;
}) {
  const { t } = useLanguage();
  const visible = rows.filter((r) => r.trades > 0).slice(0, 6);
  return (
    <div className="bg-[#121214]/70 border border-white/8 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-[#C9A24A]">{icon}</span>
        <h3 className="font-['Inter'] text-base font-semibold text-white">
          {title}
        </h3>
      </div>
      {visible.length > 0 ? (
        <div className="space-y-4">
          {visible.map((g) => (
            <StatRow key={g.key} g={g} />
          ))}
        </div>
      ) : (
        <div className="text-sm text-[#8E8A82] py-4 text-center">
          {emptyHint ?? t("pat.notEnoughData")}
        </div>
      )}
    </div>
  );
}

// ---- main page -------------------------------------------------------------

export interface PatternAnalysisPageProps {
  /** All trades from every saved month for the active account. */
  trades: Trade[];
}

export function PatternAnalysisPage({ trades }: PatternAnalysisPageProps) {
  const { t, lang } = useLanguage();
  const analysis: PatternAnalysis = useMemo(
    () => analyzePatterns(trades),
    [trades],
  );

  const [analyzedAt, setAnalyzedAt] = useState<Date>(() => new Date());
  const [summary, setSummary] = useState<string>("");
  const summarize = trpc.pattern.summarize.useMutation();

  const runSummary = useCallback(() => {
    setAnalyzedAt(new Date());
    if (analysis.closedTrades === 0) {
      setSummary(t("pat.noClosedTrades"));
      return;
    }
    summarize.mutate(
      {
        closedTrades: analysis.closedTrades,
        wins: analysis.wins,
        losses: analysis.losses,
        winRate: analysis.winRate,
        totalPnl: analysis.totalPnl,
        byDay: analysis.byDay,
        byInstrument: analysis.byInstrument,
        bySetup: analysis.bySetup,
        byEmotion: analysis.byEmotion,
        bestDay: analysis.bestDay,
        bestInstrument: analysis.bestInstrument,
        language: lang === "en" ? "en" : "el",
      },
      {
        onSuccess: (res) => setSummary(res.summary),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, lang]);

  // Auto-run when the data first becomes available — and re-run when the UI
  // language changes so the narrative always matches it.
  useEffect(() => {
    runSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis.closedTrades, analysis.totalPnl, lang]);

  const summarizing = summarize.isPending;

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ===== Header ===== */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[#C9A24A]">
              <Brain size={26} />
            </span>
            <h1 className="font-display text-2xl sm:text-3xl text-[#F2EFE8]">
              {t("pat.title")}
            </h1>
          </div>
          <p className="text-sm text-[#B5B0A6] max-w-xl">
            {t("pat.subtitle")}
          </p>
        </div>
        <button
          onClick={runSummary}
          disabled={summarizing}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C9A24A] text-[#0A0A0B] font-semibold text-sm hover:bg-[#E6C873] transition-colors disabled:opacity-60"
        >
          {summarizing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Zap size={16} />
          )}
          {t("pat.refresh")}
        </button>
      </div>

      {/* ===== Meta line ===== */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#8E8A82] mb-5 font-mono">
        <span className="flex items-center gap-1.5">
          <CalendarDays size={13} /> {t("pat.analysisLabel")}{" "}
          {analyzedAt.toLocaleString(lang === "el" ? "el-GR" : "en-US")}
        </span>
        <span className="flex items-center gap-1.5">
          <BarChart3 size={13} /> {analysis.closedTrades} {t("pat.tradesAnalyzed")}
        </span>
      </div>

      {/* ===== Summary box ===== */}
      <div className="bg-[#121214]/50 border border-white/8 rounded-2xl p-6 mb-8">
        {summarizing && !summary ? (
          <div className="flex items-center gap-2 text-[#B5B0A6] text-sm">
            <Loader2 size={16} className="animate-spin" /> {t("pat.generatingSummary")}
          </div>
        ) : (
          <p className="text-[15px] leading-relaxed text-[#D5DEEA]">
            {summary || t("pat.pressRefresh")}
          </p>
        )}
      </div>

      {/* ===== Win-rate grid ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
        <StatCard
          title={t("pat.winRateByDay")}
          icon={<CalendarDays size={16} />}
          rows={analysis.byDay}
        />
        <StatCard
          title={t("pat.winRateByEmotion")}
          icon={<Heart size={16} />}
          rows={analysis.byEmotion}
        />
        <StatCard
          title={t("pat.winRateBySetup")}
          icon={<Target size={16} />}
          rows={analysis.bySetup}
        />
        <StatCard
          title={t("pat.winRateByInstrument")}
          icon={<BarChart3 size={16} />}
          rows={analysis.byInstrument}
        />
        <StatCard
          title={t("pat.winRateByHour")}
          icon={<Clock size={16} />}
          rows={analysis.byHour}
          emptyHint={t("pat.noHours")}
        />
      </div>

      {/* ===== Key patterns ===== */}
      <SectionTitle icon={<Activity size={18} />} text={t("pat.mainPatterns")} />
      {analysis.keyPatterns.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-10">
          {analysis.keyPatterns.map((p, i) => {
            const positive = p.tone === "positive";
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-2xl p-5 border ${
                  positive
                    ? "bg-[#3FB68B]/8 border-[#3FB68B]/25"
                    : "bg-[#C9A24A]/8 border-[#C9A24A]/25"
                }`}
              >
                <div className="flex items-start gap-2 mb-3 flex-wrap">
                  <span className={positive ? "text-[#3FB68B]" : "text-[#C9A24A]"}>
                    {positive ? <TrendingUp size={16} /> : <Zap size={16} />}
                  </span>
                  <h4 className="font-['Inter'] font-semibold text-white text-[15px] flex-1 min-w-[140px]">
                    {p.title}
                  </h4>
                  <span
                    className={`font-mono text-[11px] px-2.5 py-1 rounded-full border ${
                      positive
                        ? "text-[#3FB68B] border-[#3FB68B]/40 bg-[#3FB68B]/10"
                        : "text-[#C9A24A] border-[#C9A24A]/40 bg-[#C9A24A]/10"
                    }`}
                  >
                    {p.chip}
                  </span>
                </div>
                <p className="text-sm text-[#B5B0A6] leading-relaxed">
                  {p.detail}
                </p>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-[#8E8A82] mb-10">
          {t("pat.noPatterns")}
        </div>
      )}

      {/* ===== Mistakes + strengths ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <div>
          <SectionTitle
            icon={<AlertTriangle size={18} className="text-[#E5484D]" />}
            text={t("pat.criticalMistakes")}
          />
          <div className="space-y-4">
            {analysis.weaknesses.length > 0 ? (
              analysis.weaknesses.map((w, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-5 bg-[#E5484D]/8 border border-[#E5484D]/25"
                >
                  <h4 className="font-['Inter'] font-semibold text-[#E5484D] mb-2">
                    {w.title}
                  </h4>
                  <p className="text-sm text-[#B5B0A6] leading-relaxed">
                    {w.detail}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl p-5 bg-[#121214]/50 border border-white/8 text-sm text-[#B5B0A6]">
                {t("pat.noMistakes")}
              </div>
            )}
          </div>
        </div>
        <div>
          <SectionTitle
            icon={<CheckCircle2 size={18} className="text-[#3FB68B]" />}
            text={t("pat.strengths")}
          />
          <div className="space-y-4">
            {analysis.strengths.length > 0 ? (
              analysis.strengths.map((s, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-5 bg-[#3FB68B]/8 border border-[#3FB68B]/25"
                >
                  <h4 className="font-['Inter'] font-semibold text-[#3FB68B] mb-2">
                    {s.title}
                  </h4>
                  <p className="text-sm text-[#B5B0A6] leading-relaxed">
                    {s.detail}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl p-5 bg-[#121214]/50 border border-white/8 text-sm text-[#B5B0A6]">
                {t("pat.noStrengths")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Action plan ===== */}
      <div className="bg-[#121214]/60 border border-white/8 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Zap size={18} className="text-[#C9A24A]" />
          <h3 className="font-['Inter'] text-lg font-semibold text-white">
            {t("pat.actionPlan")}
          </h3>
        </div>
        <ol className="space-y-4">
          {analysis.actionPlan.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="shrink-0 w-7 h-7 rounded-full bg-[#C9A24A]/15 border border-[#C9A24A]/40 flex items-center justify-center font-mono text-xs font-semibold text-[#C9A24A]">
                {i + 1}
              </span>
              <p className="text-sm text-[#C9C4B9] leading-relaxed pt-0.5">
                {step}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function SectionTitle({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[#C9A24A]">{icon}</span>
      <h2 className="font-['Inter'] text-lg font-semibold text-white">
        {text}
      </h2>
    </div>
  );
}

export default PatternAnalysisPage;
