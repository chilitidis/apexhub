/**
 * DashboardPage — top-level route component for `/` and `/dashboard`.
 *
 * Renders the new shortcut-grid landing inside the same shell (sidebar +
 * main content) used by the per-account dashboard.
 *
 * Active account picker:
 *   - Top-right of the landing shows a Select with all of the user's
 *     accounts. The pick is persisted in localStorage under
 *     `apexhub_last_account_id` so we remember it across reloads.
 *   - When a tile is clicked, instead of bouncing to Accounts Overview, we
 *     navigate to `/account/:id?action=<key>` so the account dashboard can
 *     auto-open the matching modal on mount (Home.tsx handles the param).
 *   - If the user has no accounts at all, we still toast and send them to
 *     Accounts Overview so they can create one first.
 */
import React, { useEffect, useMemo, useState } from "react";
void React;
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppSidebar, type ViewKey } from "@/components/AppSidebar";
import { DashboardLanding, type DashboardHandlers } from "./DashboardLanding";
import { useAccounts, type TradingAccount } from "@/hooks/useJournal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LAST_ACCOUNT_KEY = "apexhub_last_account_id";

function readLastAccountId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_ACCOUNT_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeLastAccountId(id: number | null) {
  if (typeof window === "undefined") return;
  try {
    if (id == null) window.localStorage.removeItem(LAST_ACCOUNT_KEY);
    else window.localStorage.setItem(LAST_ACCOUNT_KEY, String(id));
  } catch {
    /* ignore quota / privacy mode */
  }
}

