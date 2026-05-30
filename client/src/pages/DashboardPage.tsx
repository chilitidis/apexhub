/**
 * DashboardPage — top-level route component for `/` and `/dashboard`.
 *
 * Renders the new shortcut-grid landing inside the same shell (sidebar +
 * main content) used by the per-account dashboard, so navigation feels
 * uniform across views.
 *
 * Action shortcuts (Add Trade, Sync MT5, Cash, Pre-Trade Check, etc.)
 * require an active account context. Since this page is intentionally
 * account-agnostic, those tiles redirect the user to Accounts Overview
 * with a toast prompting them to pick an account first.
 */
import React, { useState } from "react";
void React;
import { useLocation } from "wouter";
import { toast } from "sonner";
import { AppSidebar, type ViewKey } from "@/components/AppSidebar";
import { DashboardLanding, type DashboardHandlers } from "./DashboardLanding";
import { useAccounts } from "@/hooks/useJournal";

const ACCOUNT_REQUIRED_MSG = "Επίλεξε πρώτα έναν λογαριασμό για να συνεχίσεις";

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { accounts } = useAccounts();
  // Local view state lets the user navigate between Dashboard landing and
  // Accounts Overview without losing the sidebar shell. Other view keys are
  // routed elsewhere (e.g. coming-soon toasts).
  const [view, setView] = useState<ViewKey>("dashboard");

  function pickAccountFirst() {
    toast.info(ACCOUNT_REQUIRED_MSG);
    setLocation("/accounts");
  }

  function onSetView(v: ViewKey) {
    if (v === "dashboard") {
      setView("dashboard");
      setLocation("/dashboard");
      return;
    }
    if (v === "accounts") {
      // Accounts Overview is its own page so it can manage account state.
      setLocation("/accounts");
      return;
    }
    // All remaining items in this version are Coming Soon: toast and stay on
    // the current page so the user still has the sidebar visible.
    toast.info("Σύντομα διαθέσιμο");
  }

  const handlers: DashboardHandlers = {
    onAddTrade: pickAccountFirst,
    onNewMonth: pickAccountFirst,
    onImport: pickAccountFirst,
    onSyncMt5: pickAccountFirst,
    onCheck: pickAccountFirst,
    onCash: pickAccountFirst,
    onWhatIf: pickAccountFirst,
    onExport: pickAccountFirst,
    onAccountsOverview: () => setLocation("/accounts"),
    onComingSoon: (label) => toast.info(`${label}: σύντομα διαθέσιμο`),
  };

  return (
    <div className="min-h-screen bg-[#0A1628] flex">
      <AppSidebar
        view={view}
        setView={onSetView}
        handlers={{
          onAddTrade: pickAccountFirst,
          onNewMonth: pickAccountFirst,
          onImport: pickAccountFirst,
          onSyncMt5: pickAccountFirst,
          onCheck: pickAccountFirst,
          onCash: pickAccountFirst,
          onCalc: pickAccountFirst,
          onExport: pickAccountFirst,
        }}
        accountsCount={accounts.length}
      />
      <div className="flex-1 lg:ml-[248px]">
        <DashboardLanding handlers={handlers} />
      </div>
    </div>
  );
}
