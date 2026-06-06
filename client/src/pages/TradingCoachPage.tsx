/**
 * TradingCoachPage — AI Trading Coach for the Titans / APEXHUB strategy.
 *
 * The trader uploads a TradingView screenshot; a vision model reads the chart
 * and returns a fully-structured analysis (score 0-100, verdict, per-criterion
 * checklist, Greek comment + suggestion). We NEVER render raw JSON / base64 —
 * the data url is sent to the server in-flight only and the response is the
 * sanitized, typed CoachAnalysisResult.
 *
 * Shell mirrors PositionCalculator (sidebar + Ocean Depth header).
 */
import React, { useCallback, useRef, useState } from "react";
void React;
import { useLocation } from "wouter";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChartCandlestick,
  Upload,
  ImageIcon,
  Loader2,
  Check,
  X,
  Minus,
  HelpCircle,
  Trash2,
  Lightbulb,
  RefreshCw,
  Info,
} from "lucide-react";
import { AppSidebar, type ViewKey } from "@/components/AppSidebar";
import { useAccounts } from "@/hooks/useJournal";
import { trpc } from "@/lib/trpc";
import {
  COACH_DISCLAIMER,
  scoreToBand,
  type CoachCriterionResult,
  type CriterionStatus,
} from "@shared/tradingCoach";

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB cap on screenshots

// --- status visuals -----------------------------------------------------------

const STATUS_META: Record<
  CriterionStatus,
  { icon: React.ReactNode; color: string; bg: string; label: string }
> = {
  pass: {
    icon: <Check size={13} strokeWidth={3} />,
    color: "#00C896",
    bg: "rgba(0,137,123,0.15)",
    label: "OK",
  },
  warn: {
    icon: <Minus size={13} strokeWidth={3} />,
    color: "#F4A261",
    bg: "rgba(244,162,97,0.15)",
    label: "Οριακό",
  },
  fail: {
    icon: <X size={13} strokeWidth={3} />,
    color: "#E94F37",
    bg: "rgba(233,79,55,0.15)",
    label: "Όχι",
  },
  unknown: {
    icon: <HelpCircle size={13} strokeWidth={3} />,
    color: "#6E8AA8",
    bg: "rgba(110,138,168,0.12)",
    label: "Άγνωστο",
  },
};

const TONE_COLOR: Record<string, string> = {
  profit: "#00C896",
  gold: "#F4A261",
  loss: "#E94F37",
};

const DIRECTION_LABEL: Record<string, string> = {
  long: "LONG",
  short: "SHORT",
  unknown: "—",
};

// --- helpers ------------------------------------------------------------------

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsDataURL(file);
  });
}

type AnalysisData = {
  id: number | null;
  score: number;
  verdict: "suitable" | "marginal" | "unsuitable";
  pair: string;
  timeframe: string;
  direction: "long" | "short" | "unknown";
  comment: string;
  suggestion: string;
  criteria: CoachCriterionResult[];
};

// --- score gauge --------------------------------------------------------------

function ScoreGauge({ score }: { score: number }) {
  const band = scoreToBand(score);
  const color = TONE_COLOR[band.tone] ?? "#0077B6";
  const r = 52;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <div className="relative w-[132px] h-[132px] shrink-0">
      <svg width={132} height={132} className="-rotate-90">
        <circle cx={66} cy={66} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={10} fill="none" />
        <motion.circle
          cx={66}
          cy={66}
          r={r}
          stroke={color}
          strokeWidth={10}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - pct) }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-['Space_Grotesk'] text-3xl font-bold text-white leading-none">
          {score}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#6E8AA8] mt-1">
          / 100
        </span>
      </div>
    </div>
  );
}

// --- main ---------------------------------------------------------------------

