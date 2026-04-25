// NewMonthModal — Lets the user spin up a brand-new empty month.
// Visual: dark glass card consistent with the AddTrade modal aesthetic.

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CalendarPlus, AlertCircle, ArrowRight } from 'lucide-react';

const MONTHS_GR = [
  'ΙΑΝΟΥΑΡΙΟΣ', 'ΦΕΒΡΟΥΑΡΙΟΣ', 'ΜΑΡΤΙΟΣ', 'ΑΠΡΙΛΙΟΣ', 'ΜΑΪΟΣ', 'ΙΟΥΝΙΟΣ',
  'ΙΟΥΛΙΟΣ', 'ΑΥΓΟΥΣΤΟΣ', 'ΣΕΠΤΕΜΒΡΙΟΣ', 'ΟΚΤΩΒΡΙΟΣ', 'ΝΟΕΜΒΡΙΟΣ', 'ΔΕΚΕΜΒΡΙΟΣ',
];

// Build the canonical YYYY-MM month-key the rest of the app uses to dedupe
// snapshots. Exported so callers can pre-check duplicates if they want.
export function buildMonthKey(monthName: string, yearFull: string): string {
  const idx = MONTHS_GR.indexOf(monthName);
  const padded = (idx + 1).toString().padStart(2, '0');
  return `${yearFull}-${padded}`;
}

export interface NewMonthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Existing month-keys (e.g. ["2026-04", "2026-03"]) used to block dupes. */
  existingKeys: string[];
  /** Suggested starting balance prefilled into the input. */
  defaultStarting?: number;
  /** Called with the user's choices once they confirm. */
  onConfirm: (input: {
    monthName: string;
    yearFull: string;
    starting: number;
  }) => Promise<void> | void;
  /** Called when the user clicks "Open" on a duplicate month. */
  onOpenExisting?: (key: string) => void;
}

export default function NewMonthModal({
  isOpen,
  onClose,
  existingKeys,
  defaultStarting,
  onConfirm,
  onOpenExisting,
}: NewMonthModalProps) {
  // Prefill with the next month after "now" so the user can just hit Enter.
  const today = useMemo(() => new Date(), []);
  const [monthName, setMonthName] = useState<string>(() => MONTHS_GR[today.getMonth()]);
  const [yearFull, setYearFull] = useState<string>(String(today.getFullYear()));
  const [starting, setStarting] = useState<string>(() =>
    defaultStarting && defaultStarting > 0 ? String(Math.round(defaultStarting)) : '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset whenever the modal re-opens so stale state doesn't leak in.
  useEffect(() => {
    if (!isOpen) return;
    setMonthName(MONTHS_GR[today.getMonth()]);
    setYearFull(String(today.getFullYear()));
    setStarting(defaultStarting && defaultStarting > 0 ? String(Math.round(defaultStarting)) : '');
    setError(null);
    setSubmitting(false);
  }, [isOpen, defaultStarting, today]);

  const monthKey = buildMonthKey(monthName, yearFull);
  const duplicate = existingKeys.includes(monthKey);
  const startingNum = Number(starting.replace(/[^0-9.\-]/g, ''));
  const startingValid = Number.isFinite(startingNum) && startingNum > 0;
  const yearValid = /^\d{4}$/.test(yearFull) && Number(yearFull) >= 2000 && Number(yearFull) <= 2100;
  const canSubmit = !submitting && startingValid && yearValid && !duplicate;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm({ monthName, yearFull, starting: startingNum });
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Αποτυχία δημιουργίας μήνα');
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={() => !submitting && onClose()}
          />
          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-[#0D1E35] border border-white/10 rounded-2xl shadow-2xl p-6"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#0077B6]/15 border border-[#0077B6]/30 flex items-center justify-center">
                  <CalendarPlus size={16} className="text-[#0094C6]" />
                </div>
                <div>
                  <div className="font-['Space_Grotesk'] font-semibold text-white text-base">
                    Νέος Μήνας
                  </div>
                  <div className="font-mono text-[10px] text-[#4A6080] uppercase tracking-wider mt-0.5">
                    Ξεκινήστε με μηδενικά trades
                  </div>
                </div>
              </div>
              <button
                onClick={() => !submitting && onClose()}
                className="text-[#4A6080] hover:text-white transition-colors"
                disabled={submitting}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Month name */}
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-widest text-[#4A6080] mb-1.5">
                  Μήνας
                </label>
                <select
                  value={monthName}
                  onChange={(e) => setMonthName(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-[#070F1C] border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-['Space_Grotesk'] focus:border-[#0094C6] focus:outline-none transition-colors"
                >
                  {MONTHS_GR.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Year */}
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-widest text-[#4A6080] mb-1.5">
                  Έτος
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={yearFull}
                  onChange={(e) => setYearFull(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  disabled={submitting}
                  min={2000}
                  max={2100}
                  className="w-full bg-[#070F1C] border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-[#0094C6] focus:outline-none transition-colors"
                />
              </div>

              {/* Starting balance */}
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-widest text-[#4A6080] mb-1.5">
                  Starting Balance ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-[#4A6080]">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="50000"
                    value={starting}
                    onChange={(e) => setStarting(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submit()}
                    disabled={submitting}
                    autoFocus
                    className="w-full bg-[#070F1C] border border-white/10 rounded-lg pl-7 pr-3 py-2 text-white font-mono text-sm focus:border-[#0094C6] focus:outline-none transition-colors"
                  />
                </div>
                {defaultStarting && defaultStarting > 0 && (
                  <button
                    type="button"
                    onClick={() => setStarting(String(Math.round(defaultStarting)))}
                    className="mt-1.5 font-mono text-[9px] uppercase tracking-wider text-[#0094C6] hover:text-white transition-colors"
                  >
                    Χρήση τρέχοντος balance: ${Math.round(defaultStarting).toLocaleString('el-GR')}
                  </button>
                )}
              </div>

              {/* Duplicate warning */}
              {duplicate && (
                <div className="flex flex-col gap-2 bg-[#F4A261]/10 border border-[#F4A261]/30 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={14} className="text-[#F4A261] mt-0.5 shrink-0" />
                    <div className="font-mono text-[10px] text-[#F4A261] leading-relaxed">
                      Υπάρχει ήδη μήνας {monthName} {yearFull}.
                    </div>
                  </div>
                  {onOpenExisting && (
                    <button
                      onClick={() => {
                        onOpenExisting(monthKey);
                        onClose();
                      }}
                      className="self-end font-mono text-[9px] uppercase tracking-wider text-[#0D1E35] bg-[#F4A261] hover:bg-[#F4A261]/80 transition-colors px-3 py-1.5 rounded"
                    >
                      Άνοιγμα υπάρχοντος
                    </button>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 bg-[#E94F37]/10 border border-[#E94F37]/30 rounded-lg p-3">
                  <AlertCircle size={14} className="text-[#E94F37] mt-0.5 shrink-0" />
                  <div className="font-mono text-[10px] text-[#E94F37]">{error}</div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => !submitting && onClose()}
                disabled={submitting}
                className="font-mono text-[10px] uppercase tracking-wider text-[#4A6080] hover:text-white transition-colors px-3 py-2 rounded-lg border border-white/8 hover:border-white/20 disabled:opacity-50"
              >
                Ακύρωση
              </button>
              <button
                onClick={submit}
                disabled={!canSubmit}
                className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-white bg-[#0077B6] hover:bg-[#0094C6] transition-colors px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Δημιουργία…' : (
                  <>
                    Δημιουργία <ArrowRight size={11} />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
