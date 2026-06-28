/**
 * DashboardLanding — the new landing screen reachable from the sidebar's
 * "Dashboard" item. Replaces the previous behavior of showing the active
 * account dashboard (which lives at /account/:id now).
 *
 * It renders a grid of shortcut tiles that mirror the sidebar's most
 * important destinations and actions, so the user has a consistent overview
 * of what they can do in APEXHUB without needing the account-specific KPIs.
 */
import React from "react";
void React;
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LayoutDashboard,
  Plus,
  CalendarPlus,
  Wifi,
  ShieldCheck,
  Wallet,
  Calculator,
  LineChart,
  Users,
  TrendingUp,
  BookOpen,
  CalendarDays,
  Trophy,
  Brain,
  ChartCandlestick,
  Newspaper,
  Sunrise,
  GraduationCap,
} from "lucide-react";

export type DashboardShortcut = {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  /** When set, clicking the tile fires this handler (for action items). */
  onAction?: () => void;
  /** When set, clicking the tile switches the in-page view (for view items). */
  onNavigate?: () => void;
  /** Tag rendered top-right of the tile (e.g. "Soon"). */
  badge?: string;
  /** Accent gradient class for the icon background. */
  accent: string;
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
  /** Switch to the Accounts Overview page (URL "/"). */
  onAccountsOverview: () => void;
  /** Open the Pattern Analysis view for the active account. */
  onPatternAnalysis: () => void;
  /** Open the Pre-Market Briefing view. */
  onPreMarketBriefing: () => void;
  /** Open the Market News view. */
  onMarketNews: () => void;
  /** Open the Mindset Coach view. */
  onMindsetCoach: () => void;
  /** Open the standalone Trading Coach page. */
  onTradingCoach: () => void;
  /** Open the standalone Prop Firm Tracker page. */
  onPropFirm: () => void;
  /** Switch to a placeholder "Coming Soon" view by key. */
  onComingSoon: (label: string) => void;
};