export default function TradingCoachPage() {
  const [, setLocation] = useLocation();
  const { accounts } = useAccounts();
  const [view] = useState<ViewKey>("trading-coach");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisData | null>(null);

  const utils = trpc.useUtils();
  const historyQuery = trpc.coach.history.useQuery({ limit: 20 });

  const analyzeMutation = trpc.coach.analyze.useMutation({
    onSuccess: (data) => {
      setResult(data as AnalysisData);
      utils.coach.history.invalidate();
      toast.success("Η ανάλυση ολοκληρώθηκε");
    },
    onError: (err) => {
      toast.error(err.message || "Κάτι πήγε στραβά. Δοκίμασε ξανά.");
    },
  });

  const removeMutation = trpc.coach.remove.useMutation({
    onSuccess: () => utils.coach.history.invalidate(),
    onError: () => toast.error("Δεν διαγράφηκε. Δοκίμασε ξανά."),
  });

  const acceptFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Ανέβασε εικόνα (PNG / JPG) από το TradingView.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Η εικόνα είναι πολύ μεγάλη (μέγιστο 12MB).");
      return;
    }
    try {
      const url = await fileToDataUrl(file);
      setDataUrl(url);
      setPreviewUrl(url);
      setResult(null);
    } catch {
      toast.error("Δεν μπόρεσα να διαβάσω το αρχείο.");
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) acceptFile(file);
    },
    [acceptFile],
  );

  function onRunAnalysis() {
    if (!dataUrl) {
      toast.info("Ανέβασε πρώτα ένα screenshot.");
      return;
    }
    analyzeMutation.mutate({ dataUrl, accountId: 0 });
  }

  function onReset() {
    setPreviewUrl(null);
    setDataUrl(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ---- sidebar shell wiring ----
  function onSetView(v: ViewKey) {
    if (v === "trading-coach") return;
    if (v === "dashboard") return setLocation("/dashboard");
    if (v === "accounts") return setLocation("/accounts");
    if (v === "calendar") return setLocation("/calendar");
    if (v === "position-calc") return setLocation("/position-calculator");
    if (
      v === "pattern-analysis" ||
      v === "pre-market" ||
      v === "market-news" ||
      v === "mindset-coach"
    )
      return openAction(v);
    toast.info("Σύντομα διαθέσιμο");
  }
  function openAction(action: string) {
    const id = accounts[0]?.id;
    if (!id) {
      toast.info("Δημιούργησε πρώτα έναν λογαριασμό");
      return setLocation("/accounts");
    }
    setLocation(`/account/${id}?action=${action}`);
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

  const isAnalyzing = analyzeMutation.isPending;
  const history = historyQuery.data ?? [];

  return (
    <div className="min-h-screen bg-[#0A1628] flex">
      <AppSidebar
        view={view}
        setView={onSetView}
        handlers={sidebarHandlers}
        accountsCount={accounts.length}
      />
      <div className="flex-1 lg:ml-[248px]">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0077B6] to-[#023E8A] flex items-center justify-center">
              <ChartCandlestick size={22} className="text-white" />
            </div>
            <div>
              <h1 className="font-['Space_Grotesk'] text-2xl font-semibold text-white leading-tight">
                Trading Coach
              </h1>
              <p className="font-mono text-[11px] text-[#6E8AA8] uppercase tracking-wider">
                Ανέβασε screenshot από TradingView · αξιολόγηση βάσει στρατηγικής Titans
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* ===== UPLOAD PANEL ===== */}
            <div className="lg:col-span-2 space-y-4">
              <div
                data-testid="coach-dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all overflow-hidden ${
                  dragOver
                    ? "border-[#0094C6] bg-[#0094C6]/10"
                    : "border-white/12 bg-[#0D1E35]/60 hover:border-white/25"
                }`}
              >
                {previewUrl ? (
                  <div className="relative">
                    <img
                      src={previewUrl}
                      alt="Screenshot preview"
                      className="w-full max-h-[280px] object-contain bg-[#0A1628]"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReset();
                      }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
                      aria-label="Αφαίρεση"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="py-12 px-6 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-xl bg-[#0077B6]/15 flex items-center justify-center mb-3">
                      <Upload size={22} className="text-[#0094C6]" />
                    </div>
                    <div className="font-['Space_Grotesk'] text-sm font-semibold text-white mb-1">
                      Σύρε το screenshot εδώ
                    </div>
                    <div className="font-mono text-[10px] text-[#6E8AA8]">
                      ή κάνε κλικ για επιλογή · PNG / JPG · έως 12MB
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  data-testid="coach-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) acceptFile(file);
                  }}
                />
              </div>

              <button
                type="button"
                data-testid="coach-analyze-btn"
                onClick={onRunAnalysis}
                disabled={!dataUrl || isAnalyzing}
                className="w-full h-11 rounded-xl bg-gradient-to-br from-[#0094C6] to-[#005377] text-white font-['Space_Grotesk'] font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:from-[#00B4D8] hover:to-[#0094C6] disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-[#0094C6]/20"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Αναλύω το γράφημα…
                  </>
                ) : (
                  <>
                    <ChartCandlestick size={16} />
                    Ανάλυση Setup
                  </>
                )}
              </button>

              {isAnalyzing && (
                <p className="font-mono text-[10px] text-[#6E8AA8] text-center">
                  Διαβάζω σύμβολο, timeframe, EMA50, επίπεδα, RSI και ώρα — μπορεί να πάρει 15-30s.
                </p>
              )}

              {/* Disclaimer (always shown) */}
              <div className="flex items-start gap-2 rounded-xl bg-[#0D1E35]/60 border border-white/8 p-3">
                <Info size={13} className="text-[#6E8AA8] mt-0.5 shrink-0" />
                <p className="font-mono text-[9.5px] leading-relaxed text-[#6E8AA8]">
                  {COACH_DISCLAIMER}
                </p>
              </div>
            </div>

            {/* ===== RESULT PANEL ===== */}
            <div className="lg:col-span-3">
              <AnimatePresence mode="wait">
                {isAnalyzing ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full min-h-[320px] rounded-2xl bg-[#0D1E35]/60 border border-white/8 flex flex-col items-center justify-center gap-4"
                  >
                    <Loader2 size={32} className="animate-spin text-[#0094C6]" />
                    <span className="font-mono text-[11px] text-[#6E8AA8] uppercase tracking-widest">
                      Ανάλυση σε εξέλιξη…
                    </span>
                  </motion.div>
                ) : result ? (
                  <motion.div
                    key="result"
                    data-testid="coach-result"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl bg-[#0D1E35]/80 border border-white/8 p-5 space-y-5"
                  >
                    <ResultView result={result} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full min-h-[320px] rounded-2xl bg-[#0D1E35]/40 border border-dashed border-white/8 flex flex-col items-center justify-center gap-3 text-center px-6"
                  >
                    <ImageIcon size={28} className="text-[#3A506B]" />
                    <span className="font-['Space_Grotesk'] text-sm text-[#6E8AA8]">
                      Η ανάλυση θα εμφανιστεί εδώ
                    </span>
                    <span className="font-mono text-[10px] text-[#3A506B] max-w-[280px]">
                      Ανέβασε ένα καθαρό screenshot του γραφήματος (με EMA50, επίπεδα, RSI και ορατό timeframe).
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ===== HISTORY ===== */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-['Space_Grotesk'] text-sm font-semibold text-white uppercase tracking-wide">
                Ιστορικό αναλύσεων
              </h2>
              <button
                onClick={() => utils.coach.history.invalidate()}
                className="font-mono text-[10px] text-[#6E8AA8] hover:text-white flex items-center gap-1.5"
              >
                <RefreshCw size={11} /> Ανανέωση
              </button>
            </div>

            {history.length === 0 ? (
              <div className="rounded-xl bg-[#0D1E35]/40 border border-white/8 py-8 text-center">
                <span className="font-mono text-[11px] text-[#6E8AA8]">
                  Δεν υπάρχουν ακόμη αναλύσεις.
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((h) => {
                  const band = scoreToBand(h.score);
                  const color = TONE_COLOR[band.tone] ?? "#0077B6";
                  return (
                    <div
                      key={h.id}
                      data-testid={`coach-history-${h.id}`}
                      className="flex items-center gap-3 rounded-xl bg-[#0D1E35]/70 border border-white/8 px-4 py-3"
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center font-['Space_Grotesk'] font-bold text-sm shrink-0"
                        style={{ background: `${color}22`, color }}
                      >
                        {h.score}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-['Space_Grotesk'] text-sm font-semibold text-white truncate">
                            {h.pair || "—"}
                          </span>
                          {h.timeframe && (
                            <span className="font-mono text-[9px] text-[#6E8AA8] uppercase">
                              {h.timeframe}
                            </span>
                          )}
                          <span
                            className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{ background: `${color}22`, color }}
                          >
                            {band.label}
                          </span>
                        </div>
                        {h.comment && (
                          <p className="font-mono text-[10px] text-[#A8B5C7] truncate mt-0.5">
                            {h.comment}
                          </p>
                        )}
                      </div>
                      <span className="font-mono text-[9px] text-[#6E8AA8] shrink-0 hidden sm:block">
                        {new Date(h.createdAt).toLocaleString("el-GR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <button
                        onClick={() => h.id && removeMutation.mutate({ id: h.id })}
                        className="w-7 h-7 rounded-lg text-[#6E8AA8] hover:text-[#E94F37] hover:bg-[#E94F37]/10 flex items-center justify-center shrink-0"
                        aria-label="Διαγραφή"
                        data-testid={`coach-history-delete-${h.id}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- result view --------------------------------------------------------------

function ResultView({ result }: { result: AnalysisData }) {
  const band = scoreToBand(result.score);
  const color = TONE_COLOR[band.tone] ?? "#0077B6";

  return (
    <>
      {/* Top: gauge + verdict + meta */}
      <div className="flex flex-col sm:flex-row items-center gap-5">
        <ScoreGauge score={result.score} />
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <span
            className="inline-block font-['Space_Grotesk'] font-bold text-sm uppercase tracking-wide px-3 py-1 rounded-lg mb-2"
            style={{ background: `${color}22`, color }}
          >
            {band.label}
          </span>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
            {result.pair && (
              <span className="font-['Space_Grotesk'] text-lg font-bold text-white">
                {result.pair}
              </span>
            )}
            {result.timeframe && (
              <span className="font-mono text-[10px] text-[#6E8AA8] uppercase border border-white/10 rounded px-1.5 py-0.5">
                {result.timeframe}
              </span>
            )}
            <span
              className="font-mono text-[10px] uppercase font-semibold rounded px-1.5 py-0.5"
              style={{
                background:
                  result.direction === "long"
                    ? "rgba(0,137,123,0.18)"
                    : result.direction === "short"
                      ? "rgba(233,79,55,0.18)"
                      : "rgba(110,138,168,0.15)",
                color:
                  result.direction === "long"
                    ? "#00C896"
                    : result.direction === "short"
                      ? "#E94F37"
                      : "#6E8AA8",
              }}
            >
              {DIRECTION_LABEL[result.direction]}
            </span>
          </div>
          {result.comment && (
            <p className="font-mono text-[12px] leading-relaxed text-[#D4DEEA]">
              {result.comment}
            </p>
          )}
        </div>
      </div>

      {/* Criteria checklist */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#6E8AA8] mb-2">
          Κριτήρια στρατηγικής
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {result.criteria.map((c) => {
            const meta = STATUS_META[c.status];
            return (
              <div
                key={c.id}
                data-testid={`coach-criterion-${c.id}`}
                className="flex items-start gap-2.5 rounded-lg bg-[#0A1628]/60 border border-white/6 px-3 py-2"
              >
                <span
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: meta.bg, color: meta.color }}
                >
                  {meta.icon}
                </span>
                <div className="min-w-0">
                  <div className="font-['Space_Grotesk'] text-[12px] font-medium text-white leading-tight">
                    {c.label}
                  </div>
                  {c.note && (
                    <div className="font-mono text-[9.5px] text-[#8DA0B8] leading-snug mt-0.5">
                      {c.note}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Suggestion */}
      {result.suggestion && (
        <div className="flex items-start gap-2.5 rounded-xl bg-[#0077B6]/10 border border-[#0077B6]/25 p-3.5">
          <Lightbulb size={15} className="text-[#7DD3FC] mt-0.5 shrink-0" />
          <div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#7DD3FC] mb-1">
              Πρόταση
            </div>
            <p className="font-mono text-[11.5px] leading-relaxed text-[#D4DEEA]">
              {result.suggestion}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
