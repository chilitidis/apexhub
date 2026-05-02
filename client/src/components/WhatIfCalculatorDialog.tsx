/**
 * What-If / Risk Calculator Dialog (Round 9)
 * ==========================================
 *
 * Replays a list of closed trades against a hypothetical starting capital
 * and per-trade risk %, expressed in R-multiples (entry → SL distance).
 *
 * UX:
 *  - Capital preset chips (1k / 10k / 50k / 100k) + custom number input
 *  - Risk % preset chips (1% / 3% / 5% / 10%) + custom slider
 *  - Scope: This month / All time
 *  - Compound toggle (recompute risk_in_money from running balance each trade)
 *  - Results: Final balance, Total P/L (€ + %), Win rate, Best, Worst, MaxDD
 *  - Mini equity sparkline (Recharts AreaChart)
 *  - Multi-scenario comparison grid (capitals × risk %s)
 *
 * Pure presentational shell — all math goes through `lib/whatIf.ts`.
 */
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator,
  Check,
  ChevronDown,
  DollarSign,
  Euro,
  Layers,
  Percent,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Trade } from "@/lib/trading";
import { fmtPct } from "@/lib/trading";
import { simulate, simulateGrid } from "@/lib/whatIf";
import { useTheme } from "@/contexts/ThemeContext";
import {
  allTimeRange,
  compareMonthKeys,
  filterTradesByMonthRange,
  multiMonthRange,
  shortMonthLabel,
  singleMonthRange,
  type ScopeMonth,
  type ScopeRange,
} from "@/lib/whatIfScope";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Trades from the currently selected month. */
  monthTrades: Trade[];
  /** Trades aggregated across all saved months (chronological). */
  allTimeTrades: Trade[];
  /** Greek month label of the current view, e.g. "ΑΠΡΙΛΙΟΣ 2026". */
  monthLabel: string;
  /** Catalogue of every month present in monthlyHistory + the live month. */
  scopeMonths: ScopeMonth[];
  /** Month key ("YYYY-MM") of the currently displayed month. */
  currentKey: string;
}

const CAPITAL_PRESETS = [1_000, 10_000, 50_000, 100_000];
const RISK_PRESETS = [1, 3, 5, 10];

const COMPARE_CAPITALS = [10_000, 50_000, 100_000];
const COMPARE_RISKS = [1, 2, 5];

