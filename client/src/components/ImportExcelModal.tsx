// ImportExcelModal — Drag & drop or pick an APEXHUB .xlsx file and create
// a new month from it. Shows a quick preview of what was parsed before the
// user confirms the import.

import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, FileSpreadsheet, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { importFromExcel } from '@/lib/importExcel';
import type { TradingData } from '@/lib/trading';
import { fmtUSDnoSign } from '@/lib/trading';
import { toast } from 'sonner';

interface Props {
  existingMonthKeys: string[];   // YYYY-MM
  onImport: (data: TradingData) => void;
  onClose: () => void;
}

function buildKey(monthName: string, yearFull: string): string {
  const order = ['ΙΑΝΟΥΑΡΙΟΣ','ΦΕΒΡΟΥΑΡΙΟΣ','ΜΑΡΤΙΟΣ','ΑΠΡΙΛΙΟΣ','ΜΑΙΟΣ','ΙΟΥΝΙΟΣ','ΙΟΥΛΙΟΣ','ΑΥΓΟΥΣΤΟΣ','ΣΕΠΤΕΜΒΡΙΟΣ','ΟΚΤΩΒΡΙΟΣ','ΝΟΕΜΒΡΙΟΣ','ΔΕΚΕΜΒΡΙΟΣ'];
  const norm = monthName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const idx = order.indexOf(norm) + 1;
  return `${yearFull}-${String(idx).padStart(2, '0')}`;
}

