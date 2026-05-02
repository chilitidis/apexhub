import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  Edit3,
  Notebook,
  Trash2,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect } from "react";

import {
  durationStr,
  fmtDT,
  fmtPct,
  fmtPrice,
  fmtR,
  fmtUSD,
  type Trade,
} from "@/lib/trading";

/**
 * Thumbnail of a TradingView shared chart (used before/after). Falls back
 * gracefully when the URL is unrecognisable or the snapshot CDN is cold.
 */
function getTvThumbnail(url: string): string | null {
  if (!url) return null;
  const m = url.match(/tradingview\.com\/x\/([A-Za-z0-9]+)/);
  if (!m) return null;
  const id = m[1];
  const firstLetter = id[0].toLowerCase();
  return `https://s3.tradingview.com/snapshots/${firstLetter}/${id}.png`;
}

function ChartTile({
  url,
  label,
  accent,
}: {
  url: string;
  label: string;
  accent: string;
  /** `compact` is retained for API compatibility but no longer needed:
   *  the 2×3 grid enforces the tile height via `gridAutoRows`. */
  compact?: boolean;
}) {
  const thumb = getTvThumbnail(url);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-xl overflow-hidden border border-white/10 hover:border-white/25 transition h-full"
      style={{ borderColor: `${accent}33` }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ background: `${accent}18` }}
      >
        <span
          className="font-mono text-[10px] uppercase tracking-[0.15em] font-semibold"
          style={{ color: accent }}
        >
          {label}
        </span>
        <span className="font-mono text-[10px] text-white/40">↗ Open</span>
      </div>
      {thumb ? (
        <div className="relative bg-[#0A1628] flex-1 min-h-0">
          <img
            src={thumb}
            alt={label}
            loading="lazy"
            className="w-full h-full object-contain"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity font-mono text-xs text-white bg-black/60 px-3 py-1.5 rounded-lg">
              Open full chart
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-[#0A1628] flex-1 flex items-center justify-center text-white/30 font-mono text-xs">
          Chart URL attached
        </div>
      )}
    </a>
  );
}

function EmptyChart({
  label,
  accent,
}: {
  label: string;
  accent: string;
}) {
  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden border border-dashed h-full"
      style={{ borderColor: `${accent}33` }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ background: `${accent}10` }}
      >
        <span
          className="font-mono text-[10px] uppercase tracking-[0.15em] font-semibold"
          style={{ color: accent }}
        >
          {label}
        </span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-1 bg-white/[0.02]">
        <div className="font-mono text-[11px] uppercase tracking-widest text-[#6E8AA8]">
          No chart attached
        </div>
        <div className="font-mono text-[10px] text-[#4A6080]">
          Add a TradingView link when editing
        </div>
      </div>
    </div>
  );
}

interface Props {
  trade: Trade | null;
  onClose: () => void;
  onEdit?: (t: Trade) => void;
  onDelete?: (idx: number) => void;
}

/**
 * Full-screen trade-detail modal. Replaces the old right-side drawer with a
 * two-column layout that pushes the trader's psychology/notes prominently
 * into view instead of hiding them in a narrow strip.
 *
 * Layout (desktop):
 *   - 90vw × 90vh dialog, rounded 2xl
 *   - Left column: execution facts + big P/L hero
 *   - Right column: TradingView before/after thumbnails
 *   - Bottom full-width strip: Psychology + Notes cards (stacked on mobile)
 */
