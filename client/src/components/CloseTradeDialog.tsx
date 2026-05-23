// CloseTradeDialog.tsx — settles an open trade.
//
// Captures the data that wasn't known when the trade was opened:
//   • Exit price + close datetime (auto = "now")
//   • Realised P/L (manual or computed from price + lots)
//   • Optional swap / commission
//   • Chart "after" link
//   • Exit psychology / lessons (additive — entry psychology is preserved)
//
// On save, returns a fully-settled Trade object with `status: 'closed'`.
// The original entry psychology stays untouched; new lessons append to the
// existing `lessons_learned` so the entry/exit reflection are both preserved.

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Calculator, Link2 } from "lucide-react";
import type { Trade } from "@/lib/trading";

interface Props {
  trade: Trade;
  /** Balance immediately before this trade (used to auto-compute net %). */
  lastBalance: number;
  onClose: () => void;
  onSave: (settled: Trade) => void;
}

const toLocalDT = (d: Date) => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function CloseTradeDialog({ trade, lastBalance, onClose, onSave }: Props) {
  const [exitPrice, setExitPrice] = useState<string>("");
  const [closeAt, setCloseAt] = useState<string>(toLocalDT(new Date()));
  const [pnl, setPnl] = useState<string>("");
  const [swap, setSwap] = useState<string>("0");
  const [commission, setCommission] = useState<string>("0");
  const [chartAfter, setChartAfter] = useState<string>(trade.chart_after || "");
  const [exitPsychology, setExitPsychology] = useState<string>("");
  const [exitLessons, setExitLessons] = useState<string>("");

  const calc = useMemo(() => {
    const e = trade.entry || 0;
    const x = parseFloat(exitPrice) || 0;
    const slv = trade.sl ?? 0;
    const pnlv = parseFloat(pnl) || 0;
    const swp = parseFloat(swap) || 0;
    const cmm = parseFloat(commission) || 0;

    let r: number | null = null;
    if (e && slv && x) {
      const risk = trade.direction === "BUY" ? e - slv : slv - e;
      const reward = trade.direction === "BUY" ? x - e : e - x;
      if (risk !== 0) r = reward / risk;
    }

    const totalNet = pnlv + swp + cmm;
    const netPct = lastBalance > 0 ? totalNet / lastBalance : 0;
    return { r, totalNet, netPct };
  }, [exitPrice, pnl, swap, commission, trade.entry, trade.sl, trade.direction, lastBalance]);

  const canSave = Boolean(exitPrice && pnl && closeAt);

  const handleSave = () => {
    const settled: Trade = {
      ...trade,
      status: "closed",
      close: parseFloat(exitPrice) || 0,
      close_time: closeAt ? new Date(closeAt).toISOString() : new Date().toISOString(),
      pnl: parseFloat(pnl) || 0,
      swap: parseFloat(swap) || 0,
      commission: parseFloat(commission) || 0,
      net_pct: calc.netPct,
      trade_r: calc.r,
      chart_after: chartAfter.trim(),
      // Append exit reflections to existing notes so entry psychology stays intact.
      psychology: [trade.psychology, exitPsychology.trim()].filter(Boolean).join("\n\n— EXIT —\n").trim() || undefined,
      lessons_learned:
        [trade.lessons_learned, exitLessons.trim()].filter(Boolean).join("\n\n— EXIT —\n").trim() || undefined,
    };
    onSave(settled);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[210] bg-[#050B16]/85 backdrop-blur-md flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 30, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 30, opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", damping: 24, stiffness: 280 }}
          className="w-full max-w-xl my-4 sm:my-0 bg-gradient-to-b from-[#0A1628] via-[#0D1E35] to-[#0A1628] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-white/5 bg-gradient-to-r from-[#F4A261]/8 via-transparent to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#F4A261]/20 to-[#C97A2C]/30 border border-[#F4A261]/30 flex items-center justify-center">
                <Check size={16} className="text-[#F4A261]" />
              </div>
              <div>
                <div className="font-display text-base sm:text-lg font-bold text-white tracking-wide">
                  CLOSE TRADE <span className="text-[#F4A261]">#{trade.idx}</span>
                </div>
                <div className="font-mono text-[10px] text-[#4A6080] uppercase tracking-widest">
                  {trade.symbol} · {trade.direction} · {trade.lots} lots · entry {trade.entry}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 sm:px-7 py-5 sm:py-6 space-y-5">
            {/* Exit price + close time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Exit Price" required>
                <input
                  type="number"
                  step="any"
                  value={exitPrice}
                  onChange={(e) => setExitPrice(e.target.value)}
                  placeholder="1.08920"
                  autoFocus
                  className="input"
                />
              </Field>
              <Field label="Close Time" required>
                <input
                  type="datetime-local"
                  value={closeAt}
                  onChange={(e) => setCloseAt(e.target.value)}
                  className="input"
                />
              </Field>
            </div>

            {/* P/L breakdown */}
            <div className="rounded-xl border border-white/10 bg-[#050B16]/60 p-4 space-y-3">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#4A6080]">P/L Breakdown</div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="P/L ($)" required compact>
                  <input
                    type="number"
                    step="any"
                    value={pnl}
                    onChange={(e) => setPnl(e.target.value)}
                    placeholder="170.00"
                    className="input"
                  />
                </Field>
                <Field label="Swap ($)" compact>
                  <input
                    type="number"
                    step="any"
                    value={swap}
                    onChange={(e) => setSwap(e.target.value)}
                    placeholder="0"
                    className="input"
                  />
                </Field>
                <Field label="Commission ($)" compact>
                  <input
                    type="number"
                    step="any"
                    value={commission}
                    onChange={(e) => setCommission(e.target.value)}
                    placeholder="0"
                    className="input"
                  />
                </Field>
              </div>
            </div>

            {/* Auto-calculated preview */}
            <div className="rounded-xl border border-[#F4A261]/30 bg-gradient-to-br from-[#F4A261]/8 via-[#F4A261]/3 to-transparent p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calculator size={12} className="text-[#F4A261]" />
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#F4A261]">Auto-calculated</div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Stat
                  label="R-Multiple"
                  value={calc.r !== null ? `${calc.r >= 0 ? "+" : ""}${calc.r.toFixed(2)}R` : "—"}
                  highlight={calc.r !== null && calc.r > 0}
                  negative={calc.r !== null && calc.r < 0}
                />
                <Stat
                  label="Net %"
                  value={`${calc.netPct >= 0 ? "+" : ""}${(calc.netPct * 100).toFixed(2)}%`}
                  highlight={calc.netPct > 0}
                  negative={calc.netPct < 0}
                />
                <Stat
                  label="Total Net"
                  value={`${calc.totalNet >= 0 ? "+$" : "-$"}${Math.abs(calc.totalNet).toFixed(2)}`}
                  highlight={calc.totalNet > 0}
                  negative={calc.totalNet < 0}
                />
              </div>
            </div>

            {/* Chart after */}
            <Field label="CHART AFTER — TradingView link (optional)">
              <div className="relative">
                <Link2 size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A6080]" />
                <input
                  type="url"
                  value={chartAfter}
                  onChange={(e) => setChartAfter(e.target.value)}
                  placeholder="https://www.tradingview.com/x/XYZ789/"
                  className="input pl-8"
                />
              </div>
            </Field>

            {/* Exit reflections — appended to entry psychology so both stay visible */}
            <Field label="EXIT PSYCHOLOGY — τι ένιωθες όταν έκλεισες">
              <textarea
                value={exitPsychology}
                onChange={(e) => setExitPsychology(e.target.value)}
                placeholder="Έκλεισα στην ώρα που είχα ορίσει… ή πανικοβλήθηκα όταν το δω να γυρνάει…"
                rows={3}
                className="input font-mono text-xs leading-relaxed"
              />
              {trade.psychology && (
                <div className="mt-2 rounded-lg border border-white/8 bg-white/3 p-2.5 font-mono text-[10px] text-[#6E8AA8] leading-relaxed">
                  <div className="text-[#4A6080] uppercase tracking-widest mb-1">Entry psychology (διατηρείται)</div>
                  <div className="whitespace-pre-wrap">{trade.psychology}</div>
                </div>
              )}
            </Field>

            <Field label="EXIT LESSONS — τι κρατάς από αυτή τη ροή">
              <textarea
                value={exitLessons}
                onChange={(e) => setExitLessons(e.target.value)}
                placeholder="Π.χ. Έπρεπε να σηκώσω το stop πιο αργά."
                rows={3}
                className="input font-mono text-xs leading-relaxed"
              />
            </Field>
          </div>

          {/* Footer */}
          <div className="px-5 sm:px-7 py-4 bg-[#050B16]/40 border-t border-white/5 flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono font-semibold uppercase tracking-wider text-white/70 transition-all"
            >
              CANCEL
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-gradient-to-br from-[#00897B] to-[#005A50] hover:from-[#00A99A] hover:to-[#00897B] disabled:from-white/10 disabled:to-white/5 disabled:text-white/30 disabled:cursor-not-allowed text-[11px] font-mono font-semibold uppercase tracking-wider text-white shadow-lg shadow-[#00897B]/30 transition-all"
            >
              <Check size={11} /> CLOSE & SETTLE
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Field({
  label,
  required,
  compact,
  children,
}: {
  label: string;
  required?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <label className="block font-mono text-[10px] uppercase tracking-widest text-[#6E8AA8]">
        {label} {required && <span className="text-[#F4A261]">*</span>}
      </label>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  negative,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  negative?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-[#4A6080]">{label}</div>
      <div
        className={`font-mono font-bold text-sm mt-0.5 ${
          highlight ? "text-[#00897B]" : negative ? "text-[#E94F37]" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