export default function ImportExcelModal({ existingMonthKeys, onImport, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<{ data: TradingData; warnings: string[]; filename: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('Παρακαλώ επίλεξε αρχείο .xlsx');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Το αρχείο είναι πολύ μεγάλο (> 10MB)');
      return;
    }
    setBusy(true);
    try {
      const result = await importFromExcel(file);
      setParsed({ ...result, filename: file.name });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Αποτυχία ανάγνωσης';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  const [confirmingOverwrite, setConfirmingOverwrite] = useState(false);

  const handleConfirm = () => {
    if (!parsed) return;
    if (isDuplicate && !confirmingOverwrite) {
      setConfirmingOverwrite(true);
      return;
    }
    onImport(parsed.data);
    toast.success(`Εισήχθη ο μήνας ${parsed.data.meta.month_name} ${parsed.data.meta.year_full}`);
    onClose();
  };

  const monthKey = parsed ? buildKey(parsed.data.meta.month_name, parsed.data.meta.year_full) : '';
  const isDuplicate = monthKey ? existingMonthKeys.includes(monthKey) : false;
  const trades = parsed?.data.trades ?? [];
  const kpis = parsed?.data.kpis;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 20, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-xl bg-[#0D1E35] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0094C6]/15 border border-[#0094C6]/30 flex items-center justify-center">
                <FileSpreadsheet size={15} className="text-[#0094C6]" />
              </div>
              <div>
                <div className="font-display text-base font-bold text-white tracking-wide">IMPORT EXCEL</div>
                <div className="font-mono text-[10px] text-[#4A6080] uppercase tracking-widest">
                  Δημιουργία μήνα από MT5 Excel αρχείο
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-[#4A6080] hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {!parsed ? (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`relative rounded-xl border-2 border-dashed cursor-pointer p-10 text-center transition-all ${
                  dragOver
                    ? 'border-[#00B4D8] bg-[#00B4D8]/5'
                    : 'border-white/10 hover:border-white/25 bg-[#050B16]/40'
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                    e.target.value = '';
                  }}
                />
                {busy ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="text-[#0094C6] animate-spin" size={28} />
                    <div className="font-mono text-xs text-[#4A6080] uppercase tracking-wider">
                      Ανάλυση…
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 mx-auto rounded-xl bg-[#0094C6]/10 border border-[#0094C6]/20 flex items-center justify-center mb-3">
                      <Upload size={22} className="text-[#0094C6]" />
                    </div>
                    <div className="font-display text-sm font-bold text-white mb-1">
                      Σύρε αρχείο .xlsx ή κάνε κλικ για επιλογή
                    </div>
                    <div className="font-mono text-[10px] text-[#4A6080]">
                      Υποστηρίζονται Ultimate/APEXHUB exports + παλιά MT5 templates
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-white/10 bg-[#050B16]/60 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileSpreadsheet size={14} className="text-[#0094C6]" />
                    <div className="font-mono text-xs text-white/80 truncate">{parsed.filename}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <Stat label="MONTH" value={`${parsed.data.meta.month_name.slice(0, 3)} '${parsed.data.meta.year_full.slice(2)}`} />
                    <Stat label="STARTING" value={fmtUSDnoSign(kpis?.starting || 0)} />
                    <Stat label="TRADES" value={String(trades.length)} />
                    <Stat label="ENDING" value={fmtUSDnoSign(kpis?.ending || 0)} valueClass={kpis && kpis.net_result >= 0 ? 'text-[#00897B]' : 'text-[#E94F37]'} />
                  </div>
                </div>

                {parsed.warnings.length > 0 && (
                  <div className="rounded-lg border border-[#F4A261]/30 bg-[#F4A261]/5 p-3 flex gap-2">
                    <AlertTriangle size={14} className="text-[#F4A261] shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs font-mono text-[#F4A261]/90">
                      {parsed.warnings.map((w, i) => <div key={i}>{w}</div>)}
                    </div>
                  </div>
                )}

                {isDuplicate && (
                  <div className="rounded-lg border border-[#E94F37]/30 bg-[#E94F37]/5 p-3 text-xs font-mono text-[#E94F37]/90 flex items-center gap-2">
                    <AlertTriangle size={14} />
                    <span>
                      Υπάρχει ήδη μήνας {parsed.data.meta.month_name} {parsed.data.meta.year_full}. Η εισαγωγή θα τον αντικαταστήσει.
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-[#050B16]/40 border-t border-white/5 flex items-center justify-between gap-3">
            <button
              onClick={() => parsed ? setParsed(null) : onClose()}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono font-semibold uppercase tracking-wider text-white/70 transition-all"
            >
              {parsed ? 'Άλλο αρχείο' : 'Άκυρο'}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!parsed || trades.length === 0}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-[11px] font-mono font-semibold uppercase tracking-wider text-white shadow-lg transition-all disabled:from-white/10 disabled:to-white/5 disabled:text-white/30 disabled:cursor-not-allowed ${
                isDuplicate && !confirmingOverwrite
                  ? 'bg-gradient-to-br from-[#E94F37] to-[#A8341F] hover:from-[#FF6B52] hover:to-[#E94F37] shadow-[#E94F37]/30'
                  : isDuplicate && confirmingOverwrite
                  ? 'bg-gradient-to-br from-[#F4A261] to-[#C97D38] hover:from-[#FFB572] hover:to-[#F4A261] shadow-[#F4A261]/30'
                  : 'bg-gradient-to-br from-[#00897B] to-[#005A50] hover:from-[#00A99A] hover:to-[#00897B] shadow-[#00897B]/30'
              }`}
            >
              <Check size={11} /> {
                isDuplicate && !confirmingOverwrite ? 'ΑΝΤΙΚΑΤΑΣΤΑΣΗ...' :
                isDuplicate && confirmingOverwrite ? 'ΕΠΙΒΕΒΑΙΩΣΗ ΑΝΤΙΚΑΤΑΣΤΑΣΗΣ' :
                'ΕΙΣΑΓΩΓΗ'
              }
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Stat({ label, value, valueClass = 'text-white' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-lg bg-[#0D1E35] border border-white/5 px-3 py-2.5">
      <div className="font-mono text-[9px] uppercase tracking-widest text-[#4A6080] mb-0.5">{label}</div>
      <div className={`font-display text-sm font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}
