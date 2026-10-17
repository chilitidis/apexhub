/**
 * DashboardLanding — the landing screen reachable from the sidebar's
 * "Αρχική" item. Renders a serif greeting plus a grid of shortcut tiles
 * grouped like the sidebar (ΚΥΡΙΑ / ΔΕΔΟΜΕΝΑ / ΕΡΓΑΛΕΙΑ / AI).
 */
import React from "react";
void React;
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Plus,
  CalendarPlus,
  Wifi,
  ShieldCheck,
  Wallet,
  Calculator,
  LineChart,
  Users,
  FileDown,
  FileUp,
  CalendarDays,
  Brain,
  ChartCandlestick,
  Newspaper,
  Sunrise,
  Gauge,
  SearchCheck,
} from "lucide-react";

export type DashboardShortcut = {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  section: string;
  onAction?: () => void;
  onNavigate?: () => void;
};

export type DashboardHandlers = {
  onAddTrade: () => void;
  onNewMonth: () => void;
  onImport: () => void;
  onSyncMt5: () => void;
  onCheck: () => void;
  onCash: () => void;
  onWhatIf: () => void;
  onExport: () => void;
  onAccountsOverview: () => void;
  onPatternAnalysis: () => void;
  onPreMarketBriefing: () => void;
  onMarketNews: () => void;
  onMindsetCoach: () => void;
  onTradingCoach: () => void;
  onPropFirm: () => void;
  onComingSoon: (label: string) => void;
};

export type DashboardGreeting = {
  userName?: string | null;
  accountName?: string | null;
  monthLabel?: string | null;
  monthPct?: number | null;
};

