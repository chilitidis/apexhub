/**
 * TradingCoachPage — AI Trading Coach.
 *
 * The trader uploads one or two TradingView screenshots (e.g. H1 + H4); a
 * vision model reads the chart(s) and returns a fully-structured analysis
 * (score 0-100, verdict, observations, numeric RR, time/session read, optional
 * Elliott note, per-criterion checklist, Greek comment + suggestion). After an
 * analysis the trader can chat with the Coach ("τι να διορθώσω;").
 *
 * We NEVER render raw JSON / base64 — image data urls are sent to the server
 * in-flight only; the response is the sanitized, typed CoachAnalysisResult.
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
  Eye,
  Scale,
  Clock,
  Waves,
  MessageCircle,
  Send,
  Sparkles,
  BookOpen,
  ImageUp,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { AppSidebar, type ViewKey } from "@/components/AppSidebar";
import { useAccounts } from "@/hooks/useJournal";
import { trpc } from "@/lib/trpc";
import {
  COACH_DISCLAIMER,
  COACH_MAX_IMAGES,
  scoreToBand,
  type CoachCriterionResult,
  type CriterionStatus,
} from "@shared/tradingCoach";

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB cap per screenshot

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
  observations: string;
  rr: string;
  timeAnalysis: string;
  elliottNote: string;
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

// --- upload slot --------------------------------------------------------------

function UploadSlot({
  label,
  hint,
  previewUrl,
  dragOver,
  onPick,
  onClear,
  onDragOver,
  onDragLeave,
  onDrop,
  testId,
}: {
  label: string;
  hint: string;
  previewUrl: string | null;
  dragOver: boolean;
  onPick: () => void;
  onClear: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      onClick={onPick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all overflow-hidden ${
        dragOver
          ? "border-[#0094C6] bg-[#0094C6]/10"
          : "border-white/12 bg-[#0D1E35]/60 hover:border-white/25"
      }`}
    >
      <div className="absolute top-2 left-2 z-10 font-mono text-[9px] uppercase tracking-widest text-white bg-black/45 px-2 py-0.5 rounded">
        {label}
      </div>
      {previewUrl ? (
        <div className="relative">
          <img
            src={previewUrl}
            alt={`${label} preview`}
            className="w-full max-h-[220px] object-contain bg-[#0A1628]"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
            aria-label="Αφαίρεση"
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <div className="py-9 px-5 flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-xl bg-[#0077B6]/15 flex items-center justify-center mb-2.5">
            <Upload size={18} className="text-[#0094C6]" />
          </div>
          <div className="font-['Space_Grotesk'] text-[13px] font-semibold text-white mb-1">
            {hint}
          </div>
          <div className="font-mono text-[9.5px] text-[#6E8AA8]">
            κλικ ή σύρε · PNG / JPG · έως 12MB
          </div>
        </div>
      )}
    </div>
  );
}

// --- main ---------------------------------------------------------------------

export default function TradingCoachPage() {
  const [, setLocation] = useLocation();
  const { accounts } = useAccounts();
  const [view] = useState<ViewKey>("trading-coach");
  const [tab, setTab] = useState<"analysis" | "chat">("chat");

  // Two independent slots (e.g. H1 + H4). Slot 0 is required, slot 1 optional.
  const inputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const [dragOver, setDragOver] = useState<[boolean, boolean]>([false, false]);
  const [previews, setPreviews] = useState<[string | null, string | null]>([null, null]);
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

  const acceptFile = useCallback(async (slot: 0 | 1, file: File) => {
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
      setPreviews((prev) => {
        const next = [...prev] as [string | null, string | null];
        next[slot] = url;
        return next;
      });
      setResult(null);
    } catch {
      toast.error("Δεν μπόρεσα να διαβάσω το αρχείο.");
    }
  }, []);

  const makeDrop = (slot: 0 | 1) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver((d) => {
      const n = [...d] as [boolean, boolean];
      n[slot] = false;
      return n;
    });
    const file = e.dataTransfer.files?.[0];
    if (file) acceptFile(slot, file);
  };

  const clearSlot = (slot: 0 | 1) => {
    setPreviews((prev) => {
      const next = [...prev] as [string | null, string | null];
      next[slot] = null;
      return next;
    });
    setResult(null);
    if (inputRefs[slot].current) inputRefs[slot].current!.value = "";
  };

  function onRunAnalysis() {
    const images = previews.filter((p): p is string => Boolean(p));
    if (images.length === 0) {
      toast.info("Ανέβασε πρώτα τουλάχιστον ένα screenshot.");
      return;
    }
    analyzeMutation.mutate({ images, accountId: 0 });
  }

  function onResetAll() {
    setPreviews([null, null]);
    setResult(null);
    inputRefs.forEach((r) => {
      if (r.current) r.current.value = "";
    });
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
  const hasAnyImage = previews.some(Boolean);

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
                Ο προσωπικός σου προπονητής για το trading
              </p>
            </div>
          </div>

          {/* ===== TABS ===== */}
          <div className="flex gap-1.5 p-1 rounded-xl bg-[#0D1E35]/60 border border-white/8 w-fit">
            <button
              type="button"
              data-testid="coach-tab-chat"
              onClick={() => setTab("chat")}
              className={`flex items-center gap-2 px-4 h-9 rounded-lg font-['Space_Grotesk'] text-[13px] font-semibold transition-all ${
                tab === "chat"
                  ? "bg-gradient-to-br from-[#0094C6] to-[#005377] text-white shadow-md shadow-[#0094C6]/20"
                  : "text-[#6E8AA8] hover:text-white"
              }`}
            >
              <Sparkles size={15} /> Ρώτα τον Coach
            </button>
            <button
              type="button"
              data-testid="coach-tab-analysis"
              onClick={() => setTab("analysis")}
              className={`flex items-center gap-2 px-4 h-9 rounded-lg font-['Space_Grotesk'] text-[13px] font-semibold transition-all ${
                tab === "analysis"
                  ? "bg-gradient-to-br from-[#0094C6] to-[#005377] text-white shadow-md shadow-[#0094C6]/20"
                  : "text-[#6E8AA8] hover:text-white"
              }`}
            >
              <ChartCandlestick size={15} /> Ανάλυση Setup
            </button>
          </div>

          {tab === "chat" ? (
            <KnowledgeChat />
          ) : (
          <>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* ===== UPLOAD PANEL ===== */}
            <div className="lg:col-span-2 space-y-4">
              <p className="font-mono text-[10px] text-[#6E8AA8] leading-relaxed">
                Ανέβασε 1 screenshot, ή 2 (π.χ. <span className="text-[#A8B5C7]">H1 + H4</span>) για να
                ελέγξει αν τα δύο timeframes συμφωνούν.
              </p>

              <UploadSlot
                label="Κύριο (π.χ. H1)"
                hint="Σύρε το βασικό screenshot"
                previewUrl={previews[0]}
                dragOver={dragOver[0]}
                onPick={() => inputRefs[0].current?.click()}
                onClear={() => clearSlot(0)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver((d) => [true, d[1]]);
                }}
                onDragLeave={() => setDragOver((d) => [false, d[1]])}
                onDrop={makeDrop(0)}
                testId="coach-dropzone"
              />
              <UploadSlot
                label="Προαιρετικό (π.χ. H4)"
                hint="2ο timeframe (προαιρετικά)"
                previewUrl={previews[1]}
                dragOver={dragOver[1]}
                onPick={() => inputRefs[1].current?.click()}
                onClear={() => clearSlot(1)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver((d) => [d[0], true]);
                }}
                onDragLeave={() => setDragOver((d) => [d[0], false])}
                onDrop={makeDrop(1)}
                testId="coach-dropzone-2"
              />

              {[0, 1].map((i) => (
                <input
                  key={i}
                  ref={inputRefs[i]}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  data-testid={`coach-file-input-${i}`}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) acceptFile(i as 0 | 1, file);
                  }}
                />
              ))}

              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="coach-analyze-btn"
                  onClick={onRunAnalysis}
                  disabled={!hasAnyImage || isAnalyzing}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-br from-[#0094C6] to-[#005377] text-white font-['Space_Grotesk'] font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:from-[#00B4D8] hover:to-[#0094C6] disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-[#0094C6]/20"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Αναλύω…
                    </>
                  ) : (
                    <>
                      <ChartCandlestick size={16} />
                      Ανάλυση Setup
                    </>
                  )}
                </button>
                {hasAnyImage && !isAnalyzing && (
                  <button
                    type="button"
                    onClick={onResetAll}
                    className="h-11 px-3 rounded-xl border border-white/12 text-[#6E8AA8] hover:text-white hover:border-white/25 flex items-center justify-center"
                    aria-label="Καθαρισμός"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              {isAnalyzing && (
                <p className="font-mono text-[10px] text-[#6E8AA8] text-center">
                  Διαβάζω σύμβολο, ώρα, EMA50, επίπεδα, breakout/retest και RR — μπορεί να πάρει 15-30s.
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
                    {result.id && <CoachChat analysisId={result.id} />}
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
                    <span className="font-mono text-[10px] text-[#3A506B] max-w-[300px]">
                      Ανέβασε καθαρό screenshot με ορατά: ημερομηνία/ώρα (πάνω από το TradingView),
                      EMA50, επίπεδα, και τις γραμμές Entry/SL.
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
                      className="flex items-center gap-3 rounded-xl bg-[#0D1E35]/70 border border-white/8 px-4 py-3 cursor-pointer hover:border-white/20"
                      onClick={() => setResult(h as AnalysisData)}
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
                          {h.rr && (
                            <span className="font-mono text-[9px] text-[#7DD3FC]">RR {h.rr}</span>
                          )}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          if (h.id) removeMutation.mutate({ id: h.id });
                        }}
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
          </>
          )}
        </div>
      </div>
    </div>
  );
}