export default function TradeDetailDialog({
  trade,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  useEffect(() => {
    if (!trade) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trade, onClose]);

  return (
    <AnimatePresence>
      {trade && (
        <>
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
            aria-label={`Trade detail: ${trade.symbol} ${trade.direction}`}
            data-testid="trade-detail-dialog"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-6 pointer-events-none overflow-y-auto overscroll-contain"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div className="w-full max-w-[1200px] sm:h-[92vh] my-2 sm:my-0 bg-[#0A1628] border border-white/10 rounded-2xl overflow-hidden shadow-2xl pointer-events-auto flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 px-5 sm:px-8 py-4 sm:py-5 border-b border-white/8 shrink-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-['Bebas_Neue'] text-2xl sm:text-4xl text-white tracking-wide leading-none">
                    {trade.symbol}
                  </span>
                  <span
                    className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded ${
                      trade.direction === "BUY"
                        ? "bg-[#00897B]/20 text-[#00897B] border border-[#00897B]/30"
                        : "bg-[#E94F37]/20 text-[#E94F37] border border-[#E94F37]/30"
                    }`}
                  >
                    {trade.direction}
                  </span>
                  <div className="font-mono text-[11px] text-[#6E8AA8] uppercase tracking-widest">
                    Trade #{String(trade.idx).padStart(2, "0")} ·{" "}
                    {trade.tf || "H1"}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(trade)}
                      className="p-2 rounded-lg text-[#6E8AA8] hover:text-[#0094C6] hover:bg-[#0094C6]/10 transition-all"
                      title="Edit trade"
                    >
                      <Edit3 size={18} />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(trade.idx)}
                      className="p-2 rounded-lg text-[#6E8AA8] hover:text-[#E94F37] hover:bg-[#E94F37]/10 transition-all"
                      title="Delete trade"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg text-[#6E8AA8] hover:text-white hover:bg-white/10 transition-colors"
                    title="Close (Esc)"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto">
                {/*
                  Round-6 redesign — **true 2×3 grid**.
                  Three equal-width columns, two equal-height rows:
                     col 1 → Net P/L     |  Execution
                     col 2 → Before chart |  After chart
                     col 3 → Psychology  |  Trade notes
                  Every cell shares the same padding, the same corner
                  radius, the same row height (`--trade-row-h`), and the
                  same column min-width (`minmax(0,1fr)`), so the whole
                  dialog reads as a perfectly symmetric 6-tile board.
                */}
                <div
                  className="px-3 sm:px-8 py-4 sm:py-6 grid gap-3 sm:gap-5 grid-cols-1 sm:[grid-template-columns:repeat(3,minmax(0,1fr))] [grid-auto-rows:minmax(260px,auto)] sm:[grid-auto-rows:var(--trade-row-h)] [--trade-row-h:clamp(220px,34vh,320px)]"
                >
                  {/* row 1 */}
                  <PnlHero trade={trade} />
                  {trade.chart_before ? (
                    <ChartTile
                      url={trade.chart_before}
                      label="Before"
                      accent="#F4A261"
                      compact
                    />
                  ) : (
                    <EmptyChart label="Before" accent="#F4A261" />
                  )}
                  <NoteCard
                    icon={<Brain size={16} className="text-[#5E60CE]" />}
                    title="Psychology"
                    accent="#5E60CE"
                    text={trade.psychology ?? ""}
                    emptyHint="No psychological notes for this trade yet."
                  />

                  {/* row 2 */}
                  <ExecutionFacts trade={trade} />
                  {trade.chart_after ? (
                    <ChartTile
                      url={trade.chart_after}
                      label="After"
                      accent="#0094C6"
                      compact
                    />
                  ) : (
                    <EmptyChart label="After" accent="#0094C6" />
                  )}
                  <NoteCard
                    icon={<Notebook size={16} className="text-[#0094C6]" />}
                    title="Trade notes"
                    accent="#0094C6"
                    text={
                      trade.notes ??
                      [trade.lessons_learned, trade.pre_checklist]
                        .filter(Boolean)
                        .join("\n\n") ??
                      ""
                    }
                    emptyHint="No notes attached to this trade yet."
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function PnlHero({ trade }: { trade: Trade }) {
  const isPos = trade.pnl >= 0;
  return (
    <div
      className={`rounded-xl border flex flex-col h-full overflow-hidden ${
        isPos
          ? "bg-[#00897B]/10 border-[#00897B]/25"
          : "bg-[#E94F37]/10 border-[#E94F37]/25"
      }`}
    >
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0 border-b"
        style={{
          background: isPos ? "#00897B18" : "#E94F3718",
          borderColor: isPos ? "#00897B22" : "#E94F3722",
        }}
      >
        <span
          className="font-mono text-[10px] uppercase tracking-[0.15em] font-semibold"
          style={{ color: isPos ? "#00897B" : "#E94F37" }}
        >
          Net P/L
        </span>
      </div>
      <div className="flex-1 flex flex-col justify-center px-5 py-4 gap-2">
        <div
          className={`font-mono font-bold text-3xl sm:text-4xl leading-tight ${
            isPos ? "text-[#00897B]" : "text-[#E94F37]"
          }`}
        >
          {fmtUSD(trade.pnl)}
        </div>
        {trade.net_pct !== 0 && (
          <div className="font-mono text-sm text-[#6E8AA8]">
            {fmtPct(trade.net_pct)}
          </div>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] font-mono text-[#6E8AA8]">
          <span>Swap: {fmtUSD(trade.swap)}</span>
          <span>Comm: {fmtUSD(trade.commission)}</span>
          {trade.trade_r !== null && (
            <span
              className={
                trade.trade_r >= 0 ? "text-[#00897B]" : "text-[#E94F37]"
              }
            >
              {fmtR(trade.trade_r)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ExecutionFacts({ trade }: { trade: Trade }) {
  const rows: Array<[string, string]> = [
    ["Open", fmtDT(trade.open)],
    ["Close", fmtDT(trade.close_time)],
    ["Duration", durationStr(trade.open, trade.close_time)],
    ["Lots", String(trade.lots)],
    ["Entry", fmtPrice(trade.entry)],
    ["Exit", fmtPrice(trade.close)],
    ["SL", fmtPrice(trade.sl)],
    ["TP", fmtPrice(trade.tp)],
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] flex flex-col h-full overflow-hidden">
      <div className="px-4 py-2 border-b border-white/10 text-[#6E8AA8] font-mono text-[10px] uppercase tracking-[0.15em] shrink-0">
        Execution
      </div>
      <div className="flex-1 flex flex-col divide-y divide-white/5 min-h-0">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex-1 flex items-center justify-between px-4"
          >
            <span className="font-mono text-[10px] text-[#6E8AA8] uppercase tracking-wider">
              {label}
            </span>
            <span className="font-mono text-[12px] text-white">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NoteCard({
  icon,
  title,
  accent,
  text,
  emptyHint,
}: {
  icon: React.ReactNode;
  title: string;
  accent: string;
  text: string;
  emptyHint: string;
}) {
  const trimmed = (text || "").trim();
  const isEmpty = trimmed.length === 0;

  return (
    <div
      className="rounded-xl border bg-white/[0.02] overflow-hidden flex flex-col h-full"
      style={{ borderColor: `${accent}33` }}
    >
      <div
        className="flex items-center gap-2 px-4 py-2 border-b shrink-0"
        style={{
          background: `${accent}12`,
          borderColor: `${accent}22`,
        }}
      >
        {icon}
        <span
          className="font-mono text-[10px] uppercase tracking-[0.15em] font-semibold"
          style={{ color: accent }}
        >
          {title}
        </span>
      </div>
      <div className="px-4 py-4 flex-1 min-h-0 overflow-y-auto">
        {isEmpty ? (
          <div className="text-[#4A6080] font-mono text-[11px] italic">
            {emptyHint}
          </div>
        ) : (
          <div
            className="text-[#D6E2F0] text-[13px] leading-relaxed whitespace-pre-wrap"
            data-testid={`note-${title.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {trimmed}
          </div>
        )}
      </div>
    </div>
  );
}