export default function WhatIfCalculatorDialog({
  open,
  onClose,
  monthTrades,
  allTimeTrades,
  monthLabel,
  scopeMonths,
  currentKey,
}: Props) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  // Theme-aware tokens used in inline-styled regions (hero, recharts tooltip,
  // compare table) where the global .light overrides in index.css can’t reach.
  const heroBg = isLight
    ? "linear-gradient(135deg, #FFFFFF 0%, #F1F5FB 100%)"
    : "linear-gradient(135deg, #0D1E35 0%, #0A1628 100%)";
  const heroNumberColor = isLight ? "#0A1628" : "#FFFFFF";
  const tooltipBg = isLight ? "#FFFFFF" : "#0A1628";
  const tooltipBorder = isLight
    ? "1px solid rgba(10,22,40,0.12)"
    : "1px solid rgba(255,255,255,0.1)";

  const [capital, setCapital] = useState(10_000);
  const [riskPct, setRiskPct] = useState(3);
  const [compound, setCompound] = useState(false);
  const [currency, setCurrency] = useState<"EUR" | "USD">("EUR");

  // Sorted month catalogue (newest → oldest) used by the picker UI.
  const sortedMonths = useMemo(
    () =>
      [...scopeMonths].sort((a, b) => compareMonthKeys(b.key, a.key)),
    [scopeMonths],
  );

  const findMonth = useCallback(
    (key: string) => sortedMonths.find((m) => m.key === key) ?? null,
    [sortedMonths],
  );

  // Default scope = the currently displayed month, or the latest one we know.
  const defaultRange = useMemo<ScopeRange>(() => {
    const cur = findMonth(currentKey) ?? sortedMonths[0] ?? null;
    return cur ? singleMonthRange(cur) : allTimeRange(sortedMonths);
  }, [findMonth, currentKey, sortedMonths]);

  const [range, setRange] = useState<ScopeRange>(defaultRange);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"single" | "range" | "all">(
    "single",
  );
  const [draftFrom, setDraftFrom] = useState<string>("");
  const [draftTo, setDraftTo] = useState<string>("");

  // Reset to sensible defaults each time the dialog opens.
  useEffect(() => {
    if (open) {
      setCapital(10_000);
      setRiskPct(3);
      setCompound(false);
      setCurrency("EUR");
      setRange(defaultRange);
      setPickerOpen(false);
      setPickerMode("single");
      setDraftFrom(defaultRange.fromKey);
      setDraftTo(defaultRange.toKey);
    }
  }, [open, defaultRange]);

  const ccySymbol = currency === "EUR" ? "\u20ac" : "$";
  const ccyLabel = currency === "EUR" ? "EUR" : "USD";
  const fmtMoney = (n: number) =>
    ccySymbol +
    Math.round(n).toLocaleString("el-GR", { maximumFractionDigits: 0 });

  // Derive the active trades from the range. We always slice from the
  // chronologically-aggregated `allTimeTrades` so a single-month selection
  // and an explicit ALL TIME share the exact same code path.
  const trades = useMemo(() => {
    // Special case: a single-month range that matches the currently displayed
    // month uses `monthTrades` directly so the user sees the exact same
    // numbers as the month sidebar (avoids drift from de-dup edge cases).
    if (
      range.fromKey &&
      range.fromKey === range.toKey &&
      range.fromKey === currentKey &&
      monthTrades.length > 0
    ) {
      return monthTrades;
    }
    return filterTradesByMonthRange(allTimeTrades, range.fromKey, range.toKey);
  }, [range, allTimeTrades, monthTrades, currentKey]);

  const result = useMemo(
    () => simulate(trades, { capital, riskPct, compound }),
    [trades, capital, riskPct, compound],
  );

  const equityData = useMemo(
    () =>
      result.equity.map((v, i) => ({
        idx: i,
        balance: v,
      })),
    [result.equity],
  );

  const grid = useMemo(
    () => simulateGrid(trades, COMPARE_CAPITALS, COMPARE_RISKS, compound),
    [trades, compound],
  );

  if (!open) return null;

  const profitColor = result.totalPnl >= 0 ? "#00897B" : "#E94F37";
  const totalPctSign = result.totalPct >= 0 ? "+" : "";

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-40"
        onClick={onClose}
      />
      <motion.div
        key="panel"
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-6 overflow-y-auto overscroll-contain pointer-events-none"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto bg-[#0A1628] border border-white/10 rounded-2xl w-full max-w-[1100px] my-2 sm:my-4 shadow-2xl shadow-black/40 overflow-hidden"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {/* ===== HEADER ===== */}
          <div
            className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10"
            style={{ background: heroBg }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#0094C6] to-[#005377] flex items-center justify-center shadow-lg shadow-[#0094C6]/20 shrink-0">
                <Calculator size={18} className="text-white" strokeWidth={2.4} />
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#4A6080]">
                  Risk Calculator · R-Multiple Replay
                </div>
                <div
                  className="text-white text-lg leading-tight truncate"
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    letterSpacing: "0.04em",
                  }}
                >
                  WHAT IF · {range.label}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Currency toggle */}
              <div
                className="flex items-stretch rounded-md border border-white/10 bg-[#0D1E35] overflow-hidden"
                role="group"
                aria-label="Currency"
              >
                <button
                  onClick={() => setCurrency("EUR")}
                  className={`px-2.5 py-1.5 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                    currency === "EUR"
                      ? "bg-[#0077B6] text-white"
                      : "text-white/60 hover:text-white"
                  }`}
                  data-testid="whatif-ccy-eur"
                  aria-pressed={currency === "EUR"}
                >
                  <Euro size={11} strokeWidth={2.5} />
                  EUR
                </button>
                <button
                  onClick={() => setCurrency("USD")}
                  className={`px-2.5 py-1.5 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider transition-colors border-l border-white/10 ${
                    currency === "USD"
                      ? "bg-[#0077B6] text-white"
                      : "text-white/60 hover:text-white"
                  }`}
                  data-testid="whatif-ccy-usd"
                  aria-pressed={currency === "USD"}
                >
                  <DollarSign size={11} strokeWidth={2.5} />
                  USD
                </button>
              </div>
              <button
                onClick={onClose}
                className="text-[#4A6080] hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/5 shrink-0"
                aria-label="Close calculator"
                data-testid="whatif-close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ===== BODY ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-0 lg:gap-0">
            {/* ---- LEFT: CONTROLS ---- */}
            <div className="p-5 border-b lg:border-b-0 lg:border-r border-white/10 space-y-5">
              {/* Scope */}
              <div>
                <label className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#4A6080] mb-2 flex items-center gap-1.5">
                  <Layers size={10} /> Scope
                </label>
                <button
                  onClick={() => {
                    setPickerOpen(true);
                    setDraftFrom(range.fromKey);
                    setDraftTo(range.toKey);
                    if (
                      range.fromKey &&
                      range.fromKey === range.toKey
                    ) {
                      setPickerMode("single");
                    } else if (
                      sortedMonths.length > 0 &&
                      range.fromKey === sortedMonths[sortedMonths.length - 1].key &&
                      range.toKey === sortedMonths[0].key
                    ) {
                      setPickerMode("all");
                    } else {
                      setPickerMode("range");
                    }
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[#0077B6]/40 bg-[#0077B6]/12 hover:bg-[#0077B6]/20 hover:border-[#0077B6] text-white text-left transition-all shadow-sm shadow-[#0077B6]/10"
                  data-testid="whatif-scope-chip"
                  aria-haspopup="dialog"
                  aria-expanded={pickerOpen}
                >
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] uppercase tracking-wider truncate text-white">
                      {range.label}
                    </div>
                    <div className="font-mono text-[9px] text-[#4A6080] mt-0.5">
                      {trades.length} trade{trades.length === 1 ? "" : "s"} · click to change
                    </div>
                  </div>
                  <ChevronDown size={14} className="text-[#4A6080] shrink-0" />
                </button>

                {/* ===== Picker drawer ===== */}
                {pickerOpen && (
                  <div
                    className="mt-2 rounded-xl border border-white/10 bg-[#0D1E35] p-3 shadow-lg shadow-black/30"
                    data-testid="whatif-scope-picker"
                  >
                    {/* Mode tabs */}
                    <div className="flex items-center gap-1 mb-3">
                      {(
                        [
                          { id: "single", label: "Single month" },
                          { id: "range", label: "Range" },
                          { id: "all", label: "All time" },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setPickerMode(tab.id)}
                          className={`px-2.5 py-1 rounded-md font-mono text-[10px] uppercase tracking-wider transition-colors ${
                            pickerMode === tab.id
                              ? "bg-[#0077B6] text-white"
                              : "text-white/60 hover:text-white hover:bg-white/5"
                          }`}
                          data-testid={`whatif-scope-tab-${tab.id}`}
                        >
                          {tab.label}
                        </button>
                      ))}
                      <div className="flex-1" />
                      <button
                        onClick={() => setPickerOpen(false)}
                        className="text-[#4A6080] hover:text-white p-1 rounded hover:bg-white/5"
                        aria-label="Close picker"
                      >
                        <X size={12} />
                      </button>
                    </div>

                    {/* Single month list */}
                    {pickerMode === "single" && (
                      <div className="max-h-56 overflow-y-auto pr-1 space-y-1">
                        {sortedMonths.length === 0 && (
                          <div className="font-mono text-[10px] text-[#4A6080] py-2 text-center">
                            No saved months yet.
                          </div>
                        )}
                        {sortedMonths.map((m) => {
                          const isSel =
                            range.fromKey === m.key && range.toKey === m.key;
                          return (
                            <button
                              key={m.key}
                              onClick={() => {
                                setRange(singleMonthRange(m));
                                setPickerOpen(false);
                              }}
                              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md transition-colors ${
                                isSel
                                  ? "bg-[#0077B6]/20 border border-[#0077B6]/40 text-white"
                                  : "border border-transparent hover:bg-white/5 text-white/80"
                              }`}
                              data-testid={`whatif-month-${m.key}`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {isSel ? (
                                  <Check size={11} className="text-[#0077B6] shrink-0" />
                                ) : (
                                  <span className="w-[11px] shrink-0" />
                                )}
                                <span className="font-mono text-[11px] uppercase tracking-wider truncate">
                                  {m.monthName} {m.yearFull}
                                </span>
                              </div>
                              <span className="font-mono text-[9px] text-[#4A6080] shrink-0">
                                {m.tradeCount} trades
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Range mode */}
                    {pickerMode === "range" && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-[#4A6080] mb-1">
                              From
                            </div>
                            <select
                              value={draftFrom}
                              onChange={(e) => setDraftFrom(e.target.value)}
                              className="w-full bg-[#0A1628] border border-white/10 rounded-md px-2 py-1.5 font-mono text-[11px] text-white focus:outline-none focus:border-[#0077B6]"
                              data-testid="whatif-range-from"
                            >
                              {[...sortedMonths]
                                .reverse()
                                .map((m) => (
                                  <option key={m.key} value={m.key}>
                                    {m.monthName} {m.yearFull}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div>
                            <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-[#4A6080] mb-1">
                              To
                            </div>
                            <select
                              value={draftTo}
                              onChange={(e) => setDraftTo(e.target.value)}
                              className="w-full bg-[#0A1628] border border-white/10 rounded-md px-2 py-1.5 font-mono text-[11px] text-white focus:outline-none focus:border-[#0077B6]"
                              data-testid="whatif-range-to"
                            >
                              {[...sortedMonths]
                                .reverse()
                                .map((m) => (
                                  <option key={m.key} value={m.key}>
                                    {m.monthName} {m.yearFull}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>

                        {/* Quick presets: from each month → latest */}
                        {sortedMonths.length >= 2 && (
                          <div>
                            <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-[#4A6080] mb-1.5">
                              Quick presets · → {shortMonthLabel(sortedMonths[0])}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {sortedMonths.slice(1).map((m) => (
                                <button
                                  key={m.key}
                                  onClick={() => {
                                    const r = multiMonthRange(
                                      m,
                                      sortedMonths[0],
                                    );
                                    setRange(r);
                                    setDraftFrom(r.fromKey);
                                    setDraftTo(r.toKey);
                                    setPickerOpen(false);
                                  }}
                                  className="px-2 py-1 rounded-md border border-white/10 bg-[#0A1628] hover:border-[#0077B6] hover:bg-[#0077B6]/10 text-white/70 hover:text-white font-mono text-[9px] uppercase tracking-wider transition-colors"
                                  data-testid={`whatif-preset-${m.key}`}
                                >
                                  {shortMonthLabel(m)} → Σήμερα
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <button
                          onClick={() => {
                            const a = findMonth(draftFrom);
                            const b = findMonth(draftTo);
                            if (!a || !b) return;
                            setRange(multiMonthRange(a, b));
                            setPickerOpen(false);
                          }}
                          disabled={!draftFrom || !draftTo}
                          className="w-full px-3 py-1.5 rounded-md bg-[#0077B6] hover:bg-[#0094C6] disabled:opacity-40 disabled:cursor-not-allowed text-white font-mono text-[10px] uppercase tracking-wider transition-colors"
                          data-testid="whatif-range-apply"
                        >
                          Apply range
                        </button>
                      </div>
                    )}

                    {/* All time */}
                    {pickerMode === "all" && (
                      <div className="py-2">
                        <button
                          onClick={() => {
                            setRange(allTimeRange(sortedMonths));
                            setPickerOpen(false);
                          }}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-[#0A1628] border border-white/10 hover:border-[#0077B6] hover:bg-[#0077B6]/10 text-white text-left transition-colors"
                          data-testid="whatif-pick-all"
                        >
                          <div>
                            <div className="font-mono text-[11px] uppercase tracking-wider">
                              ALL TIME
                            </div>
                            <div className="font-mono text-[9px] text-[#4A6080] mt-0.5">
                              Replay every saved trade chronologically.
                            </div>
                          </div>
                          <span className="font-mono text-[10px] text-[#4A6080] shrink-0">
                            {allTimeTrades.length} trades
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Capital */}
              <div>
                <label className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#4A6080] mb-2 flex items-center gap-1.5">
                  <Wallet size={10} /> Starting capital ({ccySymbol})
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {CAPITAL_PRESETS.map((c) => {
                    const selected = capital === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setCapital(c)}
                        className={`px-3 py-1.5 rounded-md border text-[11px] font-mono font-semibold transition-all ${
                          selected
                            ? "bg-[#0077B6] border-[#0077B6] text-white"
                            : "bg-[#0D1E35] border-white/10 text-white/70 hover:border-white/30"
                        }`}
                      >
                        {c >= 1000 ? `${c / 1000}k` : c}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="number"
                  value={capital}
                  min={0}
                  step={500}
                  onChange={(e) =>
                    setCapital(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-full bg-[#0D1E35] border border-white/10 rounded-md px-3 py-2 text-white font-mono text-sm focus:border-[#0077B6] focus:outline-none"
                  data-testid="whatif-capital-input"
                />
              </div>

              {/* Risk % */}
              <div>
                <label className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#4A6080] mb-2 flex items-center gap-1.5">
                  <Percent size={10} /> Risk per trade
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {RISK_PRESETS.map((r) => {
                    const selected = Math.abs(riskPct - r) < 0.001;
                    return (
                      <button
                        key={r}
                        onClick={() => setRiskPct(r)}
                        className={`px-3 py-1.5 rounded-md border text-[11px] font-mono font-semibold transition-all ${
                          selected
                            ? "bg-[#F4A261] border-[#F4A261] text-[#0A1628]"
                            : "bg-[#0D1E35] border-white/10 text-white/70 hover:border-white/30"
                        }`}
                      >
                        {r}%
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0.1}
                    max={20}
                    step={0.1}
                    value={riskPct}
                    onChange={(e) => setRiskPct(Number(e.target.value))}
                    className="flex-1 accent-[#F4A261]"
                  />
                  <div className="font-mono text-sm font-semibold text-white w-14 text-right">
                    {riskPct.toFixed(1)}%
                  </div>
                </div>
                <div className="font-mono text-[9px] text-[#4A6080] mt-1.5">
                  Risk per trade ≈{" "}
                  <span className="text-white/80">
                    {fmtMoney((capital * riskPct) / 100)}
                  </span>{" "}
                  {compound ? "(initial; recomputed each trade)" : "(fixed)"}
                </div>
              </div>

              {/* Compound toggle */}
              <div>
                <label className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#4A6080] mb-2 flex items-center gap-1.5">
                  <Zap size={10} /> Compounding
                </label>
                <button
                  onClick={() => setCompound((c) => !c)}
                  className={`w-full px-3 py-2 rounded-lg border text-left transition-all ${
                    compound
                      ? "bg-[#5E60CE]/15 border-[#5E60CE] text-white"
                      : "bg-[#0D1E35] border-white/10 text-white/70 hover:border-white/30"
                  }`}
                  data-testid="whatif-compound-toggle"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-wider">
                      {compound ? "Compound · ON" : "Fixed risk · OFF"}
                    </span>
                    <div
                      className={`w-9 h-5 rounded-full relative transition-colors ${
                        compound ? "bg-[#5E60CE]" : "bg-white/10"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                          compound ? "left-[18px]" : "left-0.5"
                        }`}
                      />
                    </div>
                  </div>
                  <div className="font-mono text-[9px] text-[#4A6080] mt-1 leading-snug">
                    {compound
                      ? "Risk is recomputed from the running balance before every trade."
                      : "Risk amount stays fixed at capital × risk % for every trade."}
                  </div>
                </button>
              </div>

              {/* Fallback warning */}
              {result.fallbackTradesCount > 0 && (
                <div className="rounded-lg border border-[#F4A261]/30 bg-[#F4A261]/8 px-3 py-2.5 flex items-start gap-2">
                  <Sparkles
                    size={12}
                    className="text-[#F4A261] mt-0.5 shrink-0"
                  />
                  <div className="font-mono text-[10px] text-[#F4A261] leading-snug">
                    <span className="font-semibold">
                      {result.fallbackTradesCount}
                    </span>{" "}
                    trade{result.fallbackTradesCount === 1 ? "" : "s"} had no
                    usable SL — used ±1R fallback based on realised P/L sign.
                  </div>
                </div>
              )}
            </div>

            {/* ---- RIGHT: RESULTS ---- */}
            <div
              className="p-5 space-y-4"
              style={{
                background: isLight
                  ? "rgba(246, 248, 251, 0.5)"
                  : "rgba(8, 17, 31, 0.4)",
              }}
            >
              {/* Final balance hero */}
              <div
                className="rounded-xl border border-white/10 p-4"
                style={{ background: heroBg }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#4A6080]">
                    Final balance
                  </div>
                  <div
                    className="font-mono text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{
                      background: `${profitColor}22`,
                      color: profitColor,
                    }}
                  >
                    {totalPctSign}
                    {result.totalPct.toFixed(2)}%
                  </div>
                </div>
                <div
                  className="tabular-nums"
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: 44,
                    lineHeight: 1,
                    letterSpacing: "0.02em",
                    color: heroNumberColor,
                  }}
                  data-testid="whatif-final-balance"
                >
                  {fmtMoney(result.finalBalance)}
                </div>
                <div
                  className="font-mono text-xs mt-1.5"
                  style={{ color: profitColor }}
                >
                  {result.totalPnl >= 0 ? "▲" : "▼"}{" "}
                  {fmtMoney(Math.abs(result.totalPnl))} net P/L over{" "}
                  {result.consideredTradesCount} trade
                  {result.consideredTradesCount === 1 ? "" : "s"}
                </div>
              </div>

              {/* Equity sparkline */}
              <div className="rounded-xl border border-white/10 bg-[#0D1E35] p-3">
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#4A6080] mb-2 flex items-center gap-1.5">
                  <TrendingUp size={10} /> Hypothetical equity curve
                </div>
                <div style={{ width: "100%", height: 110 }}>
                  {equityData.length > 1 ? (
                    <ResponsiveContainer>
                      <AreaChart data={equityData}>
                        <defs>
                          <linearGradient
                            id="whatif-equity"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={profitColor}
                              stopOpacity={0.45}
                            />
                            <stop
                              offset="100%"
                              stopColor={profitColor}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="idx" hide />
                        <YAxis hide domain={["dataMin", "dataMax"]} />
                        <Tooltip
                          cursor={{ stroke: "#4A6080", strokeWidth: 1 }}
                          contentStyle={{
                            background: tooltipBg,
                            border: tooltipBorder,
                            borderRadius: 8,
                            fontFamily: "monospace",
                            fontSize: 11,
                            color: heroNumberColor,
                          }}
                          itemStyle={{ color: heroNumberColor }}
                          labelStyle={{ color: "#4A6080" }}
                        formatter={(value: number) => [
                          fmtMoney(value),
                          "Balance",
                        ]}
                          labelFormatter={(label) => `Trade #${label}`}
                        />
                        <Area
                          type="monotone"
                          dataKey="balance"
                          stroke={profitColor}
                          strokeWidth={2}
                          fill="url(#whatif-equity)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center font-mono text-[10px] text-[#4A6080]">
                      No usable trades in scope
                    </div>
                  )}
                </div>
              </div>

              {/* KPI grid */}
              <div className="grid grid-cols-3 gap-2">
                <KPI
                  label="Win rate"
                  value={`${result.winRate.toFixed(0)}%`}
                  accent="#0077B6"
                />
                <KPI
                  label="Best trade"
                  value={fmtMoney(result.bestTrade)}
                  accent="#00897B"
                />
                <KPI
                  label="Worst trade"
                  value={fmtMoney(result.worstTrade)}
                  accent="#E94F37"
                />
                <KPI
                  label="Max drawdown"
                  value={fmtMoney(result.maxDrawdown)}
                  sub={fmtPct(result.maxDrawdownPct / 100)}
                  accent="#F4A261"
                />
                <KPI
                  label="Considered"
                  value={String(result.consideredTradesCount)}
                  sub={`${result.fallbackTradesCount} fallback`}
                  accent="#5E60CE"
                />
                <KPI
                  label="Skipped"
                  value={String(result.skippedTradesCount)}
                  sub="no entry/exit"
                  accent="#4A6080"
                />
              </div>

              {/* Compare grid */}
              {trades.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-[#0D1E35] p-3">
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#4A6080] mb-2 flex items-center gap-1.5">
                    <Layers size={10} /> Quick compare · final balance
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] font-mono">
                      <thead>
                        <tr className="text-[#4A6080]">
                          <th className="text-left font-normal py-1 pr-2">
                            Capital ↓ / Risk →
                          </th>
                          {COMPARE_RISKS.map((r) => (
                            <th
                              key={r}
                              className="text-right font-normal py-1 px-2"
                            >
                              {r}%
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {COMPARE_CAPITALS.map((c) => (
                          <tr
                            key={c}
                            className="border-t border-white/5 text-white/80"
                          >
                            <td className="py-1.5 pr-2 text-[#4A6080]">
                              {fmtMoney(c)}
                            </td>
                            {COMPARE_RISKS.map((r) => {
                              const cell = grid.find(
                                (x) => x.capital === c && x.riskPct === r,
                              );
                              if (!cell) return <td key={r} />;
                              const pos = cell.result.totalPnl >= 0;
                              return (
                                <td
                                  key={r}
                                  className="text-right py-1.5 px-2 tabular-nums"
                                  style={{ color: pos ? "#00897B" : "#E94F37" }}
                                >
                                  {fmtMoney(cell.result.finalBalance)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="font-mono text-[9px] text-[#4A6080] mt-1.5">
                    {compound ? "Compound" : "Fixed"} risk ·{" "}
                    {result.consideredTradesCount} trades replayed
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ===== FOOTER ===== */}
          <div
            className="px-5 py-3 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap"
            style={{
              background: isLight
                ? "rgba(238, 242, 247, 0.6)"
                : "rgba(8, 17, 31, 0.6)",
            }}
          >
            <div className="font-mono text-[9px] text-[#4A6080] uppercase tracking-wider">
              R = (exit − entry) ÷ |entry − SL|, signed by side ·{" "}
              {result.fallbackTradesCount > 0
                ? `${result.fallbackTradesCount} fallback`
                : "all real R"}
              {" · "}
              <span
                style={{
                  color: isLight ? "#0A1628" : "rgba(255,255,255,0.7)",
                }}
              >
                {ccyLabel}
              </span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-md bg-[#0077B6] hover:bg-[#0094C6] text-white font-mono text-[10px] uppercase tracking-wider transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ===== HELPERS =====

function KPI({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-white/8 bg-[#0D1E35] p-2.5 relative overflow-hidden">
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5"
        style={{ background: accent }}
      />
      <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-[#4A6080] mb-1">
        {label}
      </div>
      <div className="font-mono text-sm font-semibold text-white tabular-nums leading-tight">
        {value}
      </div>
      {sub && (
        <div className="font-mono text-[9px] text-[#4A6080] mt-0.5">{sub}</div>
      )}
    </div>
  );
}
