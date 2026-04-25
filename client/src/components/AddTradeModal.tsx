// AddTradeModal.tsx — Full-featured trade entry form for APEXHUB Trading Journal
// Replicates all fields from the Excel format with auto-calculations for R, P/L%, NET%

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Calculator, Link2, ArrowRight, ArrowLeft, ImagePlus, Loader2, Check } from 'lucide-react';
import type { Trade } from '@/lib/trading';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

const POPULAR_SYMBOLS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD',
  'EURJPY', 'GBPJPY', 'AUDJPY', 'CADJPY', 'CHFJPY', 'NZDJPY',
  'EURGBP', 'EURAUD', 'EURCAD', 'EURCHF', 'EURNZD',
  'GBPAUD', 'GBPCAD', 'GBPCHF', 'GBPNZD',
  'AUDCAD', 'AUDCHF', 'AUDNZD', 'NZDCAD', 'NZDCHF', 'CADCHF',
  'XAUUSD', 'XAGUSD', 'US30', 'US100', 'US500', 'BTCUSD', 'ETHUSD',
];

const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];

const GREEK_DAYS = ['ΚΥΡ', 'ΔΕΥ', 'ΤΡΙ', 'ΤΕΤ', 'ΠΕΜ', 'ΠΑΡ', 'ΣΑΒ'];

const dayFromDate = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return GREEK_DAYS[d.getDay()];
};

interface Props {
  initial?: Trade | null;
  lastBalance: number;
  nextIdx: number;
  onSave: (trade: Trade) => void;
  onClose: () => void;
}

type Step = 1 | 2 | 3;

