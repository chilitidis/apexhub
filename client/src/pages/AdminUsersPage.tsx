/**
 * AdminUsersPage — admin-only roster of every registered user and their
 * subscription status. Reachable at /admin and visible in the sidebar only
 * when the current user is an admin (owner). The backend `admin.listUsers`
 * procedure is gated by `adminProcedure` (FORBIDDEN for non-admins), so this
 * page degrades gracefully (redirect) if a non-admin somehow lands here.
 *
 * Shell mirrors PositionCalculator / TradingCoachPage (AppSidebar + Ocean
 * Depth header).
 */
import React, { useMemo, useState, useEffect } from "react";
void React;
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  ShieldAlert,
  Users,
  Search,
  Loader2,
  RefreshCw,
  Crown,
} from "lucide-react";
import { AppSidebar, type ViewKey } from "@/components/AppSidebar";
import { useAccounts } from "@/hooks/useJournal";
import { useSubscription } from "@/hooks/useSubscription";
import { trpc } from "@/lib/trpc";

// --- status visuals -----------------------------------------------------------

function statusMeta(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case "active":
      return { label: "Active", color: "#00C896", bg: "rgba(0,137,123,0.15)" };
    case "trialing":
      return { label: "Trial", color: "#F4A261", bg: "rgba(244,162,97,0.15)" };
    case "canceled":
      return { label: "Canceled", color: "#E94F37", bg: "rgba(233,79,55,0.15)" };
    case "past_due":
    case "unpaid":
      return { label: status, color: "#E94F37", bg: "rgba(233,79,55,0.15)" };
    default:
      return { label: "No plan", color: "#6E8AA8", bg: "rgba(110,138,168,0.12)" };
  }
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type StatusFilter = "all" | "active" | "trialing" | "noPlan";

/**
 * A neutral/white accent must follow the theme foreground so the number stays
 * visible in both light and dark mode. Colored accents are kept as-is.
 * Exported for unit testing.
 */
export function isNeutralAccent(accent: string): boolean {
  const a = accent.trim().toUpperCase();
  return a === "#FFFFFF" || a === "#FFF" || a === "WHITE";
}

