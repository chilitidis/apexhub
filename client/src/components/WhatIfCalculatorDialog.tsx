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
  Layers,
  Percent,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Trade } from "@/lib/trading";
import { fmtPct, fmtUSDnoSign } from "@/lib/trading";
import { simulate, simulateGrid } from "@/lib/whatIf";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Trades from the currently selected month. */
  monthTrades: Trade[];
  /** Trades aggregated across all saved months (chronological). */
  allTimeTrades: Trade[];
  /** Greek month label of the current view, e.g. "ΑΠΡΙΛΙΟΣ 2026". */
  monthLabel: string;
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
}: Props) {
  const [capital, setCapital] = useState(10_000);
  const [riskPct, setRiskPct] = useState(3);
  const [compound, setCompound] = useState(false);
  const [scope, setScope] = useState<"month" | "all">("month");

  // Reset to sensible defaults each time the dialog opens.
  useEffect(() => {
    if (open) {
      setCapital(10_000);
      setRiskPct(3);
      setCompound(false);
      setScope("month");
    }
  }, [open]);

  const trades = scope === "month" ? monthTrades : allTimeTrades;

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
        className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto pointer-events-none"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto bg-[#0A1628] light:bg-[#FFFBF5] border border-white/10 light:border-black/10 rounded-2xl w-full max-w-[1100px] my-auto shadow-2xl shadow-black/40 overflow-hidden"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {/* ===== HEADER ===== */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10 bg-gradient-to-r from-[#0D1E35] to-[#0A1628]">
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
                  WHAT IF · {scope === "month" ? monthLabel : "ALL TIME"}
                </div>
              </div>
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

          {/* ===== BODY ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-0 lg:gap-0">
            {/* ---- LEFT: CONTROLS ---- */}
            <div className="p-5 border-b lg:border-b-0 lg:border-r border-white/10 space-y-5">
              {/* Scope */}
              <div>
                <label className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#4A6080] mb-2 flex items-center gap-1.5">
                  <Layers size={10} /> Scope
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: "month", label: monthLabel, count: monthTrades.length },
                      { id: "all", label: "All time", count: allTimeTrades.length },
                    ] as const
                  ).map((opt) => {
                    const selected = scope === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setScope(opt.id)}
                        className={`px-3 py-2 rounded-lg border text-left transition-all ${
                          selected
                            ? "bg-[#0077B6]/15 border-[#0077B6] text-white shadow-md shadow-[#0077B6]/10"
                            : "bg-[#0D1E35] border-white/10 text-white/70 hover:border-white/30 hover:text-white"
                        }`}
                      >
                        <div className="font-mono text-[10px] uppercase tracking-wider truncate">
                          {opt.label}
                        </div>
                        <div className="font-mono text-[9px] text-[#4A6080] mt-0.5">
                          {opt.count} trades
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Capital */}
              <div>
                <label className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#4A6080] mb-2 flex items-center gap-1.5">
                  <Wallet size={10} /> Starting capital (€)
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
                    €{((capital * riskPct) / 100).toLocaleString("el-GR", {
                      maximumFractionDigits: 0,
                    })}
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
            <div className="p-5 space-y-4 bg-[#08111F]/40">
              {/* Final balance hero */}
              <div className="rounded-xl border border-white/10 bg-gradient-to-br from-[#0D1E35] to-[#0A1628] p-4">
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
                  className="text-white tabular-nums"
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: 44,
                    lineHeight: 1,
                    letterSpacing: "0.02em",
                  }}
                  data-testid="whatif-final-balance"
                >
                  €
                  {result.finalBalance.toLocaleString("el-GR", {
                    maximumFractionDigits: 0,
                  })}
                </div>
                <div
                  className="font-mono text-xs mt-1.5"
                  style={{ color: profitColor }}
                >
                  {result.totalPnl >= 0 ? "▲" : "▼"}{" "}
                  {fmtUSDnoSign(Math.abs(result.totalPnl))} net P/L over{" "}
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
                            background: "#0A1628",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 8,
                            fontFamily: "monospace",
                            fontSize: 11,
                          }}
                          formatter={(value: number) => [
                            "€" +
                              value.toLocaleString("el-GR", {
                                maximumFractionDigits: 0,
                              }),
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
                  value={"€" + Math.round(result.bestTrade).toLocaleString("el-GR")}
                  accent="#00897B"
                />
                <KPI
                  label="Worst trade"
                  value={"€" + Math.round(result.worstTrade).toLocaleString("el-GR")}
                  accent="#E94F37"
                />
                <KPI
                  label="Max drawdown"
                  value={
                    "€" +
                    Math.round(result.maxDrawdown).toLocaleString("el-GR")
                  }
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
                              €{c.toLocaleString("el-GR")}
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
                                  €
                                  {Math.round(
                                    cell.result.finalBalance,
                                  ).toLocaleString("el-GR")}
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
          <div className="px-5 py-3 border-t border-white/10 bg-[#08111F]/60 flex items-center justify-between gap-3 flex-wrap">
            <div className="font-mono text-[9px] text-[#4A6080] uppercase tracking-wider">
              R = (exit − entry) ÷ |entry − SL|, signed by side ·{" "}
              {result.fallbackTradesCount > 0
                ? `${result.fallbackTradesCount} fallback`
                : "all real R"}
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
