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

import { useTheme } from "@/contexts/ThemeContext";
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
 * Round-4 Share Card dialog
 * ========================
 *
 * Improvements over round-3:
 *
 * - Theme sync: the card now mirrors the active app theme (`light` vs
 *   `dark`). Colours, borders, text and accents all adapt so a Light-mode
 *   trader no longer sees a dark navy card when they hit Share. The theme
 *   is also persisted into the server payload so the public `/s/:token`
 *   view renders in the same palette.
 * - Filled hero: the empty right-hand gap next to `+3,66%` is now occupied
 *   by a big Bebas-Neue month label (e.g. `ΑΠΡΙΛΙΟΣ ’26`). The hero feels
 *   balanced and editorial.
 * - Non-blocking renders: `toPng` / `toBlob` are invoked after an explicit
 *   `requestAnimationFrame` + micro-task yield, so clicking
 *   "Download PNG" no longer freezes the UI for a couple of seconds — a
 *   spinner overlay appears instantly and the rasterisation runs off the
 *   critical path.
 * - Silent copy fallback: when the browser refuses `ClipboardItem` we now
 *   silently trigger a download instead of showing a confusing toast.
 * - Always-fresh public link: opening the dialog or editing the underlying
 *   trades clears any previous public URL, guaranteeing that the next
 *   "Create public link" reflects exactly what you see on screen.
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

  const { theme } = useTheme();
  const palette = getPalette(theme);

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
  }, [open, accountId, data.trades, data.kpis.starting, theme]);

  if (!open) return null;

  const accent = account?.color || palette.accent;
  const accountLabel = account?.name || "My Trading Account";
  const monthLabel = data.meta?.month_name
    ? `${data.meta.month_name} ’${data.meta.year_short}`
    : "All time";
  const monthHero = data.meta?.month_name || "SNAPSHOT";
  const yearShort = data.meta?.year_short ? `’${data.meta.year_short}` : "";

  /**
   * Schedule `task` on the next paint + micro-task boundary so the button's
   * `disabled` state and the spinner overlay are committed to the DOM
   * *before* the heavy toPng/toBlob work starts. Without this yield the
   * browser blocks the paint and the UI appears to freeze.
   */
  const deferHeavyWork = async <T,>(task: () => Promise<T>): Promise<T> => {
    await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
    await new Promise(resolve => setTimeout(resolve, 0));
    return task();
  };

  const renderOptions = useMemo(
    () => ({
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: palette.cardBg,
    }),
    [palette.cardBg],
  );

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setGeneratingImg(true);
    try {
      const dataUrl = await deferHeavyWork(() =>
        toPng(cardRef.current!, renderOptions),
      );
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
      const blob = await deferHeavyWork(() =>
        toBlob(cardRef.current!, renderOptions),
      );
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
          // Silent fallback: don't nag the user with a "browser does not
          // support" message — just download the image so they always end
          // up with something they can paste/share.
          console.warn(
            "[ShareCard] clipboard.write refused, falling back to download",
            clipErr,
          );
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `UTJ_${slugify(accountLabel)}_${slugify(monthLabel)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Share card downloaded");
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
          theme,
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
        <div
          className="w-full max-w-[1040px] max-h-[94vh] rounded-2xl overflow-hidden shadow-2xl pointer-events-auto flex flex-col"
          style={{
            background: palette.shellBg,
            border: `1px solid ${palette.border}`,
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between gap-4 px-5 py-4 shrink-0"
            style={{ borderBottom: `1px solid ${palette.border}` }}
          >
            <div className="flex items-center gap-2">
              <Share2 size={18} style={{ color: palette.accentGold }} />
              <span
                className="font-['Space_Grotesk'] font-semibold text-base"
                style={{ color: palette.fg }}
              >
                Share snapshot
              </span>
              <span
                className="font-mono text-[10px] uppercase tracking-widest hidden sm:block"
                style={{ color: palette.muted }}
              >
                · {accountLabel} · {monthLabel}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors"
              style={{ color: palette.muted }}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 relative">
            {/* Progress overlay — visible while rasterising the PNG */}
            {generatingImg && (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center"
                style={{
                  background: `${palette.cardBg}CC`,
                  backdropFilter: "blur(4px)",
                }}
              >
                <div
                  className="flex items-center gap-3 px-5 py-3 rounded-xl"
                  style={{
                    background: palette.shellBg,
                    border: `1px solid ${palette.border}`,
                  }}
                >
                  <Loader2
                    size={18}
                    className="animate-spin"
                    style={{ color: palette.accentGold }}
                  />
                  <span
                    className="font-mono text-[11px] uppercase tracking-widest"
                    style={{ color: palette.fg }}
                  >
                    Rendering snapshot…
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[1fr,280px] gap-5">
              {/* Preview card */}
              <div
                className="rounded-2xl overflow-hidden shadow-xl"
                style={{ border: `1px solid ${palette.border}` }}
              >
                <div
                  ref={cardRef}
                  data-testid="share-card-preview"
                  className="w-full"
                  style={{
                    background: palette.cardGradient,
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
                            color: palette.fg,
                            fontWeight: 600,
                            fontSize: 14,
                            letterSpacing: "0.02em",
                          }}
                        >
                          ULTIMATE TRADING JOURNAL
                        </div>
                        <div
                          style={{
                            color: palette.muted,
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
                          color: palette.fg,
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

                  {/* Hero block: % (left) + big month label (right) */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.1fr 1fr",
                      gap: 24,
                      alignItems: "end",
                      marginBottom: 24,
                      minHeight: 160,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: palette.muted,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 10,
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                          marginBottom: 6,
                        }}
                      >
                        Net return
                      </div>
                      <div
                        style={{
                          color: isPos
                            ? palette.profit
                            : palette.loss,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 88,
                          fontWeight: 700,
                          letterSpacing: "-0.02em",
                          lineHeight: 1,
                        }}
                      >
                        {fmtPct(kpis.return_pct)}
                      </div>
                      <div
                        style={{
                          marginTop: 10,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 12,
                          color: palette.muted,
                          letterSpacing: "0.05em",
                        }}
                      >
                        {kpis.total_trades} trades · {kpis.wins}W · {kpis.losses}L
                      </div>
                    </div>

                    <div
                      style={{
                        textAlign: "right",
                        alignSelf: "stretch",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        lineHeight: 0.9,
                      }}
                    >
                      <div
                        style={{
                          color: palette.muted,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 10,
                          letterSpacing: "0.24em",
                          textTransform: "uppercase",
                          marginBottom: 10,
                        }}
                      >
                        Snapshot · {monthLabel}
                      </div>
                      <div
                        style={{
                          fontFamily: "'Bebas Neue', 'Arial Narrow', sans-serif",
                          fontSize: 96,
                          letterSpacing: "0.02em",
                          color: palette.fg,
                          fontWeight: 400,
                          lineHeight: 0.9,
                        }}
                      >
                        {monthHero}
                      </div>
                      {yearShort && (
                        <div
                          style={{
                            fontFamily:
                              "'Bebas Neue', 'Arial Narrow', sans-serif",
                            fontSize: 52,
                            letterSpacing: "0.05em",
                            color: accent,
                            fontWeight: 400,
                            lineHeight: 1,
                            marginTop: 4,
                          }}
                        >
                          {yearShort}
                        </div>
                      )}
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
                      palette={palette}
                      label="Win rate"
                      value={`${(kpis.win_rate * 100).toFixed(0)}%`}
                    />
                    <Kpi
                      palette={palette}
                      label="Profit factor"
                      value={profitFactorText}
                    />
                    <Kpi
                      palette={palette}
                      label="Avg R"
                      value={kpis.avg_r.toFixed(2)}
                    />
                    <Kpi
                      palette={palette}
                      label="Max drawdown"
                      value={fmtPct(-Math.abs(kpis.max_drawdown_pct))}
                      accent={palette.loss}
                    />
                    <Kpi
                      palette={palette}
                      label="Best trade"
                      value={fmtUSD(kpis.best_trade?.pnl ?? 0)}
                      sub={kpis.best_trade?.symbol || ""}
                      accent={palette.profit}
                    />
                    <Kpi
                      palette={palette}
                      label="Worst trade"
                      value={fmtUSD(kpis.worst_trade?.pnl ?? 0)}
                      sub={kpis.worst_trade?.symbol || ""}
                      accent={palette.loss}
                    />
                  </div>

                  {/* Full trade table */}
                  {data.trades.length > 0 && (
                    <div
                      style={{
                        borderTop: `1px solid ${palette.border}`,
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
                            color: palette.muted,
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
                            color: palette.mutedFaded,
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
                          color: palette.mutedFaded,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 9,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          borderBottom: `1px solid ${palette.borderFaded}`,
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
                                i % 2 === 0 ? palette.rowZebra : "transparent",
                              borderRadius: 6,
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 10,
                                color: palette.mutedFaded,
                              }}
                            >
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 11,
                                color: palette.fg,
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
                                    ? `${palette.profit}2E`
                                    : `${palette.loss}2E`,
                                color:
                                  t.direction === "BUY"
                                    ? palette.profit
                                    : palette.loss,
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
                                  t.pnl >= 0 ? palette.profit : palette.loss,
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
                                  t.pnl >= 0 ? palette.profit : palette.loss,
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
                  className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-[11px] font-mono font-semibold uppercase tracking-widest text-white shadow disabled:opacity-50"
                  style={{
                    background:
                      "linear-gradient(145deg,#0094C6 0%,#005377 100%)",
                  }}
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
                  className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-[11px] font-mono font-semibold uppercase tracking-widest disabled:opacity-50"
                  style={{
                    background: palette.shellBg,
                    border: `1px solid ${palette.border}`,
                    color: palette.fg,
                  }}
                >
                  <Copy size={14} /> Copy image
                </button>

                <div
                  className="pt-2"
                  style={{ borderTop: `1px solid ${palette.border}` }}
                />

                <button
                  onClick={handleCreateLink}
                  disabled={createShare.isPending || !accountId}
                  className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-[11px] font-mono font-semibold uppercase tracking-widest disabled:opacity-50"
                  style={{
                    background: palette.shellBg,
                    border: `1px solid ${palette.accentGold}55`,
                    color: palette.accentGold,
                  }}
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
                      className="text-[10px] font-mono break-all rounded-lg px-3 py-2"
                      style={{
                        background: palette.cardBg,
                        border: `1px solid ${palette.border}`,
                        color: palette.fg,
                      }}
                      data-testid="share-public-url"
                    >
                      {publicUrl}
                    </div>
                    <button
                      onClick={handleCopyLink}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[11px] font-mono font-semibold uppercase tracking-widest"
                      style={{
                        background: palette.shellBg,
                        border: `1px solid ${palette.border}`,
                        color: palette.fg,
                      }}
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
                      className="block w-full text-center px-3 py-2 rounded-lg text-[10px] font-mono uppercase tracking-widest transition"
                      style={{
                        background: palette.cardBg,
                        border: `1px solid ${palette.borderFaded}`,
                        color: palette.muted,
                      }}
                    >
                      Open preview
                    </a>
                  </div>
                )}

                <div
                  className="pt-2 text-[10px] font-mono leading-relaxed"
                  style={{ color: palette.mutedFaded }}
                >
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

interface Palette {
  shellBg: string;
  cardBg: string;
  cardGradient: string;
  fg: string;
  muted: string;
  mutedFaded: string;
  border: string;
  borderFaded: string;
  rowZebra: string;
  profit: string;
  loss: string;
  accent: string;
  accentGold: string;
}

function getPalette(theme: "light" | "dark"): Palette {
  if (theme === "light") {
    return {
      // Match the app's cream "paper" light surface so the Share card no
      // longer looks out-of-place when the user switched the UI to Light.
      shellBg: "#F7F2E7",
      cardBg: "#FDFAF1",
      cardGradient:
        "linear-gradient(145deg, #FDFAF1 0%, #F5EEDC 60%, #ECE3CC 100%)",
      fg: "#1A2436",
      muted: "#5B6B82",
      mutedFaded: "#94A3B8",
      border: "rgba(26,36,54,0.12)",
      borderFaded: "rgba(26,36,54,0.08)",
      rowZebra: "rgba(26,36,54,0.035)",
      profit: "#0F766E",
      loss: "#C2410C",
      accent: "#0077B6",
      accentGold: "#B45309",
    };
  }
  return {
    shellBg: "#0A1628",
    cardBg: "#0A1628",
    cardGradient:
      "linear-gradient(145deg, #0A1628 0%, #0D1E35 60%, #061020 100%)",
    fg: "#FFFFFF",
    muted: "#6E8AA8",
    mutedFaded: "#4A6080",
    border: "rgba(255,255,255,0.10)",
    borderFaded: "rgba(255,255,255,0.06)",
    rowZebra: "rgba(255,255,255,0.025)",
    profit: "#00897B",
    loss: "#E94F37",
    accent: "#0094C6",
    accentGold: "#F4A261",
  };
}

function Kpi({
  label,
  value,
  sub,
  accent,
  palette,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  palette: Palette;
}) {
  return (
    <div
      style={{
        background: palette.rowZebra,
        border: `1px solid ${palette.borderFaded}`,
        borderRadius: 12,
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          color: palette.muted,
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
          color: accent || palette.fg,
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
            color: palette.muted,
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
 * the biggest absolute P/L magnitude.
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