export default function DashboardPage() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const { accounts, isLoading } = useAccounts();
  const [view, setView] = useState<ViewKey>("dashboard");

  // Resolve the active account: prefer persisted id, fall back to first.
  const [activeAccountId, setActiveAccountId] = useState<number | null>(null);
  useEffect(() => {
    if (isLoading) return;
    if (!accounts.length) {
      setActiveAccountId(null);
      return;
    }
    const saved = readLastAccountId();
    const exists = saved != null && accounts.some((a) => a.id === saved);
    setActiveAccountId(exists ? saved : accounts[0].id);
  }, [accounts, isLoading]);

  const activeAccount: TradingAccount | null = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) ?? null,
    [accounts, activeAccountId],
  );

  function onPickAccount(idStr: string) {
    const id = Number(idStr);
    if (!Number.isFinite(id) || id <= 0) return;
    setActiveAccountId(id);
    writeLastAccountId(id);
  }

  /**
   * Navigate to the account dashboard with an `action` query param so that
   * Home.tsx can auto-open the corresponding modal on mount. If the user has
   * no accounts at all, toast and route to Accounts Overview to create one.
   */
  function openActionForActiveAccount(action: string) {
    if (!activeAccount) {
      toast.info(t("dp.noAccounts"));
      setLocation("/accounts");
      return;
    }
    writeLastAccountId(activeAccount.id);
    setLocation(`/account/${activeAccount.id}?action=${action}`);
  }

  function onSetView(v: ViewKey) {
    if (v === "dashboard") {
      setView("dashboard");
      setLocation("/dashboard");
      return;
    }
    if (v === "accounts") {
      setLocation("/accounts");
      return;
    }
    if (v === "calendar") {
      setLocation("/calendar");
      return;
    }
    if (v === "position-calc") {
      setLocation("/position-calculator");
      return;
    }
    if (v === "trading-coach") {
      setLocation("/trading-coach");
      return;
    }
    if (v === "prop-firm") {
      setLocation("/prop-firm-tracker");
      return;
    }
    if (v === "pattern-analysis") {
      openActionForActiveAccount("pattern-analysis");
      return;
    }
    if (v === "pre-market") {
      openActionForActiveAccount("pre-market");
      return;
    }
    if (v === "market-news") {
      openActionForActiveAccount("market-news");
      return;
    }
    if (v === "mindset-coach") {
      openActionForActiveAccount("mindset-coach");
      return;
    }
    toast.info(t("dp.comingSoon"));
  }

  const handlers: DashboardHandlers = {
    onAddTrade: () => openActionForActiveAccount("add-trade"),
    onNewMonth: () => openActionForActiveAccount("new-month"),
    onImport: () => openActionForActiveAccount("import"),
    onSyncMt5: () => openActionForActiveAccount("sync-mt5"),
    onCheck: () => openActionForActiveAccount("check"),
    onCash: () => openActionForActiveAccount("cash"),
    onWhatIf: () => openActionForActiveAccount("what-if"),
    onExport: () => openActionForActiveAccount("export"),
    onAccountsOverview: () => setLocation("/accounts"),
    onPatternAnalysis: () => openActionForActiveAccount("pattern-analysis"),
    onPreMarketBriefing: () => openActionForActiveAccount("pre-market"),
    onMarketNews: () => openActionForActiveAccount("market-news"),
    onMindsetCoach: () => openActionForActiveAccount("mindset-coach"),
    onTradingCoach: () => setLocation("/trading-coach"),
    onPropFirm: () => setLocation("/prop-firm-tracker"),
    onComingSoon: (label) => {
      // Calendar and Position Calculator are now real — short-circuit them.
      if (label === "Calendar") {
        setLocation("/calendar");
        return;
      }
      if (label === "Position Calculator") {
        setLocation("/position-calculator");
        return;
      }
      toast.info(`${label}: ${t("dp.comingSoonSuffix")}`);
    },
  };

  // Sidebar handlers also need to fire actions against the active account.
  const sidebarHandlers = {
    onAddTrade: () => openActionForActiveAccount("add-trade"),
    onNewMonth: () => openActionForActiveAccount("new-month"),
    onImport: () => openActionForActiveAccount("import"),
    onSyncMt5: () => openActionForActiveAccount("sync-mt5"),
    onCheck: () => openActionForActiveAccount("check"),
    onCash: () => openActionForActiveAccount("cash"),
    onCalc: () => openActionForActiveAccount("what-if"),
    onExport: () => openActionForActiveAccount("export"),
  };

  return (
    <div className="min-h-screen xl:h-screen xl:overflow-hidden bg-[#0A1628] flex">
      <AppSidebar
        view={view}
        setView={onSetView}
        handlers={sidebarHandlers}
        accountsCount={accounts.length}
      />
      <div className="flex-1 lg:ml-[248px] min-h-screen xl:h-screen flex flex-col xl:overflow-hidden">
        {/* Account picker row — the ACTIVE ACCOUNT label was removed to save
            vertical space so the whole dashboard fits without scrolling. The
            picker is pushed a bit lower and right-aligned. */}
        <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 shrink-0">
          <div className="flex items-center justify-end gap-4 flex-wrap">
            {accounts.length > 0 ? (
              <div className="flex items-center gap-3">
                {activeAccount && (
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: activeAccount.color || "#0077B6" }}
                  />
                )}
                <Select
                  value={activeAccountId ? String(activeAccountId) : undefined}
                  onValueChange={onPickAccount}
                >
                  <SelectTrigger
                    className="h-9 w-[260px] bg-[#0D1E35] border-white/10 text-white font-mono text-xs"
                    data-testid="dashboard-account-picker"
                  >
                    <SelectValue placeholder={t("dp.pickAccount")} />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0D1E35] border-white/10 text-white">
                    {accounts.map((a) => (
                      <SelectItem
                        key={a.id}
                        value={String(a.id)}
                        className="font-mono text-xs"
                      >
                        {a.name}
                        <span className="text-[#6E8AA8] ml-2">
                          · {a.accountType}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <button
                onClick={() => setLocation("/accounts")}
                className="font-mono text-xs text-[#0094C6] underline-offset-2 hover:underline"
              >
                {t("dp.createFirst")}
              </button>
            )}
          </div>
        </div>

        <DashboardLanding handlers={handlers} />
      </div>
    </div>
  );
}
