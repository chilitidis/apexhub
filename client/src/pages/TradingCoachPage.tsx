// TradingCoachPage — "Trading Coach"
// Upload a chart setup (screenshot OR TradingView link) and get an AI verdict
// scored against the trader's 10-criterion rubric + Pre-Trade Checklist.
// Dark navy "Ocean Depth" theme to match the rest of the dashboard.

import { useCallback, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import {
  GraduationCap,
  Upload,
  Link2,
  Loader2,
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Trash2,
  ImageIcon,
  History,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  type CoachCriterionResult,
  type CoachVerdict,
  type CriterionStatus,
  verdictColor,
  verdictLabelGreek,
  statusColor,
} from "@shared/coach";

// ---- helpers ---------------------------------------------------------------

const MAX_BYTES = 8 * 1024 * 1024; // 8MB — keep well under the data URL limit.

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function StatusIcon({ status }: { status: CriterionStatus }) {
  const color = statusColor(status);
  const common = { size: 18, style: { color } };
  if (status === "pass") return <CheckCircle2 {...common} />;
  if (status === "warn") return <AlertTriangle {...common} />;
  if (status === "fail") return <XCircle {...common} />;
  return <HelpCircle {...common} />;
}

interface AnalysisView {
  id: number;
  pair: string;
  timeframe: string;
  direction: string;
  verdict: CoachVerdict;
  score: number;
  summary: string;
  criteria: CoachCriterionResult[];
  imageUrl: string | null;
  tvLink: string | null;
  createdAt: Date | string;
}

// ---- verdict banner --------------------------------------------------------

function VerdictBanner({ a }: { a: AnalysisView }) {
  const color = verdictColor(a.verdict);
  return (
    <div
      className="rounded-2xl border p-5 sm:p-6"
      style={{ borderColor: `${color}44`, background: `${color}12` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="flex items-center justify-center w-16 h-16 rounded-2xl font-['Space_Grotesk'] text-2xl font-bold"
            style={{ background: `${color}22`, color }}
          >
            {a.score}
          </div>
          <div>
            <div
              className="font-['Space_Grotesk'] text-2xl font-bold"
              style={{ color }}
            >
              {verdictLabelGreek(a.verdict)}
            </div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-[#4A6080] mt-1">
              {[a.pair || "—", a.timeframe, a.direction]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        </div>
        <div className="font-mono text-[11px] text-[#4A6080]">
          Score {a.score}/100
        </div>
      </div>

      {a.summary && (
        <div className="mt-4 prose prose-sm dark:prose-invert max-w-none text-[#D6DEEA]">
          <Streamdown>{a.summary}</Streamdown>
        </div>
      )}
    </div>
  );
}

// ---- criteria breakdown ----------------------------------------------------

function CriteriaList({ criteria }: { criteria: CoachCriterionResult[] }) {
  return (
    <div className="grid gap-2">
      {criteria.map((c) => (
        <div
          key={c.id}
          className="flex items-start gap-3 rounded-xl border border-white/8 bg-[#0D1E35]/60 px-4 py-3"
        >
          <span className="mt-0.5 shrink-0">
            <StatusIcon status={c.status} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-white">
                {c.label}
              </span>
              <span
                className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{
                  color: statusColor(c.status),
                  background: `${statusColor(c.status)}1A`,
                }}
              >
                {c.status}
              </span>
            </div>
            <p className="text-[13px] text-[#A8B5C7] mt-0.5 leading-relaxed">
              {c.comment}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- main page -------------------------------------------------------------

export function TradingCoachPage() {
  const [tab, setTab] = useState<"screenshot" | "link">("screenshot");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [tvLink, setTvLink] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<AnalysisView | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const analyze = trpc.coach.analyze.useMutation();
  const del = trpc.coach.delete.useMutation();
  const historyQuery = trpc.coach.history.useQuery({ limit: 20 });

  const onPickFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Επίλεξε αρχείο εικόνας (PNG/JPG).");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Η εικόνα είναι πολύ μεγάλη (max 8MB).");
      return;
    }
    try {
      const url = await fileToDataUrl(file);
      setDataUrl(url);
      setFileName(file.name);
    } catch {
      toast.error("Δεν μπόρεσα να διαβάσω το αρχείο.");
    }
  }, []);

  const clearImage = () => {
    setDataUrl(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const canSubmit =
    tab === "screenshot" ? !!dataUrl : isLikelyTvLink(tvLink);

  const runAnalysis = useCallback(() => {
    const payload =
      tab === "screenshot"
        ? { dataUrl: dataUrl ?? undefined, note }
        : { tvLink: tvLink.trim(), note };

    analyze.mutate(payload, {
      onSuccess: (res) => {
        setResult(res as AnalysisView);
        utils.coach.history.invalidate();
        toast.success("Η ανάλυση ολοκληρώθηκε.");
      },
      onError: (err) => {
        toast.error(err.message || "Η ανάλυση απέτυχε. Δοκίμασε ξανά.");
      },
    });
  }, [tab, dataUrl, tvLink, note, analyze, utils]);

  const handleDelete = (id: number) => {
    del.mutate(
      { id },
      {
        onSuccess: () => {
          utils.coach.history.invalidate();
          if (result?.id === id) setResult(null);
          toast.success("Διαγράφηκε.");
        },
      },
    );
  };

  const history = historyQuery.data ?? [];

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ===== Header ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#5E60CE]/15 text-[#5E60CE]">
            <GraduationCap size={22} />
          </span>
          <div>
            <h1 className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-bold text-white leading-tight">
              Trading Coach
            </h1>
            <p className="text-sm text-[#A8B5C7] mt-0.5">
              Ανέβασε το setup σου και ο AI θα το αξιολογήσει με βάση τους
              κανόνες μας.
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* ===== Left column: input + result ===== */}
        <div className="space-y-6">
          {/* Input card */}
          <div className="bg-[#0D1E35]/70 border border-white/8 rounded-2xl p-5 sm:p-6">
            {/* Tabs */}
            <div className="flex gap-2 mb-5">
              <TabButton
                active={tab === "screenshot"}
                onClick={() => setTab("screenshot")}
                icon={<ImageIcon size={15} />}
                label="Screenshot"
              />
              <TabButton
                active={tab === "link"}
                onClick={() => setTab("link")}
                icon={<Link2 size={15} />}
                label="TradingView Link"
              />
            </div>

            {tab === "screenshot" ? (
              <div>
                {dataUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-white/10">
                    <img
                      src={dataUrl}
                      alt={fileName || "setup"}
                      className="w-full max-h-[420px] object-contain bg-[#0A1628]"
                    />
                    <button
                      onClick={clearImage}
                      className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                      aria-label="Remove image"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-white/12 rounded-xl py-12 flex flex-col items-center justify-center gap-3 hover:border-[#5E60CE]/50 transition-colors"
                  >
                    <Upload size={28} className="text-[#5E60CE]" />
                    <span className="text-sm text-[#A8B5C7]">
                      Κάνε κλικ για να ανεβάσεις screenshot του chart
                    </span>
                    <span className="font-mono text-[11px] text-[#4A6080]">
                      PNG ή JPG · max 8MB
                    </span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0])}
                />
              </div>
            ) : (
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-[#4A6080] mb-2">
                  TradingView Link
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-white/12 bg-[#0A1628] px-3">
                  <Link2 size={15} className="text-[#4A6080] shrink-0" />
                  <input
                    value={tvLink}
                    onChange={(e) => setTvLink(e.target.value)}
                    placeholder="https://www.tradingview.com/x/..."
                    className="flex-1 bg-transparent py-3 text-sm text-white placeholder:text-[#4A6080] focus:outline-none"
                  />
                </div>
                <p className="text-[12px] text-[#4A6080] mt-2 leading-relaxed">
                  Συμβουλή: για ακριβέστερη οπτική ανάλυση, ανέβασε καλύτερα
                  screenshot. Το link αναλύεται με βάση τα δεδομένα που
                  περιγράφεις παρακάτω.
                </p>
              </div>
            )}

            {/* Optional note */}
            <div className="mt-4">
              <label className="block font-mono text-[11px] uppercase tracking-wider text-[#4A6080] mb-2">
                Σημειώσεις (προαιρετικά)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="π.χ. ζευγάρι, κατεύθυνση, RR, ημέρα/ώρα, τι βλέπεις στο H4…"
                className="w-full rounded-xl border border-white/12 bg-[#0A1628] px-3 py-2.5 text-sm text-white placeholder:text-[#4A6080] focus:outline-none focus:border-[#5E60CE]/50 resize-none"
              />
            </div>

            <button
              onClick={runAnalysis}
              disabled={!canSubmit || analyze.isPending}
              className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#5E60CE] text-white font-semibold text-sm hover:bg-[#6f71d6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analyze.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Αναλύω το setup…
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Αξιολόγηση Setup
                </>
              )}
            </button>
          </div>

          {/* Result */}
          {analyze.isPending && !result && (
            <div className="bg-[#0D1E35]/70 border border-white/8 rounded-2xl p-10 flex flex-col items-center gap-3">
              <Loader2 size={30} className="animate-spin text-[#5E60CE]" />
              <span className="text-sm text-[#A8B5C7]">
                Ελέγχω τάση, EMA50, breakout/retest, RR… (~10–20 δευτ.)
              </span>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <VerdictBanner a={result} />
              <div>
                <h3 className="font-mono text-[11px] uppercase tracking-wider text-[#4A6080] mb-3">
                  Ανάλυση ανά κριτήριο
                </h3>
                <CriteriaList criteria={result.criteria} />
              </div>
              <p className="text-[11px] text-[#4A6080] text-center pt-2">
                Εκπαιδευτικό εργαλείο · δεν αποτελεί επενδυτική συμβουλή.
              </p>
            </div>
          )}

          {!result && !analyze.isPending && (
            <div className="bg-[#0D1E35]/40 border border-dashed border-white/10 rounded-2xl p-8 text-center">
              <GraduationCap
                size={28}
                className="text-[#4A6080] mx-auto mb-3"
              />
              <p className="text-sm text-[#A8B5C7]">
                Το αποτέλεσμα της αξιολόγησης θα εμφανιστεί εδώ.
              </p>
              <p className="text-[12px] text-[#4A6080] mt-2">
                Ελέγχονται 10 κριτήρια: τάση, multi-timeframe, breakout+retest,
                EMA50, stop loss, Elliott, RR, news, timing & pre-trade
                checklist.
              </p>
            </div>
          )}
        </div>

        {/* ===== Right column: history ===== */}
        <div>
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-[#4A6080] mb-3 flex items-center gap-2">
            <History size={13} /> Ιστορικό
          </h3>
          {historyQuery.isLoading ? (
            <div className="text-sm text-[#4A6080]">Φόρτωση…</div>
          ) : history.length === 0 ? (
            <div className="text-sm text-[#4A6080] border border-dashed border-white/10 rounded-xl p-4">
              Δεν υπάρχουν ακόμη αναλύσεις.
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((h) => {
                const color = verdictColor(h.verdict as CoachVerdict);
                return (
                  <button
                    key={h.id}
                    onClick={() => setResult(h as AnalysisView)}
                    className="w-full text-left rounded-xl border border-white/8 bg-[#0D1E35]/60 p-3 hover:border-white/20 transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-white truncate">
                        {h.pair || "Setup"}
                      </span>
                      <span
                        className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ color, background: `${color}1A` }}
                      >
                        {h.score}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono text-[10px] text-[#4A6080]">
                        {[h.timeframe, h.direction].filter(Boolean).join(" · ")}
                        {" · "}
                        {new Date(h.createdAt).toLocaleDateString("el-GR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(h.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-[#4A6080] hover:text-[#E94F37] transition-all cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-[#5E60CE] text-white"
          : "bg-[#0A1628] text-[#A8B5C7] hover:text-white border border-white/8"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function isLikelyTvLink(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export default TradingCoachPage;
