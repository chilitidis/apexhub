// PreTradeChecklist.tsx
// ----------------------------------------------------------------------------
// Strict pre-trade gate. 20 questions, 5 categories, accordion layout.
// "Continue → LOG OPEN TRADE" is disabled until every checkbox is true.
// On confirm we persist the run, close the checklist, and bubble up so the
// parent can immediately open AddTradeModal in OPEN status mode.
// ----------------------------------------------------------------------------

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ShieldAlert,
  Wind,
  TrendingUp,
  Target,
  Clock,
  Brain,
} from "lucide-react";
import {
  CHECKLIST_CATEGORIES,
  CHECKLIST_QUESTIONS,
  CHECKLIST_TOTAL,
  countConfirmed,
  isComplete,
  persistRun,
  questionsInCategory,
  type ChecklistCategoryId,
} from "@/lib/preTradeChecklist";

interface PreTradeChecklistProps {
  onConfirm: () => void;
  onClose: () => void;
}

// Category-id → lucide icon. Keeps the JSX clean below.
const CATEGORY_ICONS: Record<ChecklistCategoryId, React.ComponentType<any>> = {
  context: TrendingUp,
  technical: Wind,
  plan: Target,
  timing: Clock,
  mind: Brain,
};

export default function PreTradeChecklist({
  onConfirm,
  onClose,
}: PreTradeChecklistProps) {
  const { t, lang } = useLanguage();
  const bi = (en: string, gr: string) => (lang !== "en" ? gr : en);
  // Answers map: question id → checked?  We keep it in a single state object
  // so React batches updates and there is no risk of stale category state.
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [openCategory, setOpenCategory] = useState<ChecklistCategoryId | null>(
    "context",
  );
  const [startedAt] = useState(() => Date.now());

  // Pre-compute totals so the footer + per-category badges stay in sync.
  const confirmedCount = useMemo(() => countConfirmed(answers), [answers]);
  const ready = confirmedCount === CHECKLIST_TOTAL;

  // Strict mode: clicking continue only fires when ALL questions are true.
  const handleContinue = () => {
    if (!isComplete(answers)) return;
    persistRun({
      startedAt,
      completedAt: Date.now(),
      answers,
      allConfirmed: true,
    });
    onConfirm();
  };

  const toggleAnswer = (id: string) => {
    setAnswers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleCategory = (id: ChecklistCategoryId) => {
    setOpenCategory(prev => (prev === id ? null : id));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-stretch sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-[#0A0A0B] border border-white/10 rounded-none sm:rounded-2xl shadow-2xl my-0 max-h-[100dvh] sm:max-h-[88vh] overflow-hidden flex flex-col"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-white/8 bg-gradient-to-br from-[#121214] to-[#0A0A0B] shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#C9A24A]/15 flex items-center justify-center shrink-0">
              <ShieldAlert size={18} className="text-[#C9A24A]" />
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl text-[#F2EFE8]">
                {bi("Pre-Trade Check","Έλεγχος πριν το trade")}
              </h2>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#8E8A82] mt-1">
                {t("chk.strictMode")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8E8A82] hover:text-white transition-colors p-1"
            aria-label="Close checklist"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Progress bar ───────────────────────────────────────────────── */}
        <div className="px-5 sm:px-6 pt-3 pb-2 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8A82]">
              {bi("Progress","Πρόοδος")}
            </span>
            <span
              className={`font-mono text-xs font-semibold ${
                ready ? "text-[#3FB68B]" : "text-white"
              }`}
            >
              {confirmedCount} / {CHECKLIST_TOTAL}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/8 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                ready ? "bg-[#3FB68B]" : "bg-[#C9A24A]"
              }`}
              initial={{ width: 0 }}
              animate={{
                width: `${(confirmedCount / CHECKLIST_TOTAL) * 100}%`,
              }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>

        {/* ── Category accordions ────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-3 space-y-2.5">
          {CHECKLIST_CATEGORIES.map(category => {
            const questions = questionsInCategory(category.id);
            const confirmedInCat = questions.filter(
              q => answers[q.id] === true,
            ).length;
            const total = questions.length;
            const isOpen = openCategory === category.id;
            const Icon = CATEGORY_ICONS[category.id];

            return (
              <div
                key={category.id}
                className="border border-white/8 rounded-xl bg-[#121214]/50 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${category.accent}1f` }}
                    >
                      <Icon size={16} style={{ color: category.accent }} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-['Inter'] text-sm font-semibold text-white truncate">
                        {category.title}
                      </div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-[#8E8A82] truncate">
                        {category.subtitle}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded ${
                        confirmedInCat === total
                          ? "bg-[#3FB68B]/20 text-[#3FB68B]"
                          : "bg-white/8 text-[#8E8A82]"
                      }`}
                    >
                      {confirmedInCat}/{total}
                    </span>
                    {isOpen ? (
                      <ChevronUp size={16} className="text-[#8E8A82]" />
                    ) : (
                      <ChevronDown size={16} className="text-[#8E8A82]" />
                    )}
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-2 border-t border-white/5">
                        {questions.map(q => {
                          const checked = answers[q.id] === true;
                          return (
                            <button
                              key={q.id}
                              type="button"
                              onClick={() => toggleAnswer(q.id)}
                              className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all ${
                                checked
                                  ? "bg-[#3FB68B]/10 border border-[#3FB68B]/30"
                                  : "bg-white/[0.02] border border-white/8 hover:border-white/20"
                              }`}
                            >
                              <div
                                className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all ${
                                  checked
                                    ? "bg-[#3FB68B] border-[#3FB68B]"
                                    : "bg-transparent border border-white/20"
                                }`}
                              >
                                {checked && (
                                  <CheckCircle2
                                    size={14}
                                    className="text-white"
                                    strokeWidth={3}
                                  />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div
                                  className={`text-sm leading-snug ${
                                    checked
                                      ? "text-white"
                                      : "text-white/85"
                                  }`}
                                >
                                  {q.text}
                                </div>
                                <div
                                  className={`text-xs leading-relaxed mt-1 ${
                                    checked
                                      ? "text-[#8E8A82]"
                                      : "text-[#8E8A82]"
                                  }`}
                                >
                                  {q.hint}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* ── Sticky footer ─────────────────────────────────────────────── */}
        <div className="border-t border-white/8 bg-[#0A0A0B] px-5 sm:px-6 py-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                ready ? "bg-[#3FB68B] animate-pulse" : "bg-[#8E8A82]"
              }`}
            />
            <div className="font-mono text-[11px] uppercase tracking-widest">
              {ready ? (
                <span className="text-[#3FB68B] font-semibold">
                  {t("chk.allConfirmed")}
                </span>
              ) : (
                <span className="text-[#8E8A82]">
                  {CHECKLIST_TOTAL - confirmedCount} {t("chk.remaining")}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-white/15 text-[#F2EFE8]/80 hover:text-[#F2EFE8] hover:border-white/30 text-[13px] transition-colors"
            >
              {bi("Abort","Ακύρωση")}
            </button>
            <button
              type="button"
              disabled={!ready}
              onClick={handleContinue}
              className={`px-5 py-2 rounded-lg text-[13px] font-medium transition-all ${
                ready
                  ? "btn-gold shadow-lg shadow-[#C9A24A]/20"
                  : "bg-white/8 text-[#8E8A82] cursor-not-allowed"
              }`}
            >
              {bi("Continue → Log trade","Συνέχεια → Καταχώριση trade")}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