// --- result view --------------------------------------------------------------

function MetaRow({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-[#0A1628]/60 border border-white/6 px-3 py-2">
      <span className="mt-0.5 shrink-0" style={{ color: accent }}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="font-mono text-[9px] uppercase tracking-widest text-[#6E8AA8]">{label}</div>
        <div className="font-mono text-[11px] text-[#D4DEEA] leading-snug mt-0.5">{value}</div>
      </div>
    </div>
  );
}

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
            <p className="font-mono text-[12px] leading-relaxed text-[#D4DEEA]">{result.comment}</p>
          )}
        </div>
      </div>

      {/* Observations (what the model actually saw) */}
      {result.observations && (
        <div className="rounded-xl bg-[#0A1628]/50 border border-white/6 p-3.5">
          <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-[#6E8AA8] mb-1.5">
            <Eye size={11} /> Τι βλέπει
          </div>
          <p className="font-mono text-[11px] leading-relaxed text-[#A8B5C7]">
            {result.observations}
          </p>
        </div>
      )}

      {/* Quick meta: RR, time, Elliott */}
      {(result.rr || result.timeAnalysis || result.elliottNote) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <MetaRow icon={<Scale size={14} />} label="Risk / Reward" value={result.rr} accent="#7DD3FC" />
          <MetaRow icon={<Clock size={14} />} label="Ώρα / Ημέρα" value={result.timeAnalysis} accent="#F4A261" />
          {result.elliottNote && (
            <div className="sm:col-span-2">
              <MetaRow
                icon={<Waves size={14} />}
                label="Elliott (προαιρετικό)"
                value={result.elliottNote}
                accent="#5E60CE"
              />
            </div>
          )}
        </div>
      )}

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