export default function AddTradeModal({ initial, lastBalance, nextIdx, onSave, onClose }: Props) {
  const isEdit = Boolean(initial);
  const [step, setStep] = useState<Step>(1);

  // Step 1: Identification
  const [symbol, setSymbol] = useState(initial?.symbol || '');
  const [direction, setDirection] = useState<'BUY' | 'SELL'>(initial?.direction || 'BUY');
  const [openDate, setOpenDate] = useState(initial?.open ? toLocalDT(initial.open) : toLocalDT(new Date().toISOString()));
  const [closeDate, setCloseDate] = useState(initial?.close_time ? toLocalDT(initial.close_time) : '');
  const [tf, setTf] = useState(initial?.tf || 'H1');

  // Step 2: Prices & sizing
  const [lots, setLots] = useState(initial?.lots?.toString() || '');
  const [entry, setEntry] = useState(initial?.entry?.toString() || '');
  const [exitPrice, setExitPrice] = useState(initial?.close?.toString() || '');
  const [sl, setSl] = useState(initial?.sl?.toString() || '');
  const [tp, setTp] = useState(initial?.tp?.toString() || '');
  const [pnl, setPnl] = useState(initial?.pnl?.toString() || '');
  const [swap, setSwap] = useState(initial?.swap?.toString() || '0');
  const [commission, setCommission] = useState(initial?.commission?.toString() || '0');

  // Step 3: Charts (optional)
  const [chartBefore, setChartBefore] = useState(initial?.chart_before || '');
  const [chartAfter, setChartAfter] = useState(initial?.chart_after || '');

  // Apply values returned by the screenshot LLM extractor.
  const applyExtracted = (payload: {
    symbol?: string;
    direction?: 'BUY' | 'SELL';
    lots?: number;
    entry?: number;
    close?: number;
    sl?: number | null;
    tp?: number | null;
    pnl?: number;
    swap?: number;
    commission?: number;
    open_time?: string;
    close_time?: string;
  }) => {
    if (payload.symbol) setSymbol(String(payload.symbol).toUpperCase());
    if (payload.direction === 'BUY' || payload.direction === 'SELL') setDirection(payload.direction);
    if (typeof payload.lots === 'number') setLots(String(payload.lots));
    if (typeof payload.entry === 'number') setEntry(String(payload.entry));
    if (typeof payload.close === 'number') setExitPrice(String(payload.close));
    if (typeof payload.sl === 'number') setSl(String(payload.sl));
    if (typeof payload.tp === 'number') setTp(String(payload.tp));
    if (typeof payload.pnl === 'number') setPnl(String(payload.pnl));
    if (typeof payload.swap === 'number') setSwap(String(payload.swap));
    if (typeof payload.commission === 'number') setCommission(String(payload.commission));
    if (payload.open_time) {
      const iso = toLocalDT(payload.open_time) || payload.open_time;
      setOpenDate(iso);
    }
    if (payload.close_time) {
      const iso = toLocalDT(payload.close_time) || payload.close_time;
      setCloseDate(iso);
    }
  };

  // Auto-calculations
  const calc = useMemo(() => {
    const e = parseFloat(entry) || 0;
    const x = parseFloat(exitPrice) || 0;
    const slv = parseFloat(sl) || 0;
    const tpv = parseFloat(tp) || 0;
    const pnlv = parseFloat(pnl) || 0;
    const swp = parseFloat(swap) || 0;
    const cmm = parseFloat(commission) || 0;

    // R-multiple: (exit - entry) / (entry - SL) for BUY, opposite for SELL
    let r: number | null = null;
    if (e && slv && x) {
      const risk = direction === 'BUY' ? (e - slv) : (slv - e);
      const reward = direction === 'BUY' ? (x - e) : (e - x);
      if (risk !== 0) r = reward / risk;
    }

    // % return based on lastBalance
    const netPct = lastBalance > 0 ? ((pnlv + swp + cmm) / lastBalance) : 0;
    const tradePct = lastBalance > 0 ? (pnlv / lastBalance) : 0;

    return { r, netPct, tradePct, totalNet: pnlv + swp + cmm };
  }, [entry, exitPrice, sl, tp, pnl, swap, commission, direction, lastBalance]);

  const canGoNext1 = symbol.trim() && openDate;
  const canGoNext2 = lots && entry && exitPrice && pnl;

  const handleSave = () => {
    const trade: Trade = {
      idx: initial?.idx || nextIdx,
      day: dayFromDate(openDate),
      open: openDate ? new Date(openDate).toISOString() : '',
      close_time: closeDate ? new Date(closeDate).toISOString() : '',
      symbol: symbol.toUpperCase().trim(),
      direction,
      lots: parseFloat(lots) || 0,
      entry: parseFloat(entry) || 0,
      close: parseFloat(exitPrice) || 0,
      sl: sl ? parseFloat(sl) : null,
      tp: tp ? parseFloat(tp) : null,
      trade_r: calc.r,
      pnl: parseFloat(pnl) || 0,
      swap: parseFloat(swap) || 0,
      commission: parseFloat(commission) || 0,
      net_pct: calc.netPct,
      tf,
      chart_before: chartBefore.trim(),
      chart_after: chartAfter.trim(),
    };
    onSave(trade);
  };

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-[#050B16]/85 backdrop-blur-md flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 30, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 30, opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', damping: 24, stiffness: 280 }}
          className="w-full max-w-2xl my-4 sm:my-0 bg-gradient-to-b from-[#0A1628] via-[#0D1E35] to-[#0A1628] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-white/5 bg-gradient-to-r from-[#0094C6]/5 via-transparent to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#0094C6]/20 to-[#005377]/30 border border-[#0094C6]/30 flex items-center justify-center">
                <Calculator size={16} className="text-[#0094C6]" />
              </div>
              <div>
                <div className="font-display text-base sm:text-lg font-bold text-white tracking-wide">
                  {isEdit ? 'EDIT TRADE' : 'NEW TRADE'} <span className="text-[#0094C6]">#{initial?.idx || nextIdx}</span>
                </div>
                <div className="font-mono text-[10px] text-[#4A6080] uppercase tracking-widest">
                  Step {step} of 3 · {step === 1 ? 'Identification' : step === 2 ? 'Prices & P/L' : 'Charts (optional)'}
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

          {/* Progress bar */}
          <div className="h-1 bg-white/5 relative">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#0094C6] to-[#00B4D8]"
              initial={{ width: '33%' }}
              animate={{ width: `${(step / 3) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Body */}
          <div className="px-5 sm:px-7 py-5 sm:py-6 space-y-5">
            {step === 1 && (
              <>
                {/* Screenshot scanner — auto-fill from MT5 screenshot */}
                <ScreenshotScanner onExtracted={applyExtracted} />

                {/* Symbol */}
                <Field label="Symbol" required>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                      placeholder="EURUSD"
                      list="apexhub-symbols"
                      className="input"
                    />
                    <datalist id="apexhub-symbols">
                      {POPULAR_SYMBOLS.map((s) => <option key={s} value={s} />)}
                    </datalist>
                    <div className="flex flex-wrap gap-1">
                      {['EURUSD', 'GBPJPY', 'XAUUSD', 'NZDJPY', 'CHFJPY', 'AUDCAD'].map((s) => (
                        <button
                          key={s}
                          onClick={() => setSymbol(s)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                            symbol === s
                              ? 'bg-[#0094C6]/20 border-[#0094C6] text-[#0094C6]'
                              : 'bg-white/5 border-white/10 text-[#6E8AA8] hover:border-white/20'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </Field>

                {/* Direction */}
                <Field label="Direction" required>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setDirection('BUY')}
                      className={`px-4 py-3 rounded-lg font-display font-bold text-sm tracking-wider border-2 transition-all ${
                        direction === 'BUY'
                          ? 'bg-[#00897B]/15 border-[#00897B] text-[#00897B] shadow-lg shadow-[#00897B]/20'
                          : 'bg-white/5 border-white/10 text-[#6E8AA8] hover:border-[#00897B]/40'
                      }`}
                    >
                      ▲ BUY
                    </button>
                    <button
                      onClick={() => setDirection('SELL')}
                      className={`px-4 py-3 rounded-lg font-display font-bold text-sm tracking-wider border-2 transition-all ${
                        direction === 'SELL'
                          ? 'bg-[#E94F37]/15 border-[#E94F37] text-[#E94F37] shadow-lg shadow-[#E94F37]/20'
                          : 'bg-white/5 border-white/10 text-[#6E8AA8] hover:border-[#E94F37]/40'
                      }`}
                    >
                      ▼ SELL
                    </button>
                  </div>
                </Field>

                {/* Open / Close */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Open Time" required>
                    <input
                      type="datetime-local"
                      value={openDate}
                      onChange={(e) => setOpenDate(e.target.value)}
                      className="input"
                    />
                  </Field>
                  <Field label="Close Time">
                    <input
                      type="datetime-local"
                      value={closeDate}
                      onChange={(e) => setCloseDate(e.target.value)}
                      className="input"
                    />
                  </Field>
                </div>

                {/* TF */}
                <Field label="Timeframe">
                  <div className="flex flex-wrap gap-1.5">
                    {TIMEFRAMES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTf(t)}
                        className={`px-3 py-1.5 rounded font-mono text-[11px] font-semibold border transition-all ${
                          tf === t
                            ? 'bg-[#0094C6]/15 border-[#0094C6] text-[#0094C6]'
                            : 'bg-white/5 border-white/10 text-[#6E8AA8] hover:border-white/20'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </Field>
              </>
            )}

            {step === 2 && (
              <>
                {/* Lots */}
                <Field label="Lots / Volume" required>
                  <input
                    type="number"
                    step="0.01"
                    value={lots}
                    onChange={(e) => setLots(e.target.value)}
                    placeholder="0.10"
                    className="input"
                  />
                </Field>

                {/* Prices grid */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Entry Price" required>
                    <input
                      type="number"
                      step="any"
                      value={entry}
                      onChange={(e) => setEntry(e.target.value)}
                      placeholder="1.08750"
                      className="input"
                    />
                  </Field>
                  <Field label="Exit / Close Price" required>
                    <input
                      type="number"
                      step="any"
                      value={exitPrice}
                      onChange={(e) => setExitPrice(e.target.value)}
                      placeholder="1.08920"
                      className="input"
                    />
                  </Field>
                  <Field label="Stop Loss">
                    <input
                      type="number"
                      step="any"
                      value={sl}
                      onChange={(e) => setSl(e.target.value)}
                      placeholder="1.08600"
                      className="input"
                    />
                  </Field>
                  <Field label="Take Profit">
                    <input
                      type="number"
                      step="any"
                      value={tp}
                      onChange={(e) => setTp(e.target.value)}
                      placeholder="1.09000"
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
                <div className="rounded-xl border border-[#0094C6]/30 bg-gradient-to-br from-[#0094C6]/8 via-[#0094C6]/3 to-transparent p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator size={12} className="text-[#0094C6]" />
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#0094C6]">Auto-calculated</div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Stat label="R-Multiple" value={calc.r !== null ? `${calc.r >= 0 ? '+' : ''}${calc.r.toFixed(2)}R` : '—'} highlight={calc.r !== null && calc.r > 0} negative={calc.r !== null && calc.r < 0} />
                    <Stat label="Net %" value={`${calc.netPct >= 0 ? '+' : ''}${(calc.netPct * 100).toFixed(2)}%`} highlight={calc.netPct > 0} negative={calc.netPct < 0} />
                    <Stat label="Total Net" value={`${calc.totalNet >= 0 ? '+$' : '-$'}${Math.abs(calc.totalNet).toFixed(2)}`} highlight={calc.totalNet > 0} negative={calc.totalNet < 0} />
                    <Stat label="Balance After" value={`$${(lastBalance + calc.totalNet).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="text-center mb-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F4A261]/10 border border-[#F4A261]/30">
                    <Link2 size={11} className="text-[#F4A261]" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[#F4A261]">Optional</span>
                  </div>
                </div>

                <Field label="CHART BEFORE — TradingView link">
                  <input
                    type="url"
                    value={chartBefore}
                    onChange={(e) => setChartBefore(e.target.value)}
                    placeholder="https://www.tradingview.com/x/ABC123/"
                    className="input"
                  />
                  <div className="mt-1 text-[10px] text-[#4A6080] font-mono">
                    Snapshot από το TradingView πριν το trade. Άφησε κενό αν δεν έχεις.
                  </div>
                </Field>

                <Field label="CHART AFTER — TradingView link">
                  <input
                    type="url"
                    value={chartAfter}
                    onChange={(e) => setChartAfter(e.target.value)}
                    placeholder="https://www.tradingview.com/x/XYZ789/"
                    className="input"
                  />
                  <div className="mt-1 text-[10px] text-[#4A6080] font-mono">
                    Snapshot μετά το κλείσιμο του trade.
                  </div>
                </Field>

                {/* Final summary */}
                <div className="rounded-xl border border-white/10 bg-[#050B16]/60 p-4 space-y-2">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#4A6080]">Trade Summary</div>
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-xs text-white">
                      <span className={direction === 'BUY' ? 'text-[#00897B]' : 'text-[#E94F37]'}>{direction === 'BUY' ? '▲' : '▼'} {direction}</span> {lots || '—'} lots {symbol || '—'}
                    </div>
                    <div className={`font-display font-bold text-lg ${calc.totalNet >= 0 ? 'text-[#00897B]' : 'text-[#E94F37]'}`}>
                      {calc.totalNet >= 0 ? '+' : '-'}${Math.abs(calc.totalNet).toFixed(2)}
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-[#4A6080]">
                    {entry || '—'} → {exitPrice || '—'} · {calc.r !== null ? `${calc.r >= 0 ? '+' : ''}${calc.r.toFixed(2)}R` : '—'} · {(calc.netPct * 100).toFixed(2)}%
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 sm:px-7 py-4 bg-[#050B16]/40 border-t border-white/5 flex items-center justify-between gap-3">
            <button
              onClick={() => step > 1 ? setStep((s) => (s - 1) as Step) : onClose()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono font-semibold uppercase tracking-wider text-white/70 transition-all"
            >
              <ArrowLeft size={11} /> {step > 1 ? 'BACK' : 'CANCEL'}
            </button>

            {step < 3 ? (
              <button
                onClick={() => setStep((s) => (s + 1) as Step)}
                disabled={(step === 1 && !canGoNext1) || (step === 2 && !canGoNext2)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-gradient-to-br from-[#0094C6] to-[#005377] hover:from-[#00B4D8] hover:to-[#0094C6] disabled:from-white/10 disabled:to-white/5 disabled:text-white/30 disabled:cursor-not-allowed text-[11px] font-mono font-semibold uppercase tracking-wider text-white shadow-lg shadow-[#0094C6]/20 transition-all"
              >
                NEXT <ArrowRight size={11} />
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-gradient-to-br from-[#00897B] to-[#005A50] hover:from-[#00A99A] hover:to-[#00897B] text-[11px] font-mono font-semibold uppercase tracking-wider text-white shadow-lg shadow-[#00897B]/30 transition-all"
              >
                <Save size={11} /> SAVE TRADE
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ===== HELPERS =====

function toLocalDT(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Field({ label, required, compact, children }: { label: string; required?: boolean; compact?: boolean; children: React.ReactNode }) {
  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      <label className="block font-mono text-[10px] uppercase tracking-widest text-[#6E8AA8]">
        {label} {required && <span className="text-[#F4A261]">*</span>}
      </label>
      {children}
    </div>
  );
}

function ScreenshotScanner({ onExtracted }: { onExtracted: (p: Record<string, unknown>) => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const extract = trpc.journal.extractTradeFromScreenshot.useMutation();

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image too large (max 10MB)');
      return;
    }
    setBusy(true);
    setDone(false);
    try {
      const dataUrl = await readFile(file);
      setPreview(dataUrl);
      const result = await extract.mutateAsync({ dataUrl });
      const extracted = result?.extracted as Record<string, unknown> | undefined;
      if (!extracted) throw new Error('No fields extracted');
      onExtracted(extracted);
      setDone(true);
      toast.success('Trade fields extracted from screenshot');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Extraction failed';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-[#0094C6]/40 bg-[#0094C6]/5 p-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
      <div className="flex items-center gap-3">
        {preview ? (
          <img src={preview} alt="preview" className="w-14 h-14 rounded-md object-cover border border-white/10" />
        ) : (
          <div className="w-14 h-14 rounded-md bg-[#050B16] border border-white/10 flex items-center justify-center text-[#0094C6]">
            <ImagePlus size={18} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-display text-sm font-bold text-white flex items-center gap-2">
            Scan MT5 Screenshot
            {busy && <Loader2 size={12} className="animate-spin text-[#0094C6]" />}
            {done && !busy && <Check size={12} className="text-[#00897B]" />}
          </div>
          <div className="font-mono text-[10px] text-[#6E8AA8]">
            Upload a trade screenshot and we will auto-fill the form with AI.
          </div>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="px-3 py-2 rounded-lg bg-gradient-to-br from-[#0094C6] to-[#005377] hover:from-[#00B4D8] hover:to-[#0094C6] disabled:opacity-50 text-[10px] font-mono font-semibold uppercase tracking-wider text-white shadow shadow-[#0094C6]/20 transition-all"
        >
          {busy ? 'Scanning...' : preview ? 'Re-scan' : 'Upload'}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight, negative }: { label: string; value: string; highlight?: boolean; negative?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-[#4A6080] mb-0.5">{label}</div>
      <div className={`font-display text-sm font-bold tracking-tight ${
        highlight ? 'text-[#00897B]' : negative ? 'text-[#E94F37]' : 'text-white/90'
      }`}>{value}</div>
    </div>
  );
}