function StatCard({
  label,
  value,
  accent,
  active,
  onClick,
}: {
  label: string;
  value: number;
  accent: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const isNeutral = isNeutralAccent(accent);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left bg-[#0D1E35]/80 border rounded-xl px-4 py-3 backdrop-blur-sm transition-colors ${
        active
          ? "border-[#0077B6] ring-1 ring-[#0077B6]/40"
          : "border-white/8 hover:border-white/20"
      }`}
    >
      <div className="font-mono text-[10px] uppercase tracking-widest text-[#6E8AA8]">
        {label}
      </div>
      <div
        className={`font-['Space_Grotesk'] text-2xl font-semibold mt-1 ${
          isNeutral ? "text-foreground" : ""
        }`}
        style={isNeutral ? undefined : { color: accent }}
      >
        {value}
      </div>
    </button>
  );
}

export default function AdminUsersPage() {
  const [, setLocation] = useLocation();
  const { accounts } = useAccounts();
  const [view] = useState<ViewKey>("dashboard");
  const { isAdmin, loading: subLoading } = useSubscription();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const query = trpc.admin.listUsers.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Non-admins should never see this page. Once we know the user is not an
  // admin, send them back to the dashboard.
  useEffect(() => {
    if (!subLoading && !isAdmin) {
      setLocation("/dashboard");
    }
  }, [subLoading, isAdmin, setLocation]);

  // ---- sidebar shell wiring (standalone page) ----
  function onSetView(v: ViewKey) {
    if (v === "dashboard") return setLocation("/dashboard");
    if (v === "accounts") return setLocation("/accounts");
    if (v === "calendar") return setLocation("/calendar");
    if (v === "position-calc") return setLocation("/position-calculator");
    if (v === "trading-coach") return setLocation("/trading-coach");
    if (
      v === "pattern-analysis" ||
      v === "pre-market" ||
      v === "market-news" ||
      v === "mindset-coach"
    )
      return openAction(v);
    toast.info("Σύντομα διαθέσιμο");
  }
  function openAction(action: string) {
    const id = accounts[0]?.id;
    if (!id) {
      toast.info("Δημιούργησε πρώτα έναν λογαριασμό");
      return setLocation("/accounts");
    }
    setLocation(`/account/${id}?action=${action}`);
  }
  const sidebarHandlers = {
    onAddTrade: () => openAction("add-trade"),
    onNewMonth: () => openAction("new-month"),
    onImport: () => openAction("import"),
    onSyncMt5: () => openAction("sync-mt5"),
    onCheck: () => openAction("check"),
    onCash: () => openAction("cash"),
    onCalc: () => openAction("what-if"),
    onExport: () => openAction("export"),
  };

  const data = query.data;
  const filtered = useMemo(() => {
    const list = data?.users ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((u) => {
      // status filter
      if (statusFilter !== "all") {
        const s = u.subscriptionStatus;
        if (statusFilter === "active" && s !== "active") return false;
        if (statusFilter === "trialing" && s !== "trialing") return false;
        if (
          statusFilter === "noPlan" &&
          (s === "active" || s === "trialing")
        )
          return false;
      }
      // text search
      if (q) {
        const name = (u.name ?? "").toLowerCase();
        const email = (u.email ?? "").toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });
  }, [data, search, statusFilter]);

  const totals = data?.totals;

  return (
    <div className="min-h-screen bg-[#0A1628] flex overflow-x-hidden">
      <AppSidebar
        view={view}
        setView={onSetView}
        handlers={sidebarHandlers}
        accountsCount={accounts.length}
      />
      <div className="flex-1 lg:ml-[248px] min-w-0">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0077B6] to-[#023E8A] flex items-center justify-center">
                <ShieldAlert size={22} className="text-white" />
              </div>
              <div>
                <h1 className="font-['Space_Grotesk'] text-2xl font-semibold text-white leading-tight">
                  Admin Panel
                </h1>
                <p className="font-mono text-[11px] text-[#6E8AA8] uppercase tracking-wider">
                  Εγγεγραμμένοι χρήστες · κατάσταση συνδρομής
                </p>
              </div>
            </div>
            <button
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0D1E35] border border-white/10 text-[#A8B5C7] hover:text-white hover:border-white/20 transition-colors font-mono text-[11px] uppercase tracking-widest disabled:opacity-50"
            >
              {query.isFetching ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Refresh
            </button>
          </div>

          {/* Totals — clickable, each toggles the matching status filter */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Registered (unique)"
              value={totals?.registered ?? 0}
              accent="#FFFFFF"
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            />
            <StatCard
              label="Trialing"
              value={totals?.trialing ?? 0}
              accent="#F4A261"
              active={statusFilter === "trialing"}
              onClick={() =>
                setStatusFilter((p) => (p === "trialing" ? "all" : "trialing"))
              }
            />
            <StatCard
              label="Active"
              value={totals?.active ?? 0}
              accent="#00C896"
              active={statusFilter === "active"}
              onClick={() =>
                setStatusFilter((p) => (p === "active" ? "all" : "active"))
              }
            />
            <StatCard
              label="No plan"
              value={totals?.noPlan ?? 0}
              accent="#6E8AA8"
              active={statusFilter === "noPlan"}
              onClick={() =>
                setStatusFilter((p) => (p === "noPlan" ? "all" : "noPlan"))
              }
            />
          </div>
          {(totals?.merged ?? 0) > 0 && (
            <p className="font-mono text-[10px] text-[#6E8AA8]">
              {totals?.merged} χρήστ{(totals?.merged ?? 0) === 1 ? "ης" : "ες"} με πολλαπλές
              εγγραφές (π.χ. Google + Clerk) εμφανίζονται ενοποιημένοι σε μία γραμμή.
            </p>
          )}

          {/* Search + status filter pills */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative max-w-md w-full sm:w-auto sm:min-w-[320px]">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6E8AA8]"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Αναζήτηση με όνομα ή email…"
                className="w-full bg-[#0A1628] border border-white/10 rounded-lg pl-9 pr-3 py-2.5 font-mono text-sm text-white placeholder:text-[#4A6080] focus:outline-none focus:border-[#0077B6] transition-colors"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap" data-testid="admin-status-filter">
              {([
                { key: "all", label: "All", color: "#A8B5C7" },
                { key: "active", label: "Active", color: "#00C896" },
                { key: "trialing", label: "Trial", color: "#F4A261" },
                { key: "noPlan", label: "No plan", color: "#6E8AA8" },
              ] as { key: StatusFilter; label: string; color: string }[]).map(
                (f) => {
                  const on = statusFilter === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setStatusFilter(f.key)}
                      className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full border transition-colors ${
                        on
                          ? "border-transparent text-[#0A1628]"
                          : "border-white/10 text-[#A8B5C7] hover:border-white/25"
                      }`}
                      style={on ? { background: f.color } : undefined}
                    >
                      {f.label}
                    </button>
                  );
                },
              )}
            </div>
          </div>

          {/* Body */}
          <div className="bg-[#0D1E35]/80 border border-white/8 rounded-2xl backdrop-blur-sm overflow-hidden">
            {query.isLoading ? (
              <div className="flex items-center justify-center py-20 gap-3 text-[#6E8AA8]">
                <Loader2 size={18} className="animate-spin" />
                <span className="font-mono text-xs uppercase tracking-widest">
                  Φόρτωση χρηστών…
                </span>
              </div>
            ) : query.isError ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-center px-6">
                <ShieldAlert size={28} className="text-[#E94F37]" />
                <div className="font-['Space_Grotesk'] text-white font-semibold">
                  Δεν ήταν δυνατή η φόρτωση
                </div>
                <div className="font-mono text-[11px] text-[#6E8AA8]">
                  {query.error?.message ?? "Πρόσβαση μόνο για διαχειριστές."}
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-center px-6">
                <Users size={28} className="text-[#6E8AA8]" />
                <div className="font-['Space_Grotesk'] text-white font-semibold">
                  Κανένας χρήστης
                </div>
                <div className="font-mono text-[11px] text-[#6E8AA8]">
                  {search ? "Δεν βρέθηκε χρήστης για αυτή την αναζήτηση." : "Δεν υπάρχουν εγγεγραμμένοι χρήστες."}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead>
                    <tr className="border-b border-white/10">
                      {[
                        "Name",
                        "Email",
                        "Login",
                        "Role",
                        "Registered",
                        "Last sign-in",
                        "Subscription",
                        "Trial / Period end",
                      ].map((h) => (
                        <th
                          key={h}
                          className="font-mono text-[9px] uppercase tracking-widest text-[#6E8AA8] px-4 py-3 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => {
                      const meta = statusMeta(u.subscriptionStatus);
                      const periodEnd =
                        u.subscriptionStatus === "trialing"
                          ? u.trialEnd
                          : u.currentPeriodEnd;
                      return (
                        <tr
                          key={u.id}
                          className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {u.role === "admin" && (
                                <Crown size={13} className="text-[#F4A261] shrink-0" />
                              )}
                              <span className="text-white text-[13px] font-medium">
                                {u.name || "—"}
                              </span>
                              {u.accountCount > 1 && (
                                <span
                                  title={`Ενοποιημένες εγγραφές: ${u.loginMethods.join(", ")} (ids: ${u.mergedIds.join(", ")})`}
                                  className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#0077B6]/20 text-[#4CA8E0] shrink-0"
                                >
                                  ×{u.accountCount}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-[12px] text-[#A8B5C7]">
                            {u.email || "—"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-[#6E8AA8]">
                            {u.loginMethod || "—"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`font-mono text-[10px] uppercase tracking-wider ${
                                u.role === "admin" ? "text-[#F4A261]" : "text-[#6E8AA8]"
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-[#A8B5C7]">
                            {fmtDate(u.createdAt)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-[#A8B5C7]">
                            {fmtDate(u.lastSignedIn)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className="inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded-full"
                              style={{ color: meta.color, background: meta.bg }}
                            >
                              {meta.label}
                              {u.cancelAtPeriodEnd && u.subscriptionStatus === "active" && (
                                <span className="ml-1 text-[#E94F37] normal-case">(cancels)</span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-[#A8B5C7]">
                            {fmtDate(periodEnd)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