export function DashboardLanding({
  handlers,
  greeting,
}: {
  handlers: DashboardHandlers;
  greeting?: DashboardGreeting;
}) {
  const { t } = useLanguage();

  const hour = new Date().getHours();
  const hello = hour >= 5 && hour < 12 ? t("dl.goodMorning") : t("dl.goodEvening");
  const rawFirst = (greeting?.userName || "").trim().split(/\s+/)[0] || "";
  // Greek vocative: Ιωάννης -> Ιωάννη, Γιώργος -> Γιώργο (drop the final ς).
  const firstName = /[Α-Ωα-ωίϊΐόάέύϋΰήώ]/.test(rawFirst) && rawFirst.endsWith("ς")
    ? rawFirst.slice(0, -1)
    : rawFirst;

  const shortcuts: DashboardShortcut[] = [
    // ---- ΚΥΡΙΑ ----
    {
      key: "add-trade",
      section: t("dl.secMain"),
      label: t("sb.addTrade"),
      description: t("dl.addTradeDesc"),
      icon: <Plus size={20} strokeWidth={1.5} />,
      onAction: handlers.onAddTrade,
    },
    {
      key: "calendar",
      section: t("dl.secMain"),
      label: t("sb.calendar"),
      description: t("dl.calendarDesc"),
      icon: <CalendarDays size={20} strokeWidth={1.5} />,
      onNavigate: () => handlers.onComingSoon("Calendar"),
    },
    {
      key: "accounts-overview",
      section: t("dl.secMain"),
      label: t("sb.accounts"),
      description: t("dl.accountsOverviewDesc"),
      icon: <Users size={20} strokeWidth={1.5} />,
      onNavigate: handlers.onAccountsOverview,
    },
    {
      key: "new-month",
      section: t("dl.secMain"),
      label: t("dl.newMonth"),
      description: t("dl.newMonthDesc"),
      icon: <CalendarPlus size={20} strokeWidth={1.5} />,
      onAction: handlers.onNewMonth,
    },

    // ---- ΔΕΔΟΜΕΝΑ ----
    {
      key: "sync-mt5",
      section: t("dl.secData"),
      label: t("sb.syncMt5"),
      description: t("dl.syncMt5Desc"),
      icon: <Wifi size={20} strokeWidth={1.5} />,
      onAction: handlers.onSyncMt5,
    },
    {
      key: "import",
      section: t("dl.secData"),
      label: t("sb.import"),
      description: t("dl.importDesc"),
      icon: <FileUp size={20} strokeWidth={1.5} />,
      onAction: handlers.onImport,
    },
    {
      key: "export",
      section: t("dl.secData"),
      label: t("sb.export"),
      description: t("dl.exportDesc"),
      icon: <FileDown size={20} strokeWidth={1.5} />,
      onAction: handlers.onExport,
    },
    {
      key: "cash",
      section: t("dl.secData"),
      label: t("sb.cash"),
      description: t("dl.cashDesc"),
      icon: <Wallet size={20} strokeWidth={1.5} />,
      onAction: handlers.onCash,
    },

    // ---- ΕΡΓΑΛΕΙΑ ----
    {
      key: "pre-check",
      section: t("dl.secTools"),
      label: t("sb.check"),
      description: t("dl.preCheckDesc"),
      icon: <SearchCheck size={20} strokeWidth={1.5} />,
      onAction: handlers.onCheck,
    },
    {
      key: "position-calc",
      section: t("dl.secTools"),
      label: t("sb.positionCalc"),
      description: t("dl.positionCalcDesc"),
      icon: <Calculator size={20} strokeWidth={1.5} />,
      onNavigate: () => handlers.onComingSoon("Position Calculator"),
    },
    {
      key: "what-if",
      section: t("dl.secTools"),
      label: t("sb.compounding"),
      description: t("dl.compoundingDesc"),
      icon: <LineChart size={20} strokeWidth={1.5} />,
      onAction: handlers.onWhatIf,
    },
    {
      key: "prop-firm",
      section: t("dl.secTools"),
      label: t("sb.propFirm"),
      description: t("dl.propFirmDesc"),
      icon: <Gauge size={20} strokeWidth={1.5} />,
      onNavigate: handlers.onPropFirm,
    },

    // ---- AI ----
    {
      key: "trading-coach",
      section: "AI",
      label: t("sb.tradingCoach"),
      description: t("dl.tradingCoachDesc"),
      icon: <ChartCandlestick size={20} strokeWidth={1.5} />,
      onNavigate: handlers.onTradingCoach,
    },
    {
      key: "mindset-coach",
      section: "AI",
      label: t("sb.mindsetCoach"),
      description: t("dl.mindsetCoachDesc"),
      icon: <Brain size={20} strokeWidth={1.5} />,
      onNavigate: handlers.onMindsetCoach,
    },
    {
      key: "pattern-analysis",
      section: "AI",
      label: t("sb.patterns"),
      description: t("dl.patternAnalysisDesc"),
      icon: <ShieldCheck size={20} strokeWidth={1.5} />,
      onNavigate: handlers.onPatternAnalysis,
    },
    {
      key: "premarket",
      section: "AI",
      label: t("sb.preMarket"),
      description: t("dl.premarketDesc"),
      icon: <Sunrise size={20} strokeWidth={1.5} />,
      onNavigate: handlers.onPreMarketBriefing,
    },
    {
      key: "market-news",
      section: "AI",
      label: t("sb.marketNews"),
      description: t("dl.marketNewsDesc"),
      icon: <Newspaper size={20} strokeWidth={1.5} />,
      onNavigate: handlers.onMarketNews,
    },
  ];

  const sections: string[] = [];
  for (const s of shortcuts) if (!sections.includes(s.section)) sections.push(s.section);

  const pct = greeting?.monthPct;
  const pctColor =
    pct == null ? "text-[#8E8A82]" : pct >= 0 ? "text-[#3FB68B]" : "text-[#E5484D]";

  let tileIndex = 0;

  return (
    <div
      className="flex-1 min-h-0 bg-[#0A0A0B] text-[#F2EFE8] pt-6 pb-10 overflow-y-auto"
      data-testid="dashboard-landing"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-8">
        {/* Greeting */}
        <header className="shrink-0">
          <h1 className="font-display text-[clamp(26px,3vw,34px)] font-normal tracking-[-0.01em] text-[#F2EFE8]">
            {hello}
            {firstName ? `, ${firstName}` : ""}.
          </h1>
          {(greeting?.accountName || greeting?.monthLabel) && (
            <p className="mt-1.5 text-[14px] text-[#8E8A82]">
              {greeting?.accountName}
              {greeting?.monthLabel ? (
                <>
                  {greeting?.accountName ? " · " : ""}
                  {greeting.monthLabel}
                </>
              ) : null}
              {pct != null && (
                <>
                  {" · P/L "}
                  <span className={`font-mono tabular-nums ${pctColor}`}>
                    {pct >= 0 ? "+" : ""}
                    {pct.toFixed(2).replace(".", ",")}%
                  </span>
                </>
              )}
            </p>
          )}
        </header>

        {/* Grouped shortcut grid */}
        {sections.map((section) => (
          <section key={section}>
            <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-[#C9A24A]/80">
              {section}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {shortcuts
                .filter((s) => s.section === section)
                .map((s) => {
                  const i = tileIndex++;
                  return (
                    <motion.button
                      key={s.key}
                      data-testid={`dashboard-tile-${s.key}`}
                      type="button"
                      onClick={() => {
                        if (s.onAction) s.onAction();
                        else if (s.onNavigate) s.onNavigate();
                      }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      whileHover={{ y: -2 }}
                      className="group relative bg-[#121214] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(201,162,74,0.30)] rounded-2xl p-4 sm:p-5 text-left transition-colors duration-250"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#18181B] border border-[rgba(201,162,74,0.20)] flex items-center justify-center text-[#C9A24A] mb-3 sm:mb-4">
                        {s.icon}
                      </div>
                      <div className="font-['Inter'] text-[15px] font-medium text-[#F2EFE8] mb-1">
                        {s.label}
                      </div>
                      <div className="text-[12.5px] leading-relaxed text-[#8E8A82]">
                        {s.description}
                      </div>
                    </motion.button>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default DashboardLanding;
