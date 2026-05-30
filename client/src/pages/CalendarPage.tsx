/**
 * CalendarPage — month-grid view of daily P/L for a single account.
 *
 * - Account picker top-right (persisted via localStorage, same key as the
 *   Dashboard landing so the active account stays consistent across pages).
 * - Month/year selector immediately below.
 * - 6×7 calendar grid; each day cell is colored:
 *     · green (deeper as |pnl| grows) when net P/L > 0
 *     · red   (deeper as |pnl| grows) when net P/L < 0
 *     · neutral when no trades closed that day
 *   The cell shows the day number and the formatted P/L (e.g. "+3,000€").
 * - Aggregates trades from every monthly snapshot of the picked account, so
 *   a single calendar can show any month without a snapshot reload.
 */
import React, { useEffect, useMemo, useState } from "react";
void React;
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { AppSidebar, type ViewKey } from "@/components/AppSidebar";
import { useAccounts, useJournal } from "@/hooks/useJournal";
import { parseAdjustmentsJson } from "@/lib/monthlyHistory";
import type { Trade, Adjustment } from "@/lib/trading";
import { isClosedTrade } from "@/lib/trading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const LAST_ACCOUNT_KEY = "apexhub_last_account_id";

const WEEKDAY_LABELS = ["Δευ", "Τρι", "Τετ", "Πεμ", "Παρ", "Σαβ", "Κυρ"];
const MONTH_LABELS = [
  "Ιανουάριος",
  "Φεβρουάριος",
  "Μάρτιος",
  "Απρίλιος",
  "Μάιος",
  "Ιούνιος",
  "Ιούλιος",
  "Αύγουστος",
  "Σεπτέμβριος",
  "Οκτώβριος",
  "Νοέμβριος",
  "Δεκέμβριος",
];

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

function writeLastAccountId(id: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_ACCOUNT_KEY, String(id));
  } catch {
    /* ignore */
  }
}

