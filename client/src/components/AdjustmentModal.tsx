// AdjustmentModal — add a withdrawal or deposit to the active month.
// The created Adjustment shifts the closing balance + equity curve, but is
// excluded from trade-level KPIs (win rate, R-multiple, profit factor).

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDownToLine, ArrowUpToLine, Calendar, Euro, X } from 'lucide-react';
import type { Adjustment } from '@/lib/trading';

interface AdjustmentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (adj: Adjustment) => void;
  /** ISO date (YYYY-MM-DD) used as the default. Falls back to today. */
  defaultDate?: string;
  /** Pre-fill values when editing an existing adjustment. */
  initial?: Adjustment;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function AdjustmentModal({
  open,
  onClose,
  onSave,
  defaultDate,
  initial,
}: AdjustmentModalProps) {
  const [type, setType] = useState<'withdrawal' | 'deposit'>(
    initial?.type ?? 'withdrawal',
  );
  const [amount, setAmount] = useState<string>(
    initial ? String(initial.amount) : '',
  );
  const [date, setDate] = useState<string>(
    initial?.date ?? defaultDate ?? todayIso(),
  );
  const [note, setNote] = useState<string>(initial?.note ?? '');
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setType(initial?.type ?? 'withdrawal');
    setAmount(initial ? String(initial.amount) : '');
    setDate(initial?.date ?? defaultDate ?? todayIso());
    setNote(initial?.note ?? '');
    // focus on amount when modal opens
    const t = setTimeout(() => amountRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open, initial, defaultDate]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const amountNum = Math.abs(parseFloat(amount.replace(',', '.')) || 0);
  const canSave = amountNum > 0 && date.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const adj: Adjustment = {
      id: initial?.id ?? `adj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      type,
      amount: amountNum,
      note: note.trim() || undefined,
    };
    onSave(adj);
    onClose();
  };

  const accent = type === 'withdrawal' ? '#E94F37' : '#00897B';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
          onClick={onClose}
          data-testid="adjustment-modal-backdrop"
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-[#0D1E35] border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-2 sm:my-0"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b border-white/10"
              style={{ background: `linear-gradient(135deg, ${accent}22 0%, transparent 70%)` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: `${accent}33`, color: accent }}
                >
                  {type === 'withdrawal' ? (
                    <ArrowUpToLine size={18} />
                  ) : (
                    <ArrowDownToLine size={18} />
                  )}
                </div>
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#4A6080]">
                    {initial ? 'Edit · Cash Movement' : 'Add · Cash Movement'}
                  </div>
                  <div className="font-['Space_Grotesk'] font-semibold text-white text-base">
                    {type === 'withdrawal' ? 'Ανάληψη' : 'Κατάθεση'}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-[#4A6080] hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/5"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-5">
              {/* Type toggle */}
              <div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-[#4A6080] mb-2">
                  Type
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setType('withdrawal')}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg font-mono text-[11px] uppercase tracking-wider font-semibold transition-all border ${
                      type === 'withdrawal'
                        ? 'bg-[#E94F37]/15 border-[#E94F37]/60 text-[#E94F37]'
                        : 'bg-[#0A1628] border-white/8 text-[#4A6080] hover:text-white/70 hover:border-white/15'
                    }`}
                  >
                    <ArrowUpToLine size={13} />
                    Withdrawal
                  </button>
                  <button
                    onClick={() => setType('deposit')}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg font-mono text-[11px] uppercase tracking-wider font-semibold transition-all border ${
                      type === 'deposit'
                        ? 'bg-[#00897B]/15 border-[#00897B]/60 text-[#00897B]'
                        : 'bg-[#0A1628] border-white/8 text-[#4A6080] hover:text-white/70 hover:border-white/15'
                    }`}
                  >
                    <ArrowDownToLine size={13} />
                    Deposit
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="font-mono text-[9px] uppercase tracking-widest text-[#4A6080] mb-2 flex items-center gap-1.5">
                  <Euro size={11} />
                  Amount
                </label>
                <div className="relative">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-base"
                    style={{ color: accent }}
                  >
                    {type === 'withdrawal' ? '−' : '+'}
                  </span>
                  <input
                    ref={amountRef}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-[#0A1628] border border-white/10 rounded-lg pl-9 pr-3 py-3 font-mono text-base text-white focus:outline-none focus:border-[#0077B6]/60 transition-colors"
                  />
                </div>
                <div className="mt-1.5 font-mono text-[10px] text-[#4A6080]">
                  Σύμβολο νομίσματος ακολουθεί τη ρύθμιση του λογαριασμού.
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="font-mono text-[9px] uppercase tracking-widest text-[#4A6080] mb-2 flex items-center gap-1.5">
                  <Calendar size={11} />
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-[#0A1628] border border-white/10 rounded-lg px-3 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-[#0077B6]/60 transition-colors"
                />
              </div>

              {/* Note */}
              <div>
                <label className="font-mono text-[9px] uppercase tracking-widest text-[#4A6080] mb-2 block">
                  Note (optional)
                </label>
                <input
                  type="text"
                  maxLength={64}
                  placeholder='π.χ. "Μισθός", "Broker payout"'
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-[#0A1628] border border-white/10 rounded-lg px-3 py-2.5 font-mono text-sm text-white placeholder:text-[#4A6080] focus:outline-none focus:border-[#0077B6]/60 transition-colors"
                />
              </div>

              {/* Helper line */}
              <div
                className="rounded-lg px-3 py-2.5 text-[10px] font-mono leading-relaxed"
                style={{ background: `${accent}10`, color: accent }}
              >
                {type === 'withdrawal'
                  ? 'Η ανάληψη αφαιρείται από το closing balance και εμφανίζεται στο equity curve, αλλά δεν επηρεάζει τα trade KPIs (win rate, profit factor).'
                  : 'Η κατάθεση προστίθεται στο closing balance και εμφανίζεται στο equity curve, αλλά δεν επηρεάζει τα trade KPIs.'}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/10 bg-[#0A1628]/40">
              <button
                onClick={onClose}
                className="px-3 py-2 rounded-lg font-mono text-[10px] uppercase tracking-wider text-[#4A6080] hover:text-white border border-white/8 hover:border-white/20 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-wider font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed text-white"
                style={{
                  background: canSave ? accent : '#1A2942',
                  boxShadow: canSave ? `0 0 18px ${accent}60` : 'none',
                }}
                data-testid="adjustment-save-button"
              >
                {initial ? 'Save Changes' : 'Add ' + (type === 'withdrawal' ? 'Withdrawal' : 'Deposit')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
