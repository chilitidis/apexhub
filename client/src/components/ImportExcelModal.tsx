// ImportExcelModal — Drag & drop or pick an Ultimate Trading Journal .xlsx file and create
// a new month from it. Shows a quick preview of what was parsed before the
// user confirms the import.

import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, FileSpreadsheet, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { importFromExcel } from '@/lib/importExcel';
import type { TradingData } from '@/lib/trading';
import { fmtUSDnoSign } from '@/lib/trading';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<{ data: TradingData; warnings: string[]; filename: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      toast.error(t('ie.errChooseXlsx'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('ie.errTooLarge'));
      return;
    }
    setBusy(true);
    try {
      const result = await importFromExcel(file);
      setParsed({ ...result, filename: file.name });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('ie.errReadFailed');
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
    toast.success(t('ie.toastImported').replace('{month}', parsed.data.meta.month_name).replace('{year}', parsed.data.meta.year_full));
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
          className="relative w-full max-w-xl bg-[#121214] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#C9A24A]/15 border border-[#C9A24A]/30 flex items-center justify-center">
                <FileSpreadsheet size={15} className="text-[#C9A24A]" />
              </div>
              <div>
                <div className="font-display text-base font-bold text-white tracking-wide">{t('ie.title')}</div>
                <div className="font-mono text-[10px] text-[#8E8A82] uppercase tracking-widest">
                  {t('ie.subtitle')}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-[#8E8A82] hover:text-white transition-colors">
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
                    ? 'border-[#C9A24A] bg-[#C9A24A]/5'
                    : 'border-white/10 hover:border-white/25 bg-[#0A0A0B]/40'
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
                    <Loader2 className="text-[#C9A24A] animate-spin" size={28} />
                    <div className="font-mono text-xs text-[#8E8A82] uppercase tracking-wider">
                      {t('ie.analyzing')}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 mx-auto rounded-xl bg-[#C9A24A]/10 border border-[#C9A24A]/20 flex items-center justify-center mb-3">
                      <Upload size={22} className="text-[#C9A24A]" />
                    </div>
                    <div className="font-display text-sm font-bold text-white mb-1">
                      {t('ie.dropHint')}
                    </div>
                    <div className="font-mono text-[10px] text-[#8E8A82]">
                      {t('ie.supports')}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-white/10 bg-[#0A0A0B]/60 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileSpreadsheet size={14} className="text-[#C9A24A]" />
                    <div className="font-mono text-xs text-white/80 truncate">{parsed.filename}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <Stat label={t('ie.statMonth')} value={`${parsed.data.meta.month_name.slice(0, 3)} '${parsed.data.meta.year_full.slice(2)}`} />
                    <Stat label={t('ie.statStarting')} value={fmtUSDnoSign(kpis?.starting || 0)} />
                    <Stat label={t('ie.statTrades')} value={String(trades.length)} />
                    <Stat label={t('ie.statEnding')} value={fmtUSDnoSign(kpis?.ending || 0)} valueClass={kpis && kpis.net_result >= 0 ? 'text-[#3FB68B]' : 'text-[#E5484D]'} />
                  </div>
                </div>

                {parsed.warnings.length > 0 && (
                  <div className="rounded-lg border border-[#C9A24A]/30 bg-[#C9A24A]/5 p-3 flex gap-2">
                    <AlertTriangle size={14} className="text-[#C9A24A] shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs font-mono text-[#C9A24A]/90">
                      {parsed.warnings.map((w, i) => <div key={i}>{w}</div>)}
                    </div>
                  </div>
                )}

                {isDuplicate && (
                  <div className="rounded-lg border border-[#E5484D]/30 bg-[#E5484D]/5 p-3 text-xs font-mono text-[#E5484D]/90 flex items-center gap-2">
                    <AlertTriangle size={14} />
                    <span>
                      {t('ie.duplicate').replace('{month}', parsed.data.meta.month_name).replace('{year}', parsed.data.meta.year_full)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-[#0A0A0B]/40 border-t border-white/5 flex items-center justify-between gap-3">
            <button
              onClick={() => parsed ? setParsed(null) : onClose()}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono font-semibold uppercase tracking-wider text-white/70 transition-all"
            >
              {parsed ? t('ie.otherFile') : t('ie.cancel')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!parsed || trades.length === 0}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-[11px] font-mono font-semibold uppercase tracking-wider text-white shadow-lg transition-all disabled:from-white/10 disabled:to-white/5 disabled:text-white/30 disabled:cursor-not-allowed ${
                isDuplicate && !confirmingOverwrite
                  ? 'bg-gradient-to-br from-[#E5484D] to-[#A8341F] hover:from-[#FF6B52] hover:to-[#E5484D] shadow-[#E5484D]/30'
                  : isDuplicate && confirmingOverwrite
                  ? 'bg-gradient-to-br from-[#C9A24A] to-[#C97D38] hover:from-[#FFB572] hover:to-[#C9A24A] shadow-[#C9A24A]/30'
                  : 'bg-gradient-to-br from-[#3FB68B] to-[#005A50] hover:from-[#00A99A] hover:to-[#3FB68B] shadow-[#3FB68B]/30'
              }`}
            >
              <Check size={11} /> {
                isDuplicate && !confirmingOverwrite ? t('ie.replacing') :
                isDuplicate && confirmingOverwrite ? t('ie.confirmReplace') :
                t('ie.import')
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
    <div className="rounded-lg bg-[#121214] border border-white/5 px-3 py-2.5">
      <div className="font-mono text-[9px] uppercase tracking-widest text-[#8E8A82] mb-0.5">{label}</div>
      <div className={`font-display text-sm font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}
