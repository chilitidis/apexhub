import { AnimatePresence, motion } from "framer-motion";
import { toBlob, toPng } from "html-to-image";
import {
  Check,
  Copy,
  Download,
  Loader2,
  Share2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import type { Trade, TradingData } from "@/lib/trading";
import { computeKPIs, fmtPct, fmtUSD } from "@/lib/trading";

interface Account {
  id: number;
  name: string;
  accountType: string | null;
  color: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: TradingData;
  account: Account | null;
  accountId: number | null;
}

/**
 * Share Card dialog — produces two outputs:
 *
 * 1. A PNG snapshot generated from the on-screen card via `html-to-image`.
 *    Users can download it or copy it straight to the OS clipboard (with
 *    automatic fallback to download on browsers that don't grant
 *    `ClipboardItem` for images, e.g. Firefox).
 * 2. A public `/s/:token` URL backed by a server-stored JSON payload. The
 *    payload is rebuilt from the *current* `data` every time the user hits
 *    "Create public link" — so if they tweak anything in the dialog and
 *    re-click, the new snapshot is what gets stored.
 *
 * Design:
 *   - % hero (no $ figure — user requested the return % to be the only
 *     headline metric).
 *   - KPI grid with win rate, profit factor, avg R, max drawdown, best /
 *     worst trade (fills the empty space that used to be blank).
 *   - Full trade table (every trade in the snapshot, not just the top 6).
 *   - No starting / ending balance KPIs — user asked for them to be removed.
 */
export default function ShareCardDialog({
  open,
  onClose,
  data,
  account,
  accountId,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [generatingImg, setGeneratingImg] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fresh KPI recompute so the card never shows stale numbers.
  const kpis = useMemo(
    () => computeKPIs(data.trades, data.kpis.starting).kpis,
    [data.trades, data.kpis.starting],
  );

  const createShare = trpc.share.create.useMutation();

  // Any time the dialog is reopened OR the underlying trades/account change
  // while open, drop the stale public URL so the next "Create public link"
  // always re-snapshots the current data.
  useEffect(() => {
    if (!open) return;
    setPublicUrl(null);
    setCopied(false);
  }, [open, accountId, data.trades, data.kpis.starting]);

  if (!open) return null;

  const accent = account?.color || "#0094C6";
  const accountLabel = account?.name || "My Trading Account";
  const monthLabel = data.meta?.month_name
    ? `${data.meta.month_name} ’${data.meta.year_short}`
    : "All time";

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setGeneratingImg(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0A1628",
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `UTJ_${slugify(accountLabel)}_${slugify(monthLabel)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Share card downloaded");
    } catch (err) {
      console.error("[ShareCard] download failed", err);
      toast.error("Failed to render share image");
    } finally {
      setGeneratingImg(false);
    }
  };

  const handleCopyImage = async () => {
    if (!cardRef.current) return;
    setGeneratingImg(true);
    try {
      // Use `toBlob` directly — produces an exact image/png blob that
      // ClipboardItem accepts. Previously we went through toPng + fetch()
      // which tripped Firefox/Safari on the data-URL to blob conversion.
      const blob = await toBlob(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0A1628",
      });
      if (!blob) throw new Error("Image blob could not be generated");

      const canUseClipboard =
        typeof window !== "undefined" &&
        typeof window.ClipboardItem !== "undefined" &&
        !!navigator.clipboard?.write;

      if (canUseClipboard) {
        try {
          await navigator.clipboard.write([
            new window.ClipboardItem({ "image/png": blob }),
          ]);
          toast.success("Image copied to clipboard");
          return;
        } catch (clipErr) {
          console.warn(
            "[ShareCard] clipboard.write refused, falling back to download",
            clipErr,
          );
        }
      }

      // Fallback: trigger a download so the user always gets something usable.
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `UTJ_${slugify(accountLabel)}_${slugify(monthLabel)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.info("Your browser blocks image clipboard — downloaded instead");
    } catch (err) {
      console.error("[ShareCard] copy failed", err);
      toast.error("Could not copy image");
    } finally {
      setGeneratingImg(false);
    }
  };

  const handleCreateLink = async () => {
    if (!accountId || !account) {
      toast.error("No account selected — open an account first.");
      return;
    }
    try {
      // Build monthKey from meta (same convention used by useJournal).
      const monthKey = data.meta?.month_name
        ? `${data.meta.month_name}-${data.meta.year_full || data.meta.year_short}`
        : undefined;

      const bestSymbol = kpis.best_trade?.symbol || undefined;
      const worstSymbol = kpis.worst_trade?.symbol || undefined;

      const res = await createShare.mutateAsync({
        accountId,
        monthKey,
        payload: {
          version: 1,
          accountName: accountLabel,
          accountType: account.accountType || undefined,
          accountColor: account.color || undefined,
          monthLabel,
          starting: kpis.starting,
          ending: kpis.ending,
          netResult: kpis.net_result,
          returnPct: kpis.return_pct,
          winRate: kpis.win_rate,
          totalTrades: kpis.total_trades,
          wins: kpis.wins,
          losses: kpis.losses,
          bestTradeUsd: kpis.best_trade?.pnl ?? 0,
          worstTradeUsd: kpis.worst_trade?.pnl ?? 0,
          bestSymbol,
          worstSymbol,
          profitFactor: Number.isFinite(kpis.profit_factor)
            ? kpis.profit_factor
            : 0,
          avgR: kpis.avg_r,
          maxDrawdownPct: kpis.max_drawdown_pct,
          trades: data.trades.map(t => ({
            symbol: t.symbol,
            direction: t.direction,
            pnl: t.pnl,
            netPct: t.net_pct,
          })),
        },
      });
      const url = `${window.location.origin}/s/${res.token}`;
      setPublicUrl(url);
      toast.success("Public link ready");
    } catch (err) {
      console.error("[ShareCard] createLink", err);
      toast.error(err instanceof Error ? err.message : "Could not create link");
    }
  };

  const handleCopyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const isPos = kpis.return_pct >= 0;
  const profitFactorText =
    !Number.isFinite(kpis.profit_factor) || kpis.profit_factor === 0
      ? "—"
      : kpis.profit_factor.toFixed(2);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-40"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Share your performance"
        data-testid="share-card-dialog"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 pointer-events-none"
      >
        <div className="w-full max-w-[1040px] max-h-[94vh] bg-[#0A1628] border border-white/10 rounded-2xl overflow-hidden shadow-2xl pointer-events-auto flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/8 shrink-0">
            <div className="flex items-center gap-2">
              <Share2 size={18} className="text-[#F4A261]" />
              <span className="font-['Space_Grotesk'] font-semibold text-white text-base">
                Share snapshot
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#6E8AA8] hidden sm:block">
                · {accountLabel} · {monthLabel}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[#6E8AA8] hover:text-white hover:bg-white/10 transition-colors"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-1 xl:grid-cols-[1fr,280px] gap-5">
              {/* Preview card */}
              <div className="rounded-2xl overflow-hidden border border-white/10 shadow-xl">
                <div
                  ref={cardRef}
                  data-testid="share-card-preview"
                  className="w-full"
                  style={{
                    background:
                      "linear-gradient(145deg, #0A1628 0%, #0D1E35 60%, #061020 100%)",
                    padding: "28px",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {/* Brand row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 20,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <img
                        src="https://d2xsxph8kpxj0f.cloudfront.net/310519663576082454/8kEKtsKWxF9JiwbjRbrvBM/utj-logo-badge-N5NDtvx9GcDyhxwM7gRvFA.webp"
                        alt=""
                        crossOrigin="anonymous"
                        style={{ width: 38, height: 38, borderRadius: 10 }}
                      />
                      <div>
                        <div
                          style={{
                            color: "#fff",
                            fontWeight: 600,
                            fontSize: 14,
                            letterSpacing: "0.02em",
                          }}
                        >
                          ULTIMATE TRADING JOURNAL
                        </div>
                        <div
                          style={{
                            color: "#6E8AA8",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10,
                            letterSpacing: "0.18em",
                          }}
                        >
                          ULTIMATRADINGJOURNAL.COM
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 10px",
                        borderRadius: 8,
                        background: `${accent}22`,
                        border: `1px solid ${accent}55`,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: accent,
                        }}
                      />
                      <span
                        style={{
                          color: "#fff",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        {accountLabel}
                      </span>
                    </div>
                  </div>

                  {/* Hero — only return %, no $ figure */}
                  <div style={{ marginBottom: 22 }}>
                    <div
                      style={{
                        color: "#6E8AA8",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        marginBottom: 6,
                      }}
                    >
                      {monthLabel} · Net return
                    </div>
                    <div
                      style={{
                        color: isPos ? "#00897B" : "#E94F37",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 96,
                        fontWeight: 700,
                        letterSpacing: "-0.02em",
                        lineHeight: 1,
                      }}
                    >
                      {fmtPct(kpis.return_pct)}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                        color: "#6E8AA8",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {kpis.total_trades} trades · {kpis.wins}W · {kpis.losses}L
                    </div>
                  </div>

                  {/* KPI grid — richer metrics, no Starting/Ending balances */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 10,
                      marginBottom: 22,
                    }}
                  >
                    <Kpi
                      label="Win rate"
                      value={`${(kpis.win_rate * 100).toFixed(0)}%`}
                    />
                    <Kpi label="Profit factor" value={profitFactorText} />
                    <Kpi label="Avg R" value={kpis.avg_r.toFixed(2)} />
                    <Kpi
                      label="Max drawdown"
                      value={fmtPct(-Math.abs(kpis.max_drawdown_pct))}
                      accent="#E94F37"
                    />
                    <Kpi
                      label="Best trade"
                      value={fmtUSD(kpis.best_trade?.pnl ?? 0)}
                      sub={kpis.best_trade?.symbol || ""}
                      accent="#00897B"
                    />
                    <Kpi
                      label="Worst trade"
                      value={fmtUSD(kpis.worst_trade?.pnl ?? 0)}
                      sub={kpis.worst_trade?.symbol || ""}
                      accent="#E94F37"
                    />
                  </div>

                  {/* Full trade table — every trade in the snapshot */}
                  {data.trades.length > 0 && (
                    <div
                      style={{
                        borderTop: "1px solid rgba(255,255,255,0.08)",
                        paddingTop: 16,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            color: "#6E8AA8",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10,
                            letterSpacing: "0.18em",
                            textTransform: "uppercase",
                          }}
                        >
                          All trades
                        </div>
                        <div
                          style={{
                            color: "#4A6080",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10,
                          }}
                        >
                          {data.trades.length} total
                        </div>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "32px 1.4fr 0.7fr 0.9fr 1fr",
                          gap: 8,
                          padding: "6px 10px",
                          color: "#4A6080",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 9,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <span>#</span>
                        <span>Symbol</span>
                        <span>Side</span>
                        <span style={{ textAlign: "right" }}>Net %</span>
                        <span style={{ textAlign: "right" }}>Net $</span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                          marginTop: 4,
                        }}
                      >
                        {data.trades.map((t, i) => (
                          <div
                            key={i}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "32px 1.4fr 0.7fr 0.9fr 1fr",
                              gap: 8,
                              padding: "5px 10px",
                              alignItems: "center",
                              background:
                                i % 2 === 0
                                  ? "rgba(255,255,255,0.02)"
                                  : "transparent",
                              borderRadius: 6,
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 10,
                                color: "#4A6080",
                              }}
                            >
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 11,
                                color: "#fff",
                                fontWeight: 600,
                              }}
                            >
                              {t.symbol}
                            </span>
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 9,
                                padding: "2px 6px",
                                borderRadius: 4,
                                background:
                                  t.direction === "BUY"
                                    ? "rgba(0,137,123,0.18)"
                                    : "rgba(233,79,55,0.18)",
                                color:
                                  t.direction === "BUY"
                                    ? "#00897B"
                                    : "#E94F37",
                                width: "fit-content",
                                fontWeight: 600,
                              }}
                            >
                              {t.direction}
                            </span>
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 11,
                                color:
                                  t.pnl >= 0 ? "#00897B" : "#E94F37",
                                textAlign: "right",
                                fontWeight: 600,
                              }}
                            >
                              {fmtPct(t.net_pct ?? 0)}
                            </span>
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 11,
                                color:
                                  t.pnl >= 0 ? "#00897B" : "#E94F37",
                                textAlign: "right",
                                fontWeight: 600,
                              }}
                            >
                              {fmtUSD(t.pnl)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action column */}
              <div className="space-y-3">
                <button
                  onClick={handleDownload}
                  disabled={generatingImg}
                  className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-gradient-to-br from-[#0094C6] to-[#005377] rounded-lg text-[11px] font-mono font-semibold uppercase tracking-widest text-white shadow disabled:opacity-50"
                >
                  {generatingImg ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  Download PNG
                </button>
                <button
                  onClick={handleCopyImage}
                  disabled={generatingImg}
                  className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-[#0D1E35] border border-white/10 hover:border-white/25 rounded-lg text-[11px] font-mono font-semibold uppercase tracking-widest text-white disabled:opacity-50"
                >
                  <Copy size={14} /> Copy image
                </button>

                <div className="pt-2 border-t border-white/8" />

                <button
                  onClick={handleCreateLink}
                  disabled={createShare.isPending || !accountId}
                  className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-[#0D1E35] border border-[#F4A261]/40 hover:border-[#F4A261] hover:text-[#F4A261] rounded-lg text-[11px] font-mono font-semibold uppercase tracking-widest text-[#F4A261]/90 disabled:opacity-50"
                >
                  {createShare.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Share2 size={14} />
                  )}
                  {publicUrl ? "Regenerate link" : "Create public link"}
                </button>

                {publicUrl && (
                  <div className="space-y-2">
                    <div
                      className="text-[10px] font-mono text-white/80 break-all bg-[#061020] border border-white/10 rounded-lg px-3 py-2"
                      data-testid="share-public-url"
                    >
                      {publicUrl}
                    </div>
                    <button
                      onClick={handleCopyLink}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#0D1E35] border border-white/10 hover:border-white/25 rounded-lg text-[11px] font-mono font-semibold uppercase tracking-widest text-white"
                    >
                      {copied ? (
                        <>
                          <Check size={14} /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={14} /> Copy link
                        </>
                      )}
                    </button>
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center px-3 py-2 bg-[#061020] hover:bg-[#0D1E35] border border-white/5 rounded-lg text-[10px] font-mono text-[#6E8AA8] hover:text-white transition uppercase tracking-widest"
                    >
                      Open preview
                    </a>
                  </div>
                )}

                <div className="pt-2 text-[10px] font-mono text-[#4A6080] leading-relaxed">
                  The public link stores the snapshot shown above. Private
                  notes and chart screenshots are never shared.
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          color: "#6E8AA8",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: accent || "#fff",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            color: "#6E8AA8",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

/**
 * Legacy helper kept for unit-test compatibility: picks the 6 trades with
 * the biggest absolute P/L magnitude. The current card renders ALL trades
 * (not just the top 6), but the helper remains exported so the existing
 * vitest suite keeps passing.
 */
export function pickTopTrades(trades: Trade[]): Trade[] {
  return [...trades]
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
    .slice(0, 6);
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