export function DashboardLanding({ handlers }: { handlers: DashboardHandlers }) {
  const { t } = useLanguage();
  const shortcuts: DashboardShortcut[] = [
    // ---- ACTIONS (open modals / quick flows) ----
    {
      key: "add-trade",
      label: t("dl.addTrade"),
      description: t("dl.addTradeDesc"),
      icon: <Plus size={20} />,
      accent: "from-[#0094C6] to-[#005377]",
      onAction: handlers.onAddTrade,
    },
    {
      key: "sync-mt5",
      label: t("dl.syncMt5"),
      description: t("dl.syncMt5Desc"),
      icon: <Wifi size={20} />,
      accent: "from-[#06B6D4] to-[#0E7490]",
      onAction: handlers.onSyncMt5,
    },
    {
      key: "new-month",
      label: t("dl.newMonth"),
      description: t("dl.newMonthDesc"),
      icon: <CalendarPlus size={20} />,
      accent: "from-[#0EA5E9] to-[#0369A1]",
      onAction: handlers.onNewMonth,
    },
    {
      key: "pre-check",
      label: t("dl.preCheck"),
      description: t("dl.preCheckDesc"),
      icon: <ShieldCheck size={20} />,
      accent: "from-[#22C55E] to-[#15803D]",
      onAction: handlers.onCheck,
    },
    {
      key: "cash",
      label: t("dl.cash"),
      description: t("dl.cashDesc"),
      icon: <Wallet size={20} />,
      accent: "from-[#F59E0B] to-[#B45309]",
      onAction: handlers.onCash,
    },
    {
      key: "what-if",
      label: t("dl.compounding"),
      description: t("dl.compoundingDesc"),
      icon: <LineChart size={20} />,
      accent: "from-[#EC4899] to-[#9D174D]",
      onAction: handlers.onWhatIf,
    },
    {
      key: "export",
      label: t("dl.export"),
      description: t("dl.exportDesc"),
      icon: <Calculator size={20} />,
      accent: "from-[#64748B] to-[#334155]",
      onAction: handlers.onExport,
    },

    // ---- NAVIGATION ----
    {
      key: "accounts-overview",
      label: t("dl.accountsOverview"),
      description: t("dl.accountsOverviewDesc"),
      icon: <Users size={20} />,
      accent: "from-[#3B82F6] to-[#1E40AF]",
      onNavigate: handlers.onAccountsOverview,
    },

    // ---- COMING SOON (mirrors the sidebar) ----
    {
      key: "calendar",
      label: t("dl.calendar"),
      description: t("dl.calendarDesc"),
      icon: <CalendarDays size={20} />,
      accent: "from-[#0F766E] to-[#134E4A]",
      onNavigate: () => handlers.onComingSoon("Calendar"),
    },
    {
      key: "position-calc",
      label: t("dl.positionCalc"),
      description: t("dl.positionCalcDesc"),
      icon: <Calculator size={20} />,
      accent: "from-[#0077B6] to-[#023E8A]",
      onNavigate: () => handlers.onComingSoon("Position Calculator"),
    },
    {
      key: "pattern-analysis",
      label: t("dl.patternAnalysis"),
      description: t("dl.patternAnalysisDesc"),
      icon: <Brain size={20} />,
      accent: "from-[#A855F7] to-[#6B21A8]",
      onNavigate: handlers.onPatternAnalysis,
    },
    {
      key: "mindset-coach",
      label: t("dl.mindsetCoach"),
      description: t("dl.mindsetCoachDesc"),
      icon: <Brain size={20} />,
      accent: "from-[#F97316] to-[#9A3412]",
      onNavigate: handlers.onMindsetCoach,
    },
    {
      key: "trading-coach",
      label: t("dl.tradingCoach"),
      description: t("dl.tradingCoachDesc"),
      icon: <ChartCandlestick size={20} />,
      accent: "from-[#0077B6] to-[#023E8A]",
      onNavigate: handlers.onTradingCoach,
    },
    {
      key: "premarket",
      label: t("dl.premarket"),
      description: t("dl.premarketDesc"),
      icon: <Sunrise size={20} />,
      accent: "from-[#F4A261] to-[#C2410C]",
      onNavigate: handlers.onPreMarketBriefing,
    },
    {
      key: "market-news",
      label: t("dl.marketNews"),
      description: t("dl.marketNewsDesc"),
      icon: <Newspaper size={20} />,
      accent: "from-[#0EA5E9] to-[#0369A1]",
      onNavigate: handlers.onMarketNews,
    },
    {
      key: "prop-firm",
      label: t("pf.title"),
      description: t("pf.subtitle"),
      icon: <ShieldCheck size={20} />,
      accent: "from-[#14B8A6] to-[#0F766E]",
      onNavigate: handlers.onPropFirm,
    },
  ];

  return (
    <div className="flex-1 min-h-0 bg-[#0A1628] text-white pt-4 pb-4 overflow-y-auto xl:overflow-hidden" data-testid="dashboard-landing">
      <div className="min-h-full xl:h-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-4">
        {/* Page header */}
        <header className="flex items-center gap-3 shrink-0">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0094C6] to-[#005377] flex items-center justify-center shadow-lg shadow-[#0094C6]/20">
            <LayoutDashboard size={22} />
          </div>
          <div>
            <h1 className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight">{t("dl.title")}</h1>
            <p className="font-mono text-[11px] text-[#6E8AA8] uppercase tracking-widest">
              {t("dl.subtitle")}
            </p>
          </div>
        </header>

        {/* Shortcut grid — fills remaining height; 4 rows on xl so all 16
            tiles fit a single viewport without page scroll. Tile visual size
            (padding/icons/typography) is unchanged. */}
        <div className="flex-1 min-h-0 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-auto xl:auto-rows-fr gap-3 sm:gap-4 xl:overflow-hidden">
          {shortcuts.map((s, i) => (
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
              transition={{ delay: i * 0.025, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -2, scale: 1.01 }}
              className="group relative bg-[#0D1E35]/80 hover:bg-[#0D1E35] border border-white/8 hover:border-white/20 rounded-2xl p-4 sm:p-5 text-left transition-all backdrop-blur-sm"
            >
              {s.badge && (
                <span className="absolute top-3 right-3 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-[9px] font-mono uppercase tracking-widest">
                  {s.badge}
                </span>
              )}
              <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br ${s.accent} flex items-center justify-center text-white shadow-md mb-3 sm:mb-4`}>
                {s.icon}
              </div>
              <div className="font-['Space_Grotesk'] text-[13px] sm:text-[15px] font-semibold text-white mb-1">
                {s.label}
              </div>
              <div className="font-mono text-[10px] leading-relaxed text-[#A8B5C7]">
                {s.description}
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DashboardLanding;
