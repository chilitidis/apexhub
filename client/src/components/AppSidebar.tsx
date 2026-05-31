/**
 * AppSidebar — primary navigation surface for APEXHUB.
 *
 * Single flat ordered list of items (section headers were removed in Round 29
 * for visual simplicity). Each item is either:
 *   - an "action" that fires a callback (open a modal, run an export, etc.)
 *   - a "view" that switches the main content panel via setView(viewKey)
 *   - a "coming-soon" placeholder
 *
 * The sidebar owns its open/closed state for mobile (overlay drawer); on
 * desktop it is always visible (lg:translate-x-0).
 */

import React, { useState, type ReactNode } from "react";
void React;
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ListOrdered,
  CalendarPlus,
  CalendarDays,
  Plug,
  Wallet,
  FileSpreadsheet,
  ShieldCheck,
  Plus,
  Download,
  Calculator,
  BarChart3,
  LineChart,
  Lightbulb,
  Sparkles,
  Brain,
  Newspaper,
  ChevronLeft,
  ChevronRight,
  Building2,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import ThemeToggle from "@/components/ThemeToggle";
import { CLERK_ENABLED } from "@/const";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";

export type ViewKey =
  | "dashboard"
  | "trades"
  | "calendar"
  | "accounts"
  | "position-calc"
  | "analytics"
  | "pattern-analysis"
  | "trading-coach"
  | "mindset-coach"
  | "pre-market";

export interface SidebarHandlers {
  onAddTrade: () => void;
  onNewMonth: () => void;
  onImport: () => void;
  onSyncMt5: () => void;
  onCheck: () => void;
  onCash: () => void;
  onCalc: () => void;
  onExport: () => void;
}

interface AppSidebarProps {
  view: ViewKey;
  setView: (v: ViewKey) => void;
  handlers: SidebarHandlers;
  /** Tag shown in the top header (e.g. month + last sync). */
  liveSyncLabel?: string;
  /** Optional badge for the Calendar / monthly history item. */
  monthlyHistoryCount?: number;
  /** Optional badge for the Accounts item. */
  accountsCount?: number;
}

interface SidebarItem {
  key: string;
  label: string;
  icon: ReactNode;
  /** When set, clicking switches the main view to this key. */
  view?: ViewKey;
  /** When set, clicking fires this callback (modal trigger / export). */
  action?: () => void;
  /** Marks the item as not yet implemented. */
  comingSoon?: boolean;
  /** Optional small badge (count). */
  badge?: number;
  /** Highlighted "primary" styling (e.g. ADD TRADE). */
  primary?: boolean;
}

