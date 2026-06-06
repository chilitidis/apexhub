// TradingCoachPage — "Trading Coach"
// Upload a chart setup (screenshot OR TradingView link) and get an AI verdict
// scored against the trader's 10-criterion rubric + Pre-Trade Checklist.
// Dark navy "Ocean Depth" theme to match the rest of the dashboard.
// Deploy marker: r55a-2026-06-06 (visible build tag near the result + DB summary
// re-sanitize on history fetch so old un-sanitized rows never show raw JSON).
export const COACH_BUILD_TAG = "r55a";

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
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { isHttpUrl, safeFormatDate } from "@/lib/safeUrl";
import {
  type AnalysisView,
  normalizeAnalysis,
  sanitizeSummary,
} from "@/lib/coachNormalize";
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

/**
 * Build a human-readable, copy-pastable debug dump of the analysis result.
 * This is exactly what the UI received, so the user can paste it back for
 * debugging. It includes the structured fields + criteria, never base64.
 */
function buildRawDebugText(a: AnalysisView): string {
  const lines: string[] = [];
  lines.push("=== TRADING COACH — RAW OUTPUT (debug) ===");
  lines.push(`pair: ${a.pair || "(empty)"}`);
  lines.push(`timeframe: ${a.timeframe || "(empty)"}`);
  lines.push(`direction: ${a.direction || "(empty)"}`);
  lines.push(`verdict: ${a.verdict}`);
  lines.push(`score: ${a.score}`);
  lines.push(`hasImage: ${a.imageUrl ? "yes" : "no"}`);
  lines.push(`tvLink: ${a.tvLink || "(none)"}`);
  lines.push("");
  lines.push("--- summary (as rendered) ---");
  lines.push(a.summary || "(empty)");
  lines.push("");
  lines.push("--- criteria ---");
  a.criteria.forEach((c, i) => {
    lines.push(`${i + 1}. [${c.status}] ${c.label} (${c.id})`);
    lines.push(`   ${c.comment}`);
  });
  lines.push("");
  lines.push("--- JSON ---");
  lines.push(
    JSON.stringify(
      {
        pair: a.pair,
        timeframe: a.timeframe,
        direction: a.direction,
        verdict: a.verdict,
        score: a.score,
        summary: a.summary,
        criteria: a.criteria,
        imageUrl: a.imageUrl,
        tvLink: a.tvLink,
      },
      null,
      2,
    ),
  );
  return lines.join("\n");
}

function CopyRawButton({
  a,
  fullWidth = false,
}: {
  a: AnalysisView;
  fullWidth?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(async () => {
    const text = buildRawDebugText(a);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for browsers/contexts without clipboard API.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    toast.success("Αντιγράφηκε το raw output — κάνε paste στο chat.");
    setTimeout(() => setCopied(false), 2000);
  }, [a]);

  return (
    <button
      onClick={onCopy}
      className={
        fullWidth
          ? "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#5E60CE]/40 bg-[#5E60CE]/15 text-sm font-semibold text-white hover:bg-[#5E60CE]/25 hover:border-[#5E60CE]/60 transition-colors"
          : "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#0A1628] text-[11px] font-mono text-[#A8B5C7] hover:text-white hover:border-white/25 transition-colors"
      }
      title="Αντιγραφή ολόκληρου του raw output για debugging"
    >
      {copied ? (
        <>
          <Check size={fullWidth ? 16 : 12} className="text-[#00897B]" />
          Αντιγράφηκε — κάνε paste στο chat
        </>
      ) : (
        <>
          <Copy size={fullWidth ? 16 : 12} /> Αντιγραφή raw output (για debugging)
        </>
      )}
    </button>
  );
}

function StatusIcon({ status }: { status: CriterionStatus }) {
  const color = statusColor(status);
  const common = { size: 18, style: { color } };
  if (status === "pass") return <CheckCircle2 {...common} />;
  if (status === "warn") return <AlertTriangle {...common} />;
  if (status === "fail") return <XCircle {...common} />;
  return <HelpCircle {...common} />;
}

// ---- verdict banner --------------------------------------------------------

function VerdictBanner({ a }: { a: AnalysisView }) {
  const color = verdictColor(a.verdict);
  // Render-time guard: re-sanitize so raw JSON can never reach the screen,
  // regardless of how the data arrived (server bundle / cached history row).
  const safeSummary = sanitizeSummary(a.summary, a.criteria);
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

      {safeSummary && (
        <div className="mt-4 prose prose-sm dark:prose-invert max-w-none text-[#D6DEEA]">
          <Streamdown>{safeSummary}</Streamdown>
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
        setResult(normalizeAnalysis(res));
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
                <p className="text-[12px] text-[#A8B5C7] mt-2 leading-relaxed">
                  Ο Coach θα προσπαθήσει να ανακτήσει το πραγματικό{" "}
                  <b>snapshot</b> του chart από το TradingView link (μορφή{" "}
                  <span className="font-mono">tradingview.com/x/…</span>) και να
                  το αναλύσει οπτικά. Αν το snapshot δεν είναι διαθέσιμο, ανέβασε{" "}
                  <b>screenshot</b> — δεν εφευρίσκουμε ποτέ ζευγάρι ή τιμές χωρίς
                  να βλέπουμε το chart.
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
              <CopyRawButton a={result} fullWidth />
              <p className="text-[11px] text-[#4A6080] text-center pt-2">
                Εκπαιδευτικό εργαλείο · δεν αποτελεί επενδυτική συμβουλή.
              </p>
              <p className="text-[10px] font-mono text-[#2E3F57] text-center">
                build {COACH_BUILD_TAG}
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
                    onClick={() => setResult(normalizeAnalysis(h))}
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
                        {safeFormatDate(h.createdAt, "el-GR", {
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
  return isHttpUrl(s);
}

export default TradingCoachPage;