/** Pull a JS Date out of a Trade.open or .close_time string; null if invalid. */
export function parseTradeDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Format a number as a compact signed € string. */
export function fmtEuroShort(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const formatted =
    abs >= 1000
      ? abs.toLocaleString("en-US", { maximumFractionDigits: 0 })
      : abs.toFixed(0);
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${formatted}€`;
}

/** Convert a Date to a "YYYY-MM-DD" key in local time. */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** ISO weekday index where Monday = 0 ... Sunday = 6. */
export function isoWeekdayIndex(d: Date): number {
  const w = d.getDay(); // Sun=0..Sat=6
  return (w + 6) % 7;
}

/** Build the 6×7 (=42) cells for the given month, including leading/trailing days. */
export function buildMonthCells(year: number, monthIdx: number): { date: Date; inMonth: boolean }[] {
  const first = new Date(year, monthIdx, 1);
  const startOffset = isoWeekdayIndex(first);
  const cells: { date: Date; inMonth: boolean }[] = [];
  // 42 days starting `startOffset` before the 1st.
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, monthIdx, 1 - startOffset + i);
    cells.push({ date: d, inMonth: d.getMonth() === monthIdx });
  }
  return cells;
}

/** Pick a tailwind-ish bg color based on signed pnl, scaled by `maxAbs`. */
function pnlCellBg(pnl: number, maxAbs: number): string {
  if (pnl === 0 || maxAbs <= 0) return "bg-[#0D1E35]";
  const ratio = Math.min(1, Math.abs(pnl) / maxAbs);
  // 0.10 .. 0.55 alpha range so even small days are visible.
  const alpha = 0.1 + ratio * 0.45;
  if (pnl > 0) return "";
  return "";
  // We use inline style below for the gradient — class-only would require
  // arbitrary color tokens that Tailwind can't safely tree-shake. The two
  // empty returns above keep the function shape predictable; the actual
  // background is applied via inline style at the call site.
  void alpha;
}

function pnlCellStyle(pnl: number, maxAbs: number): React.CSSProperties {
  if (pnl === 0 || maxAbs <= 0) return {};
  const ratio = Math.min(1, Math.abs(pnl) / maxAbs);
  const alpha = 0.1 + ratio * 0.5;
  const color = pnl > 0
    ? `rgba(0, 137, 123, ${alpha})` // teal/green
    : `rgba(233, 79, 55, ${alpha})`; // coral/red
  return { backgroundColor: color };
}

export default function CalendarPage() {
  const [, setLocation] = useLocation();
  const { accounts, isLoading: accountsLoading } = useAccounts();
  const [view, setView] = useState<ViewKey>("calendar");

  const [activeAccountId, setActiveAccountId] = useState<number | null>(null);
  useEffect(() => {
    if (accountsLoading) return;
    if (!accounts.length) {
      setActiveAccountId(null);
      return;
    }
    const saved = readLastAccountId();
    const exists = saved != null && accounts.some((a) => a.id === saved);
    setActiveAccountId(exists ? saved : accounts[0].id);
  }, [accounts, accountsLoading]);

  const journal = useJournal(activeAccountId);
  const monthlyHistory = journal.monthlyHistory;

  // Aggregate ALL closed trades across every month snapshot of the picked
  // account into a `dayKey -> totalPnl` map. We sum pnl + swap (commission
  // is folded into pnl by parsers).
  const dailyPnl = useMemo<Record<string, number>>(() => {
    const totals: Record<string, number> = {};
    for (const snap of monthlyHistory) {
      let trades: Trade[] = [];
      try {
        const parsed = JSON.parse(snap.trades_json);
        if (Array.isArray(parsed)) trades = parsed as Trade[];
      } catch {
        continue;
      }
      for (const t of trades) {
        if (!isClosedTrade(t)) continue;
        // Prefer close_time (when the realised P/L lands) over open.
        const d = parseTradeDate(t.close_time) ?? parseTradeDate(t.open);
        if (!d) continue;
        const k = dayKey(d);
        totals[k] = (totals[k] || 0) + (Number(t.pnl) || 0) + (Number(t.swap) || 0);
      }
      // Adjustments (deposits / withdrawals) also affect equity but are NOT
      // shown on the calendar — we only color trading days.
      const _adj: Adjustment[] = parseAdjustmentsJson(snap.adjustments_json);
      void _adj;
    }
    return totals;
  }, [monthlyHistory]);

  // Determine which month/year to show. Default to the most recent month
  // that has snapshots, otherwise the current real month.
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState<number>(today.getFullYear());
  const [monthIdx, setMonthIdx] = useState<number>(today.getMonth());
  useEffect(() => {
    // Snap to the latest snapshot once data is available, but only on first
    // load (don't fight the user's manual selection).
    if (monthlyHistory.length === 0) return;
    const top = monthlyHistory[0];
    const mIdx = MONTH_LABELS.findIndex(
      (m) => m.toUpperCase() === (top.month_name || "").toUpperCase(),
    );
    const yr = parseInt(top.year_full || "", 10);
    if (mIdx >= 0 && yr > 0) {
      setYear(yr);
      setMonthIdx(mIdx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccountId]);

  const cells = useMemo(() => buildMonthCells(year, monthIdx), [year, monthIdx]);

  // Compute max absolute P/L for the visible month so we can scale opacity.
  const maxAbs = useMemo(() => {
    let max = 0;
    for (const c of cells) {
      if (!c.inMonth) continue;
      const v = dailyPnl[dayKey(c.date)] || 0;
      if (Math.abs(v) > max) max = Math.abs(v);
    }
    return max;
  }, [cells, dailyPnl]);

  // Monthly aggregate (only days inside the visible month).
  const monthSummary = useMemo(() => {
    let total = 0;
    let greenDays = 0;
    let redDays = 0;
    for (const c of cells) {
      if (!c.inMonth) continue;
      const v = dailyPnl[dayKey(c.date)];
      if (v === undefined) continue;
      total += v;
      if (v > 0) greenDays++;
      else if (v < 0) redDays++;
    }
    return { total, greenDays, redDays };
  }, [cells, dailyPnl]);

  function gotoPrevMonth() {
    if (monthIdx === 0) {
      setMonthIdx(11);
      setYear((y) => y - 1);
    } else {
      setMonthIdx((m) => m - 1);
    }
  }
  function gotoNextMonth() {
    if (monthIdx === 11) {
      setMonthIdx(0);
      setYear((y) => y + 1);
    } else {
      setMonthIdx((m) => m + 1);
    }
  }

  function onSetView(v: ViewKey) {
    if (v === "calendar") return; // already here
    if (v === "dashboard") {
      setLocation("/dashboard");
      return;
    }
    if (v === "accounts") {
      setLocation("/accounts");
      return;
    }
    toast.info("Σύντομα διαθέσιμο");
  }

  function openAction(action: string) {
    if (!activeAccountId) {
      toast.info("Δημιούργησε πρώτα έναν λογαριασμό");
      setLocation("/accounts");
      return;
    }
    setLocation(`/account/${activeAccountId}?action=${action}`);
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

  return (
    <div className="min-h-screen bg-[#0A1628] flex">
      <AppSidebar
        view={view}
        setView={onSetView}
        handlers={sidebarHandlers}
        accountsCount={accounts.length}
      />
      <div className="flex-1 lg:ml-[248px]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0F766E] to-[#134E4A] flex items-center justify-center">
                <CalendarDays size={22} className="text-white" />
              </div>
              <div>
                <h1 className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight text-white">
                  Calendar
                </h1>
                <p className="font-mono text-[11px] text-[#6E8AA8] uppercase tracking-widest">
                  Ημερήσιο P/L view ανά λογαριασμό
                </p>
              </div>
            </div>
            {accounts.length > 0 && (
              <Select
                value={activeAccountId ? String(activeAccountId) : undefined}
                onValueChange={(v) => {
                  const id = Number(v);
                  if (Number.isFinite(id) && id > 0) {
                    setActiveAccountId(id);
                    writeLastAccountId(id);
                  }
                }}
              >
                <SelectTrigger
                  className="h-9 w-[260px] bg-[#0D1E35] border-white/10 text-white font-mono text-xs"
                  data-testid="calendar-account-picker"
                >
                  <SelectValue placeholder="Διάλεξε λογαριασμό" />
                </SelectTrigger>
                <SelectContent className="bg-[#0D1E35] border-white/10 text-white">
                  {accounts.map((a) => (
                    <SelectItem
                      key={a.id}
                      value={String(a.id)}
                      className="font-mono text-xs"
                    >
                      {a.name}
                      <span className="text-[#6E8AA8] ml-2">· {a.accountType}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Month switcher + summary */}
          <div className="flex items-center justify-between gap-4 flex-wrap bg-[#0D1E35]/80 border border-white/8 rounded-2xl px-5 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={gotoPrevMonth}
                className="w-9 h-9 rounded-lg border border-white/10 hover:border-white/30 hover:bg-white/5 flex items-center justify-center text-white"
                data-testid="calendar-prev-month"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="font-['Space_Grotesk'] text-xl font-semibold text-white min-w-[200px] text-center">
                {MONTH_LABELS[monthIdx]} {year}
              </div>
              <button
                onClick={gotoNextMonth}
                className="w-9 h-9 rounded-lg border border-white/10 hover:border-white/30 hover:bg-white/5 flex items-center justify-center text-white"
                data-testid="calendar-next-month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="flex items-center gap-6 font-mono text-[11px] text-[#A8B5C7]">
              <div>
                <span className="text-[#6E8AA8] uppercase tracking-widest mr-2">Total</span>
                <span
                  className={`font-bold ${
                    monthSummary.total > 0
                      ? "text-[#00897B]"
                      : monthSummary.total < 0
                        ? "text-[#E94F37]"
                        : "text-white"
                  }`}
                  data-testid="calendar-month-total"
                >
                  {fmtEuroShort(monthSummary.total)}
                </span>
              </div>
              <div>
                <span className="text-[#6E8AA8] uppercase tracking-widest mr-2">Green</span>
                <span className="text-[#00897B] font-bold">{monthSummary.greenDays}</span>
              </div>
              <div>
                <span className="text-[#6E8AA8] uppercase tracking-widest mr-2">Red</span>
                <span className="text-[#E94F37] font-bold">{monthSummary.redDays}</span>
              </div>
            </div>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-2">
            {WEEKDAY_LABELS.map((w) => (
              <div
                key={w}
                className="font-mono text-[10px] uppercase tracking-widest text-[#6E8AA8] text-center"
              >
                {w}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div
            className="grid grid-cols-7 gap-2"
            data-testid="calendar-grid"
          >
            {cells.map((c, i) => {
              const k = dayKey(c.date);
              const pnl = dailyPnl[k];
              const has = pnl !== undefined && c.inMonth;
              const isPos = has && pnl > 0;
              const isNeg = has && pnl < 0;
              return (
                <div
                  key={i}
                  data-testid={`calendar-cell-${k}`}
                  className={`relative aspect-square rounded-xl border transition-all ${
                    c.inMonth
                      ? "border-white/8"
                      : "border-white/4 opacity-40"
                  } ${has ? "border-white/15" : ""} flex flex-col p-2`}
                  style={has && c.inMonth ? pnlCellStyle(pnl, maxAbs) : undefined}
                >
                  <div
                    className={`font-mono text-[11px] ${
                      c.inMonth ? "text-white/80" : "text-white/30"
                    }`}
                  >
                    {c.date.getDate()}
                  </div>
                  {has && (
                    <div className="flex-1 flex items-center justify-center">
                      <div
                        className={`font-mono font-bold text-[12px] sm:text-[13px] ${
                          isPos ? "text-white" : isNeg ? "text-white" : "text-[#A8B5C7]"
                        }`}
                      >
                        {fmtEuroShort(pnl!)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {monthlyHistory.length === 0 && !journal.isLoading && activeAccountId && (
            <div className="text-center py-10 font-mono text-xs text-[#6E8AA8]">
              Δεν υπάρχουν ακόμα μήνες για αυτόν τον λογαριασμό. Δημιούργησε ένα μήνα πρώτα.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