export function AppSidebar({
  view,
  setView,
  handlers,
  liveSyncLabel,
  monthlyHistoryCount,
  accountsCount,
}: AppSidebarProps) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Round 29: a single flat list (no section headers, no Live Sync entry).
  const items: SidebarItem[] = [
    {
      key: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard size={16} />,
      view: "dashboard",
    },
    {
      key: "add-trade",
      label: "Add Trade",
      icon: <Plus size={16} strokeWidth={2.75} />,
      action: handlers.onAddTrade,
      primary: true,
    },
    {
      key: "trades",
      label: "Trades",
      icon: <ListOrdered size={16} />,
      view: "trades",
      comingSoon: true,
    },
    {
      key: "calendar",
      label: "Calendar",
      icon: <CalendarDays size={16} />,
      view: "calendar",
      badge: monthlyHistoryCount,
    },
    {
      key: "accounts",
      label: "Accounts",
      icon: <Building2 size={16} />,
      view: "accounts",
      badge: accountsCount,
    },
    {
      key: "sync-mt5",
      label: "Connect MT5",
      icon: <Plug size={16} />,
      action: handlers.onSyncMt5,
    },
    {
      key: "import",
      label: "Import Excel",
      icon: <FileSpreadsheet size={16} />,
      action: handlers.onImport,
    },
    {
      key: "export",
      label: "Export Excel",
      icon: <Download size={16} />,
      action: handlers.onExport,
    },
    {
      key: "cash",
      label: "Cash Movement",
      icon: <Wallet size={16} />,
      action: handlers.onCash,
    },
    {
      key: "check",
      label: "Pre-Trade Check",
      icon: <ShieldCheck size={16} />,
      action: handlers.onCheck,
    },
    {
      key: "calc",
      label: "Compounding",
      icon: <LineChart size={16} />,
      action: handlers.onCalc,
    },
    {
      key: "position-calc",
      label: "Position Calculator",
      icon: <Calculator size={16} />,
      view: "position-calc",
      comingSoon: true,
    },
    {
      key: "analytics",
      label: "Analytics",
      icon: <BarChart3 size={16} />,
      view: "analytics",
      comingSoon: true,
    },
    {
      key: "trading-coach",
      label: "Trading Coach",
      icon: <Sparkles size={16} />,
      view: "trading-coach",
      comingSoon: true,
    },
    {
      key: "mindset-coach",
      label: "Mindset Coach",
      icon: <Brain size={16} />,
      view: "mindset-coach",
      comingSoon: true,
    },
    {
      key: "pre-market",
      label: "Pre-Market Briefing",
      icon: <Newspaper size={16} />,
      view: "pre-market",
      comingSoon: true,
    },
    {
      key: "insights",
      label: "Pattern Insights",
      icon: <Lightbulb size={16} />,
      view: "pattern-analysis",
      comingSoon: true,
    },
  ];

  const handleItemClick = (item: SidebarItem) => {
    if (item.action) {
      item.action();
    } else if (item.view) {
      setView(item.view);
    }
    setMobileOpen(false);
  };

  const widthClass = collapsed ? "lg:w-[68px]" : "lg:w-[248px]";

  return (
    <>
      {/* ===== Mobile toggle (top-left floating) ===== */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-40 w-10 h-10 rounded-lg bg-[#0D1E35] border border-white/10 text-white flex items-center justify-center"
        aria-label="Open menu"
      >
        <ChevronRight size={18} />
      </button>

      {/* ===== Mobile overlay ===== */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ===== Sidebar ===== */}
      <aside
        data-testid="app-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-40 w-[248px] ${widthClass} bg-[#070F1C] border-r border-white/10 flex flex-col transition-all duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        {/* Header */}
        <div className="px-4 py-4 border-b border-white/10 flex items-center gap-3">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663576082454/8kEKtsKWxF9JiwbjRbrvBM/utj-logo-badge-N5NDtvx9GcDyhxwM7gRvFA.webp"
            alt="Ultimate Trading Journal"
            className="w-8 h-8 rounded-lg object-contain shrink-0"
          />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="font-['Space_Grotesk'] font-semibold text-sm text-white tracking-wide leading-tight">
                ULTIMATE
              </div>
              <div className="font-mono text-[8px] text-[#4A6080] uppercase tracking-[0.15em] leading-tight">
                TRADING JOURNAL
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="hidden lg:flex w-7 h-7 rounded-md text-[#4A6080] hover:text-white hover:bg-white/5 items-center justify-center shrink-0"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Live status */}
        {!collapsed && liveSyncLabel && (
          <div className="px-4 py-2 border-b border-white/5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00897B] animate-pulse-dot" />
            <span className="font-mono text-[9px] text-[#4A6080] uppercase tracking-widest truncate">
              {liveSyncLabel}
            </span>
          </div>
        )}

        {/* Items (single flat list — no section headers) */}
        <nav className="flex-1 overflow-y-auto py-2">
          <div className="mb-3">
            <div className="px-2 flex flex-col gap-0.5">
              {items.map((item) => {
                  const isActive = item.view === view;
                  const base =
                    "group w-full flex items-center gap-3 px-2 py-2 rounded-md transition-all text-left text-[12px] font-medium";
                  const styleClass = item.primary
                    ? "bg-gradient-to-br from-[#0094C6] to-[#005377] text-white hover:from-[#00B4D8] hover:to-[#0094C6] shadow-md shadow-[#0094C6]/20"
                    : isActive
                      ? "bg-white/8 text-white"
                      : "text-[#A8B5C7] hover:bg-white/5 hover:text-white";
                  return (
                    <button
                      key={item.key}
                      data-testid={`sidebar-item-${item.key}`}
                      onClick={() => handleItemClick(item)}
                      className={`${base} ${styleClass}`}
                      title={item.comingSoon ? `${item.label} — coming soon` : item.label}
                    >
                      <span className="shrink-0 w-4 h-4 flex items-center justify-center">
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className="font-mono text-[9px] bg-[#0077B6]/30 text-[#7DD3FC] rounded-full min-w-[18px] h-4 px-1 flex items-center justify-center">
                              {item.badge}
                            </span>
                          )}
                          {item.comingSoon && (
                            <span className="font-mono text-[8px] uppercase tracking-widest text-[#4A6080]">
                              soon
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        </nav>

        {/* Footer: theme + auth */}
        <div className="border-t border-white/10 p-3 flex items-center gap-2">
          <ThemeToggle />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              {user && (
                <div className="font-mono text-[10px] text-white/80 truncate">
                  {user.name || user.email || "Signed in"}
                </div>
              )}
            </div>
          )}
          {CLERK_ENABLED && (
            <>
              <SignedIn>
                <UserButton
                  appearance={{
                    elements: { avatarBox: "w-7 h-7 ring-1 ring-white/10" },
                  }}
                  afterSignOutUrl="/"
                />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="font-mono text-[10px] uppercase tracking-widest text-[#7DD3FC] hover:text-white">
                    Sign in
                  </button>
                </SignInButton>
              </SignedOut>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
