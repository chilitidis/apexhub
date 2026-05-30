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
import {
  LayoutDashboard,
  Plus,
  CalendarPlus,
  Upload,
  Wifi,
  ShieldCheck,
  Wallet,
  Calculator,
  Sigma,
  Users,
  TrendingUp,
  BookOpen,
  CalendarDays,
  ListOrdered,
  Trophy,
  Sparkles,
  Brain,
  Newspaper,
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
  /** Switch to a placeholder "Coming Soon" view by key. */
  onComingSoon: (label: string) => void;
};

export function DashboardLanding({ handlers }: { handlers: DashboardHandlers }) {
  const shortcuts: DashboardShortcut[] = [
    // ---- ACTIONS (open modals / quick flows) ----
    {
      key: "add-trade",
      label: "Add Trade",
      description: "Καταχώρησε νέο trade με screenshot scan και full notes",
      icon: <Plus size={20} />,
      accent: "from-[#0094C6] to-[#005377]",
      onAction: handlers.onAddTrade,
    },
    {
      key: "sync-mt5",
      label: "Sync MT5",
      description: "Συγχρόνισε αυτόματα τα trades από το MetaTrader λογαριασμό σου",
      icon: <Wifi size={20} />,
      accent: "from-[#06B6D4] to-[#0E7490]",
      onAction: handlers.onSyncMt5,
    },
    {
      key: "new-month",
      label: "New Month",
      description: "Δημιούργησε μηνιαίο snapshot με αρχικό balance",
      icon: <CalendarPlus size={20} />,
      accent: "from-[#0EA5E9] to-[#0369A1]",
      onAction: handlers.onNewMonth,
    },
    {
      key: "import",
      label: "Import Excel",
      description: "Εισήγαγε τους μήνες από APEXHUB / MT5 export",
      icon: <Upload size={20} />,
      accent: "from-[#8B5CF6] to-[#5B21B6]",
      onAction: handlers.onImport,
    },
    {
      key: "pre-check",
      label: "Pre-Trade Check",
      description: "20-σημείων checklist πριν μπεις σε trade",
      icon: <ShieldCheck size={20} />,
      accent: "from-[#22C55E] to-[#15803D]",
      onAction: handlers.onCheck,
    },
    {
      key: "cash",
      label: "Cash Adjustment",
      description: "Καταχώρησε καταθέσεις / αναλήψεις στον τρέχοντα λογαριασμό",
      icon: <Wallet size={20} />,
      accent: "from-[#F59E0B] to-[#B45309]",
      onAction: handlers.onCash,
    },
    {
      key: "what-if",
      label: "What-If",
      description: "Εξερεύνησε εναλλακτικά σενάρια στα trades σου",
      icon: <Sigma size={20} />,
      accent: "from-[#EC4899] to-[#9D174D]",
      onAction: handlers.onWhatIf,
    },
    {
      key: "export",
      label: "Export Excel",
      description: "Κατέβασε όλο τον τρέχοντα μήνα ως APEXHUB workbook",
      icon: <Calculator size={20} />,
      accent: "from-[#64748B] to-[#334155]",
      onAction: handlers.onExport,
    },

    // ---- NAVIGATION ----
    {
      key: "accounts-overview",
      label: "Accounts Overview",
      description: "Δες & διάλεξε τους λογαριασμούς σου",
      icon: <Users size={20} />,
      accent: "from-[#3B82F6] to-[#1E40AF]",
      onNavigate: handlers.onAccountsOverview,
    },

    // ---- COMING SOON (mirrors the sidebar) ----
    {
      key: "trades",
      label: "Trades",
      description: "Λίστα όλων των trades cross-account",
      icon: <ListOrdered size={20} />,
      accent: "from-[#0F766E] to-[#134E4A]",
      onNavigate: () => handlers.onComingSoon("Trades"),
      badge: "Soon",
    },
    {
      key: "calendar",
      label: "Calendar",
      description: "Ημερολογιακή προβολή των trades",
      icon: <CalendarDays size={20} />,
      accent: "from-[#0F766E] to-[#134E4A]",
      onNavigate: () => handlers.onComingSoon("Calendar"),
    },
    {
      key: "position-calc",
      label: "Position Calculator",
      description: "Υπολόγισε lot size βάσει balance / risk %",
      icon: <Calculator size={20} />,
      accent: "from-[#475569] to-[#1E293B]",
      onNavigate: () => handlers.onComingSoon("Position Calculator"),
      badge: "Soon",
    },
    {
      key: "analytics",
      label: "Analytics",
      description: "Αναλυτικά metrics και deep insights",
      icon: <TrendingUp size={20} />,
      accent: "from-[#A855F7] to-[#6B21A8]",
      onNavigate: () => handlers.onComingSoon("Analytics"),
      badge: "Soon",
    },
    {
      key: "trading-coach",
      label: "Trading Coach",
      description: "AI σύμβουλος για βελτίωση trading",
      icon: <Sparkles size={20} />,
      accent: "from-[#F97316] to-[#9A3412]",
      onNavigate: () => handlers.onComingSoon("Trading Coach"),
      badge: "Soon",
    },
    {
      key: "mindset-coach",
      label: "Mindset Coach",
      description: "Ψυχολογική υποστήριξη και mindset training",
      icon: <Brain size={20} />,
      accent: "from-[#F97316] to-[#9A3412]",
      onNavigate: () => handlers.onComingSoon("Mindset Coach"),
      badge: "Soon",
    },
    {
      key: "premarket",
      label: "Pre-Market Briefing",
      description: "Καθημερινή ενημέρωση για τις αγορές",
      icon: <Newspaper size={20} />,
      accent: "from-[#F97316] to-[#9A3412]",
      onNavigate: () => handlers.onComingSoon("Pre-Market Briefing"),
      badge: "Soon",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0A1628] text-white pt-8 pb-20" data-testid="dashboard-landing">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Page header */}
        <header className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0094C6] to-[#005377] flex items-center justify-center shadow-lg shadow-[#0094C6]/20">
            <LayoutDashboard size={22} />
          </div>
          <div>
            <h1 className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="font-mono text-[11px] text-[#6E8AA8] uppercase tracking-widest">
              Quick access σε όλα τα tools του APEXHUB
            </p>
          </div>
        </header>

        {/* Shortcut grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
              className="group relative bg-[#0D1E35]/80 hover:bg-[#0D1E35] border border-white/8 hover:border-white/20 rounded-2xl p-5 text-left transition-all backdrop-blur-sm"
            >
              {s.badge && (
                <span className="absolute top-3 right-3 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-[9px] font-mono uppercase tracking-widest">
                  {s.badge}
                </span>
              )}
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.accent} flex items-center justify-center text-white shadow-md mb-4`}>
                {s.icon}
              </div>
              <div className="font-['Space_Grotesk'] text-[15px] font-semibold text-white mb-1">
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