// --- chat ---------------------------------------------------------------------

function CoachChat({ analysisId }: { analysisId: number }) {
  const [text, setText] = useState("");
  const utils = trpc.useUtils();
  const messagesQuery = trpc.coach.messages.useQuery({ analysisId });
  const messages = messagesQuery.data ?? [];

  const chatMutation = trpc.coach.chat.useMutation({
    onSuccess: () => {
      utils.coach.messages.invalidate({ analysisId });
    },
    onError: (err) => toast.error(err.message || "Δεν στάλθηκε. Δοκίμασε ξανά."),
  });

  function send() {
    const msg = text.trim();
    if (!msg) return;
    setText("");
    chatMutation.mutate({ analysisId, message: msg });
  }

  return (
    <div className="border-t border-white/8 pt-4" data-testid="coach-chat">
      <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-[#6E8AA8] mb-2.5">
        <MessageCircle size={11} /> Ρώτησε τον Coach
      </div>

      {messages.length > 0 && (
        <div className="space-y-2 mb-3 max-h-[320px] overflow-y-auto pr-1">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 font-mono text-[11px] leading-relaxed ${
                  m.role === "user"
                    ? "bg-[#0094C6]/20 text-[#D4DEEA] border border-[#0094C6]/25"
                    : "bg-[#0A1628]/70 text-[#A8B5C7] border border-white/8"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {chatMutation.isPending && (
        <div className="flex items-center gap-2 text-[#6E8AA8] font-mono text-[10px] mb-2">
          <Loader2 size={12} className="animate-spin" /> Ο Coach σκέφτεται…
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="π.χ. Τι να διορθώσω σε αυτό το setup;"
          data-testid="coach-chat-input"
          className="flex-1 resize-none rounded-xl bg-[#0A1628]/70 border border-white/10 focus:border-[#0094C6]/50 outline-none px-3 py-2.5 font-mono text-[11px] text-white placeholder:text-[#3A506B]"
        />
        <button
          type="button"
          onClick={send}
          disabled={!text.trim() || chatMutation.isPending}
          data-testid="coach-chat-send"
          className="h-[42px] w-[42px] rounded-xl bg-gradient-to-br from-[#0094C6] to-[#005377] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          aria-label="Αποστολή"
        >
          <Send size={15} />
        </button>
      </div>
      <p className="font-mono text-[8.5px] text-[#3A506B] mt-1.5">
        Ο Coach απαντά βάσει αυτής της ανάλυσης. Δεν είναι επενδυτική συμβουλή.
      </p>
    </div>
  );
}

void COACH_MAX_IMAGES;

void BookOpen;

// --- conversational knowledge chat --------------------------------------------

type ChatMsg = { role: "user" | "assistant"; content: string };

const SUGGESTED_PROMPTS = [
  {
    title: "Εξήγησέ μου τη στρατηγική",
    subtitle:
      "Πώς λειτουργεί το breakout-retest και τι πρέπει να ισχύει για ένα έγκυρο setup;",
    prompt:
      "Εξήγησέ μου αναλυτικά τη στρατηγική breakout-retest: τι κοιτάμε στο γράφημα και τι πρέπει να ισχύει για ένα έγκυρο setup.",
  },
  {
    title: "Διαχείριση ρίσκου",
    subtitle:
      "Πόσο να ρισκάρω ανά trade, πώς υπολογίζω το lot και τι Risk/Reward να στοχεύω;",
    prompt:
      "Εξήγησέ μου τη διαχείριση ρίσκου: πόσο να ρισκάρω ανά trade, πώς υπολογίζω το μέγεθος του lot και τι Risk/Reward να στοχεύω.",
  },
  {
    title: "Πού βάζω το Stop Loss",
    subtitle:
      "Σωστή τοποθέτηση SL σε long και short, και τι λάθη να αποφύγω.",
    prompt:
      "Πού βάζω το Stop Loss σε long και σε short θέση, και ποια είναι τα συχνότερα λάθη που πρέπει να αποφύγω;",
  },
  {
    title: "Τι να προσέχω πριν μπω",
    subtitle:
      "Το pre-trade checklist: τι πρέπει να ελέγξω πριν ανοίξω μια θέση.",
    prompt:
      "Τι πρέπει να ελέγξω πριν ανοίξω μια θέση; Δώσε μου το pre-trade checklist με τα σημαντικότερα σημεία.",
  },
];

function KnowledgeChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.coach.knowledgeChat.useMutation({
    onSuccess: (reply) => {
      setMessages((prev) => [...prev, { role: "assistant", content: reply.content }]);
    },
    onError: (err) => {
      toast.error(err.message || "Δεν στάλθηκε. Δοκίμασε ξανά.");
      setMessages((prev) => prev.slice(0, -1));
    },
  });

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chatMutation.isPending]);

  const send = useCallback(
    (raw: string) => {
      const msg = raw.trim();
      if (!msg || chatMutation.isPending) return;
      const next = [...messages, { role: "user" as const, content: msg }];
      setMessages(next);
      setText("");
      const imageUrl = image ?? undefined;
      setImage(null);
      if (fileRef.current) fileRef.current.value = "";
      chatMutation.mutate({
        messages: next.map((m) => ({ role: m.role, content: m.content })),
        imageUrl,
      });
    },
    [messages, image, chatMutation],
  );

  async function pickImage(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Ανέβασε εικόνα (PNG / JPG).");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Η εικόνα είναι πολύ μεγάλη (μέγιστο 12MB).");
      return;
    }
    try {
      setImage(await fileToDataUrl(file));
    } catch {
      toast.error("Δεν μπόρεσα να διαβάσω το αρχείο.");
    }
  }

  return (
    <div
      className="rounded-2xl bg-[#0D1E35]/80 border border-white/8 flex flex-col"
      data-testid="coach-knowledge-chat"
      style={{ height: "calc(100vh - 230px)", minHeight: 360 }}
    >
      {/* scroll area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <div className="min-h-full flex flex-col items-center justify-start sm:justify-center gap-5 sm:gap-6 text-center py-2">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-[#0077B6]/15 flex items-center justify-center">
                <Sparkles size={26} className="text-[#0094C6]" />
              </div>
              <div>
                <div className="font-['Space_Grotesk'] text-base font-semibold text-white">
                  Ρώτα τον Trading Coach
                </div>
                <p className="text-[13px] leading-relaxed text-[#8FA3BC] mt-2 max-w-[460px]">
                  Ρώτα με οτιδήποτε αφορά το trading — στρατηγική, setups, διαχείριση ρίσκου,
                  Stop Loss και τι να προσέχεις πριν μπεις σε μια θέση. Είμαι εδώ να σε
                  βοηθήσω να παίρνεις καθαρές, πειθαρχημένες αποφάσεις.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-[640px]">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p.title}
                  type="button"
                  onClick={() => send(p.prompt)}
                  disabled={chatMutation.isPending}
                  className="text-left rounded-xl border border-white/8 bg-[#0A1628]/60 px-4 py-3.5 hover:border-[#0094C6]/40 hover:bg-[#0A1628]/90 transition-colors disabled:opacity-40 group"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-[#0094C6] shrink-0" />
                    <span className="font-['Space_Grotesk'] text-[13px] font-semibold text-white">
                      {p.title}
                    </span>
                  </div>
                  <p className="text-[11.5px] leading-snug text-[#7E92AB] mt-1.5">
                    {p.subtitle}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-[#0077B6]/15 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                    <Sparkles size={14} className="text-[#0094C6]" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#0094C6]/20 text-[#E4ECF5] border border-[#0094C6]/25 font-mono whitespace-pre-wrap"
                      : "bg-[#0A1628]/70 text-[#C7D3E0] border border-white/8"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="coach-prose">
                      <Streamdown>{m.content}</Streamdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full bg-[#0077B6]/15 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                  <Sparkles size={14} className="text-[#0094C6]" />
                </div>
                <div className="rounded-xl bg-[#0A1628]/70 border border-white/8 px-3.5 py-2.5">
                  <Loader2 size={14} className="animate-spin text-[#6E8AA8]" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* input bar */}
      <div className="border-t border-white/8 p-3">
        {image && (
          <div className="relative inline-block mb-2">
            <img src={image} alt="προεπισκόπηση" className="h-16 rounded-lg border border-white/10" />
            <button
              type="button"
              onClick={() => {
                setImage(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"
              aria-label="Αφαίρεση εικόνας"
            >
              <X size={11} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            data-testid="coach-chat-image-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickImage(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="h-[42px] w-[42px] rounded-xl border border-white/10 text-[#6E8AA8] hover:text-white hover:border-white/25 flex items-center justify-center shrink-0"
            aria-label="Επισύναψη εικόνας"
          >
            <ImageUp size={16} />
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            rows={1}
            placeholder="Γράψε την ερώτησή σου…"
            data-testid="coach-knowledge-input"
            className="flex-1 resize-none max-h-32 min-h-[42px] rounded-xl bg-[#0A1628]/70 border border-white/10 focus:border-[#0094C6]/50 outline-none px-3.5 py-3 font-mono text-[12px] text-white placeholder:text-[#3A506B]"
          />
          <button
            type="button"
            onClick={() => send(text)}
            disabled={(!text.trim() && !image) || chatMutation.isPending}
            data-testid="coach-knowledge-send"
            className="h-[42px] w-[42px] rounded-xl bg-gradient-to-br from-[#0094C6] to-[#005377] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            aria-label="Αποστολή"
          >
            <Send size={15} />
          </button>
        </div>
        <p className="font-mono text-[8.5px] text-[#3A506B] mt-1.5 px-1">{COACH_DISCLAIMER}</p>
      </div>
    </div>
  );
}
