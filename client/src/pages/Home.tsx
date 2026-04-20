// ===== TITANS Trading Journal — Main Dashboard =====
// Design: Ocean Depth Premium — deep navy, ocean blue accents, teal/coral for P/L
// Layout: Full-width dashboard, sticky topbar, hero section, KPI grid, charts, trades table

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Upload, RefreshCw, Download,
  Activity, Target, BarChart2, Award, AlertTriangle, X,
  ChevronDown, Search, Filter, Zap, Shield
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, Cell, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { DEFAULT_DATA } from '@/lib/defaultData';
import type { TradingData, Trade } from '@/lib/trading';
import { fmtUSD, fmtUSDnoSign, fmtPct, fmtR, fmtPrice, fmtDT, dayShort, durationStr, parseExcelToTradingData } from '@/lib/trading';
import { toast } from 'sonner';

// ===== HERO BACKGROUND =====
const HERO_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663576082454/8kEKtsKWxF9JiwbjRbrvBM/titans-hero-bg-oSsnHtDa4d4m94aQURkp85.webp';

// ===== CHART COLORS =====
const C_OCEAN = '#0077B6';
const C_PROFIT = '#00897B';
const C_LOSS = '#E94F37';
const C_GOLD = '#F4A261';
const C_VIOLET = '#5E60CE';
const C_MUTED = '#4A6080';

// ===== CUSTOM TOOLTIP =====
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0D1E35] border border-white/10 rounded-lg p-3 shadow-xl text-xs">
      <div className="text-[#4A6080] mb-1 font-mono uppercase tracking-wider">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="font-mono font-semibold" style={{ color: p.color }}>
          {typeof p.value === 'number' && Math.abs(p.value) > 100
            ? fmtUSDnoSign(p.value)
            : p.value}
        </div>
      ))}
    </div>
  );
};

// ===== CHART THUMBNAIL HELPER =====
// TradingView snapshot URL pattern:
//   https://www.tradingview.com/x/{ID}/  →  https://s3.tradingview.com/snapshots/{first_letter_lowercase}/{ID}.png
function getTvThumbnail(url: string): string | null {
  if (!url) return null;
  // Match /x/XXXXXX/ or /x/XXXXXX (with or without trailing slash)
  const m = url.match(/tradingview\.com\/x\/([A-Za-z0-9]+)/);
  if (!m) return null;
  const id = m[1];
  const firstLetter = id[0].toLowerCase();
  return `https://s3.tradingview.com/snapshots/${firstLetter}/${id}.png`;
}

interface ChartThumbnailsProps {
  before: string;
  after: string;
}

function ChartThumbnail({ url, label, accentColor }: { url: string; label: string; accentColor: string }) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const thumbUrl = getTvThumbnail(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl overflow-hidden border border-white/8 hover:border-white/20 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
      style={{ borderColor: `${accentColor}22` }}
    >
      {/* Label bar */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: `${accentColor}18`, borderBottom: `1px solid ${accentColor}22` }}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: accentColor }}>
          {label}
        </span>
        <span className="font-mono text-[9px] text-white/40 group-hover:text-white/70 transition-colors">
          TradingView ↗
        </span>
      </div>

      {/* Image area */}
      <div className="relative bg-[#060E1A]" style={{ aspectRatio: '16/9' }}>
        {thumbUrl && !imgError ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
              </div>
            )}
            <img
              src={thumbUrl}
              alt={`${label} chart`}
              className={`w-full h-full object-cover transition-opacity duration-500 ${
                imgLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
            {/* Hover overlay */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"
              style={{ background: `${accentColor}15` }}
            >
              <div
                className="px-3 py-1.5 rounded-full text-[10px] font-mono font-bold backdrop-blur-sm"
                style={{ background: `${accentColor}30`, color: accentColor, border: `1px solid ${accentColor}50` }}
              >
                Open Full Chart
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="text-white/20 text-2xl">■</div>
            <span className="font-mono text-[10px] text-white/30">Click to open chart</span>
          </div>
        )}
      </div>
    </a>
  );
}

function ChartThumbnails({ before, after }: ChartThumbnailsProps) {
  return (
    <div>
      <div className="text-xs font-mono uppercase tracking-widest text-[#4A6080] mb-3 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#F4A261]" />
        Charts
      </div>
      <div className="grid grid-cols-1 gap-3">
        {before && <ChartThumbnail url={before} label="Before" accentColor="#F4A261" />}
        {after && <ChartThumbnail url={after} label="After" accentColor="#0077B6" />}
      </div>
    </div>
  );
}

// ===== TRADE DRAWER =====
interface DrawerProps {
  trade: Trade | null;
  onClose: () => void;
}

function TradeDrawer({ trade, onClose }: DrawerProps) {
  if (!trade) return null;
  const isPnlPos = trade.pnl >= 0;

  return (
    <AnimatePresence>
      {trade && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-[#0A1628] border-l border-white/8 z-50 overflow-y-auto"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-['Bebas_Neue'] text-3xl text-white tracking-wide">{trade.symbol}</span>
                    <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${
                      trade.direction === 'BUY'
                        ? 'bg-[#00897B]/20 text-[#00897B] border border-[#00897B]/30'
                        : 'bg-[#E94F37]/20 text-[#E94F37] border border-[#E94F37]/30'
                    }`}>{trade.direction}</span>
                  </div>
                  <div className="text-[#4A6080] font-mono text-xs">
                    Trade #{String(trade.idx).padStart(2, '0')} · {trade.tf || 'H1'}
                  </div>
                </div>
                <button onClick={onClose} className="text-[#4A6080] hover:text-white transition-colors p-1">
                  <X size={20} />
                </button>
              </div>

              {/* P/L Banner */}
              <div className={`rounded-xl p-4 mb-6 border ${
                isPnlPos ? 'bg-[#00897B]/10 border-[#00897B]/20' : 'bg-[#E94F37]/10 border-[#E94F37]/20'
              }`}>
                <div className="text-[#4A6080] font-mono text-xs uppercase tracking-wider mb-1">Net P/L</div>
                <div className={`font-mono text-3xl font-bold ${isPnlPos ? 'text-[#00897B]' : 'text-[#E94F37]'}`}>
                  {fmtUSD(trade.pnl)}
                </div>
                <div className={`font-mono text-sm mt-1 ${isPnlPos ? 'text-[#00897B]/70' : 'text-[#E94F37]/70'}`}>
                  {fmtPct(trade.net_pct)} · {fmtR(trade.trade_r)}
                </div>
              </div>

              {/* Execution Details */}
              <div className="mb-4">
                <div className="text-xs font-mono uppercase tracking-widest text-[#4A6080] mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#0077B6]" />
                  Execution
                </div>
                <div className="space-y-2">
                  {[
                    ['Open Time', fmtDT(trade.open)],
                    ['Close Time', fmtDT(trade.close_time)],
                    ['Duration', durationStr(trade.open, trade.close_time)],
                    ['Lots', trade.lots.toString()],
                    ['Entry', fmtPrice(trade.entry)],
                    ['Exit', fmtPrice(trade.close)],
                    ['Balance Before', fmtUSDnoSign(trade.balance_before)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center py-1.5 border-b border-white/5">
                      <span className="text-[#4A6080] text-xs">{k}</span>
                      <span className="font-mono text-sm text-white/90">{v}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                    <span className="text-[#4A6080] text-xs">Stop Loss</span>
                    <span className="font-mono text-sm text-[#E94F37]">{fmtPrice(trade.sl)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                    <span className="text-[#4A6080] text-xs">Take Profit</span>
                    <span className="font-mono text-sm text-[#00897B]">{fmtPrice(trade.tp)}</span>
                  </div>
                </div>
              </div>

              {/* Performance */}
              <div className="mb-4">
                <div className="text-xs font-mono uppercase tracking-widest text-[#4A6080] mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#00897B]" />
                  Performance
                </div>
                <div className="space-y-2">
                  {[
                    ['Trade R', <span className={`font-mono text-sm ${trade.trade_r !== null && trade.trade_r >= 0 ? 'text-[#00897B]' : 'text-[#E94F37]'}`}>{fmtR(trade.trade_r)}</span>],
                    ['Swap', <span className="font-mono text-sm text-white/90">{fmtUSD(trade.swap)}</span>],
                    ['Commission', <span className="font-mono text-sm text-white/90">{fmtUSD(trade.commission)}</span>],
                    ['Balance After', <span className="font-mono text-sm font-bold text-white">{fmtUSDnoSign(trade.balance_after)}</span>],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="flex justify-between items-center py-1.5 border-b border-white/5">
                      <span className="text-[#4A6080] text-xs">{k}</span>
                      {v}
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart Thumbnails */}
              {(trade.chart_before || trade.chart_after) && (
                <ChartThumbnails before={trade.chart_before} after={trade.chart_after} />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ===== KPI CARD =====
interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  icon?: React.ReactNode;
  valueClass?: string;
  delay?: number;
}

function KpiCard({ label, value, sub, accent = C_OCEAN, icon, valueClass = 'text-white', delay = 0 }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative bg-[#0D1E35]/80 border border-white/8 rounded-xl p-4 overflow-hidden backdrop-blur-sm hover:border-white/15 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
      style={{ boxShadow: `0 0 0 0 ${accent}` }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl" style={{ background: accent }} />
      <div className="flex items-start justify-between mb-2">
        <div className="text-[#4A6080] font-mono text-[9px] uppercase tracking-[0.15em]">{label}</div>
        {icon && <div className="text-[#4A6080]">{icon}</div>}
      </div>
      <div className={`font-mono text-xl font-semibold leading-tight ${valueClass}`}>{value}</div>
      {sub && <div className="font-mono text-[10px] text-[#4A6080] mt-1.5">{sub}</div>}
    </motion.div>
  );
}

// ===== MAIN DASHBOARD =====
export default function Home() {
  const [data, setData] = useState<TradingData>(DEFAULT_DATA);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [filter, setFilter] = useState<'all' | 'wins' | 'losses' | 'buy' | 'sell'>('all');
  const [search, setSearch] = useState('');
  const [chartTab, setChartTab] = useState<'equity' | 'drawdown' | 'pnl'>('equity');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Παρακαλώ ανέβασε αρχείο Excel (.xlsx ή .xls)');
      return;
    }
    try {
      const parsed = await parseExcelToTradingData(file);
      setData(parsed);
      setFilter('all');
      setSearch('');
      setChartTab('equity');
      toast.success(`✓ Συγχρονίστηκαν ${parsed.trades.length} trades από ${file.name}`);
    } catch (err: any) {
      toast.error(err?.message || 'Σφάλμα κατά την ανάγνωση του Excel');
    }
  }, []);

  // Drag & drop
  useEffect(() => {
    const onDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const onDragLeave = () => setIsDragging(false);
    const onDrop = (e: DragEvent) => {
      e.preventDefault(); setIsDragging(false);
      const file = e.dataTransfer?.files[0];
      if (file) handleFile(file);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleFile]);

  const { trades, kpis, symbols, meta } = data;

  // Filtered trades
  const filteredTrades = trades.filter(t => {
    if (filter === 'wins' && t.pnl <= 0) return false;
    if (filter === 'losses' && t.pnl >= 0) return false;
    if (filter === 'buy' && t.direction !== 'BUY') return false;
    if (filter === 'sell' && t.direction !== 'SELL') return false;
    if (search && !t.symbol.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Equity curve data
  const equityData = [
    { name: 'Start', value: kpis.starting, drawdown: 0, pnl: 0 },
    ...trades.map((t, i) => {
      const peak = Math.max(kpis.starting, ...trades.slice(0, i + 1).map(x => x.balance_after));
      const dd = peak > 0 ? ((peak - t.balance_after) / peak) * 100 : 0;
      return {
        name: `#${t.idx}`,
        value: t.balance_after,
        drawdown: -dd,
        pnl: t.pnl,
      };
    }),
  ];

  // P/L bar data
  const pnlBarData = trades.map(t => ({
    name: `#${t.idx}`,
    symbol: t.symbol,
    value: t.pnl,
  }));

  // Symbol bar data
  const symbolData = symbols.slice(0, 9).map(s => ({
    name: s.symbol,
    value: s.pnl,
    trades: s.trades,
    wr: (s.win_rate * 100).toFixed(0) + '%',
  }));

  // Win/Loss donut
  const donutData = [
    { name: 'Wins', value: kpis.wins, fill: C_PROFIT },
    { name: 'Losses', value: kpis.losses, fill: C_LOSS },
  ];

  const isNeg = kpis.net_result < 0;

  return (
    <div className="min-h-screen bg-[#070F1C] text-white overflow-x-hidden">

      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#070F1C]/90 backdrop-blur-md flex items-center justify-center"
          >
            <div className="border-2 border-dashed border-[#0077B6] rounded-2xl p-16 text-center">
              <Upload size={48} className="text-[#0077B6] mx-auto mb-4" />
              <div className="font-['Space_Grotesk'] text-2xl font-semibold text-white mb-2">Drop Excel here</div>
              <div className="font-mono text-xs text-[#4A6080] uppercase tracking-widest">.xlsx · .xls</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />

      {/* ===== TOPBAR ===== */}
      <div className="sticky top-0 z-30 bg-[#070F1C]/90 backdrop-blur-md border-b border-white/8">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0077B6] to-[#023E8A] flex items-center justify-center shadow-lg shadow-[#0077B6]/30">
              <TrendingUp size={16} className="text-white" />
            </div>
            <div>
              <div className="font-['Space_Grotesk'] font-semibold text-sm text-white tracking-wide">APEXHUB</div>
              <div className="font-mono text-[9px] text-[#4A6080] uppercase tracking-[0.12em]">TRADING JOURNAL</div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#4A6080]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00897B] animate-pulse-dot" />
              LIVE
            </div>
            <div className="hidden sm:block font-mono text-[10px] text-[#4A6080]">
              SYNC · {meta.last_sync}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0D1E35] border border-white/10 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider text-white/80 hover:border-[#0077B6] hover:text-[#0077B6] transition-all"
            >
              <Upload size={12} /> SYNC
            </button>
            <button
              onClick={() => { setData(DEFAULT_DATA); toast.success('Reset to default data'); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0D1E35] border border-white/10 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider text-white/80 hover:border-white/30 transition-all"
            >
              <RefreshCw size={12} /> RESET
            </button>
          </div>
        </div>
      </div>

      {/* ===== HERO ===== */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${HERO_BG})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#070F1C]/60 to-[#070F1C]" />
        <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="font-['Bebas_Neue'] text-[clamp(52px,10vw,100px)] leading-none tracking-wide text-white"
              >
                {meta.month_name} <span className="text-[#0077B6]">'{meta.year_short}</span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="font-mono text-[10px] text-[#4A6080] uppercase tracking-[0.15em] mt-2"
              >
                APEXHUB · {kpis.total_trades} TRADES · {(kpis.win_rate * 100).toFixed(1)}% WR
              </motion.div>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-right"
            >
              <div className="font-mono text-[10px] text-[#4A6080] uppercase tracking-[0.15em] mb-1">Current Balance</div>
              <div className="font-mono text-[clamp(28px,5vw,48px)] font-semibold text-white leading-none">
                {fmtUSDnoSign(kpis.ending)}
              </div>
              <div className={`font-mono text-sm mt-2 ${isNeg ? 'text-[#E94F37]' : 'text-[#00897B]'}`}>
                {isNeg ? '▼' : '▲'} {fmtUSD(kpis.net_result)} ({fmtPct(kpis.return_pct)})
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-8">

        {/* ===== KPI GRID ===== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="◉ Starting" value={fmtUSDnoSign(kpis.starting)} sub="Base · USD" accent={C_OCEAN} icon={<Shield size={12} />} delay={0.05} />
          <KpiCard
            label="▲ Net P/L"
            value={fmtUSD(kpis.net_result)}
            sub={fmtPct(kpis.return_pct) + ' of starting'}
            accent={kpis.net_result >= 0 ? C_PROFIT : C_LOSS}
            icon={kpis.net_result >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            valueClass={kpis.net_result >= 0 ? 'text-[#00897B]' : 'text-[#E94F37]'}
            delay={0.1}
          />
          <KpiCard
            label="◈ Win Rate"
            value={(kpis.win_rate * 100).toFixed(1) + '%'}
            sub={`${kpis.wins}W / ${kpis.losses}L`}
            accent={C_GOLD}
            icon={<Target size={12} />}
            delay={0.15}
          />
          <KpiCard label="■ Trades" value={String(kpis.total_trades)} sub="Executed · closed" accent={C_VIOLET} icon={<Activity size={12} />} delay={0.2} />
          <KpiCard
            label="★ Best Trade"
            value={fmtUSD(kpis.best_trade.pnl)}
            sub={`${kpis.best_trade.symbol} · #${kpis.best_trade.idx}`}
            accent={C_PROFIT}
            icon={<Award size={12} />}
            valueClass="text-[#00897B]"
            delay={0.25}
          />
          <KpiCard
            label="▼ Worst Trade"
            value={fmtUSD(kpis.worst_trade.pnl)}
            sub={`${kpis.worst_trade.symbol} · #${kpis.worst_trade.idx}`}
            accent={C_LOSS}
            icon={<AlertTriangle size={12} />}
            valueClass="text-[#E94F37]"
            delay={0.3}
          />
        </div>

        {/* ===== EQUITY CHART ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="bg-[#0D1E35]/80 border border-white/8 rounded-2xl p-5 backdrop-blur-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-[#4A6080] mb-1 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#0077B6]" />
                {chartTab === 'equity' ? 'Equity Curve' : chartTab === 'drawdown' ? 'Drawdown' : 'P/L per Trade'}
              </div>
              <div className="font-mono text-2xl font-semibold text-white">{fmtUSDnoSign(kpis.ending)}</div>
              <div className={`font-mono text-sm mt-1 ${isNeg ? 'text-[#E94F37]' : 'text-[#00897B]'}`}>
                {isNeg ? '▼' : '▲'} {fmtUSD(kpis.net_result)} · {fmtPct(kpis.return_pct)}
              </div>
            </div>
            <div className="flex gap-1">
              {(['equity', 'drawdown', 'pnl'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setChartTab(tab)}
                  className={`px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all ${
                    chartTab === tab
                      ? 'bg-[#0077B6] text-white'
                      : 'bg-[#0A1628] text-[#4A6080] hover:text-white border border-white/8'
                  }`}
                >
                  {tab === 'equity' ? 'EQUITY' : tab === 'drawdown' ? 'DD' : 'P/L'}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {chartTab === 'pnl' ? (
                <BarChart data={pnlBarData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fill: C_MUTED, fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C_MUTED, fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {pnlBarData.map((entry, i) => (
                      <Cell key={i} fill={entry.value >= 0 ? C_PROFIT : C_LOSS} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <AreaChart
                  data={equityData}
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C_OCEAN} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={C_OCEAN} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C_LOSS} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={C_LOSS} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fill: C_MUTED, fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fill: C_MUTED, fontSize: 9, fontFamily: 'JetBrains Mono' }}
                    axisLine={false} tickLine={false}
                    domain={chartTab === 'drawdown' ? ['auto', 0] : ['auto', 'auto']}
                    tickFormatter={v => chartTab === 'drawdown' ? `${v.toFixed(1)}%` : `$${(v/1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  {chartTab === 'drawdown' && <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />}
                  <Area
                    type="monotone"
                    dataKey={chartTab === 'equity' ? 'value' : 'drawdown'}
                    stroke={chartTab === 'drawdown' ? C_LOSS : C_OCEAN}
                    strokeWidth={2}
                    fill={chartTab === 'drawdown' ? 'url(#ddGrad)' : 'url(#equityGrad)'}
                    dot={false}
                    activeDot={{ r: 4, fill: chartTab === 'drawdown' ? C_LOSS : C_OCEAN, stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* ===== CHARTS ROW ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Symbol P/L */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="lg:col-span-2 bg-[#0D1E35]/80 border border-white/8 rounded-2xl p-5 backdrop-blur-sm"
          >
            <div className="text-xs font-mono uppercase tracking-widest text-[#4A6080] mb-4 flex items-center gap-2">
              <BarChart2 size={12} className="text-[#0077B6]" />
              P/L by Symbol
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={symbolData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fill: C_MUTED, fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C_MUTED, fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {symbolData.map((entry, i) => (
                      <Cell key={i} fill={entry.value >= 0 ? C_PROFIT : C_LOSS} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Win/Loss Donut */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.6 }}
            className="bg-[#0D1E35]/80 border border-white/8 rounded-2xl p-5 backdrop-blur-sm flex flex-col"
          >
            <div className="text-xs font-mono uppercase tracking-widest text-[#4A6080] mb-4 flex items-center gap-2">
              <Target size={12} className="text-[#0077B6]" />
              Win / Loss Ratio
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="relative">
                <PieChart width={180} height={180}>
                  <Pie
                    data={donutData}
                    cx={90} cy={90}
                    innerRadius={55} outerRadius={75}
                    startAngle={90} endAngle={-270}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any, n: any) => [`${v} trades`, n]} contentStyle={{ background: '#0D1E35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontFamily: 'JetBrains Mono', fontSize: '11px' }} />
                </PieChart>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="font-mono text-2xl font-bold text-white">{(kpis.win_rate * 100).toFixed(1)}%</div>
                  <div className="font-mono text-[9px] text-[#4A6080] uppercase tracking-wider">Win Rate</div>
                </div>
              </div>
            </div>
            <div className="flex justify-around mt-2">
              <div className="text-center">
                <div className="font-mono text-lg font-bold text-[#00897B]">{kpis.wins}</div>
                <div className="font-mono text-[9px] text-[#4A6080] uppercase">Wins</div>
              </div>
              <div className="w-px bg-white/8" />
              <div className="text-center">
                <div className="font-mono text-lg font-bold text-[#E94F37]">{kpis.losses}</div>
                <div className="font-mono text-[9px] text-[#4A6080] uppercase">Losses</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ===== STATS ROW ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3"
        >
          {[
            { label: 'Profit Factor', value: kpis.profit_factor.toFixed(2), color: kpis.profit_factor >= 1 ? 'text-[#00897B]' : 'text-[#E94F37]' },
            { label: 'Avg Win', value: fmtUSD(kpis.avg_win), color: 'text-[#00897B]' },
            { label: 'Avg Loss', value: fmtUSD(-kpis.avg_loss), color: 'text-[#E94F37]' },
            { label: 'Max DD', value: (kpis.max_drawdown_pct * 100).toFixed(2) + '%', color: 'text-[#E94F37]' },
            { label: 'Win Streak', value: kpis.max_win_streak + 'W', color: 'text-[#00897B]' },
            { label: 'Loss Streak', value: kpis.max_loss_streak + 'L', color: 'text-[#E94F37]' },
          ].map((s, i) => (
            <div key={i} className="bg-[#0D1E35]/80 border border-white/8 rounded-xl p-3 backdrop-blur-sm">
              <div className="font-mono text-[9px] text-[#4A6080] uppercase tracking-wider mb-1.5">{s.label}</div>
              <div className={`font-mono text-base font-semibold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </motion.div>

        {/* ===== TRADES TABLE ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.6 }}
          className="bg-[#0D1E35]/80 border border-white/8 rounded-2xl overflow-hidden backdrop-blur-sm"
        >
          {/* Table header */}
          <div className="p-4 border-b border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="text-xs font-mono uppercase tracking-widest text-[#4A6080] flex items-center gap-2">
                <Zap size={12} className="text-[#0077B6]" />
                Trades
              </div>
              <span className="font-mono text-xs text-[#4A6080]">
                {filteredTrades.length} / {trades.length}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4A6080]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Symbol..."
                  className="bg-[#0A1628] border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-xs font-mono text-white placeholder-[#4A6080] focus:outline-none focus:border-[#0077B6] w-28"
                />
              </div>
              {/* Filters */}
              {(['all', 'wins', 'losses', 'buy', 'sell'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-wider transition-all ${
                    filter === f
                      ? f === 'wins' ? 'bg-[#00897B]/20 text-[#00897B] border border-[#00897B]/30'
                        : f === 'losses' ? 'bg-[#E94F37]/20 text-[#E94F37] border border-[#E94F37]/30'
                        : 'bg-[#0077B6] text-white'
                      : 'bg-[#0A1628] text-[#4A6080] border border-white/8 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/8">
                  {['#', 'Day', 'Open', 'Close', 'Symbol', 'Side', 'Lots', 'Entry', 'Exit', 'SL', 'TP', 'R', 'P/L', 'Net%'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-mono text-[9px] uppercase tracking-widest text-[#4A6080] font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTrades.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="text-center py-12 text-[#4A6080] font-mono text-xs">
                      No trades found
                    </td>
                  </tr>
                ) : filteredTrades.map(t => (
                  <tr
                    key={t.idx}
                    onClick={() => setSelectedTrade(t)}
                    className="border-b border-white/5 hover:bg-white/4 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2.5 font-mono text-[#4A6080]">{String(t.idx).padStart(2, '0')}</td>
                    <td className="px-3 py-2.5 font-mono text-[#4A6080]">{dayShort(t.day)}</td>
                    <td className="px-3 py-2.5 font-mono text-[#4A6080] whitespace-nowrap">{fmtDT(t.open)}</td>
                    <td className="px-3 py-2.5 font-mono text-[#4A6080] whitespace-nowrap">{fmtDT(t.close_time)}</td>
                    <td className="px-3 py-2.5 font-mono font-semibold text-white">{t.symbol}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                        t.direction === 'BUY'
                          ? 'bg-[#00897B]/15 text-[#00897B]'
                          : 'bg-[#E94F37]/15 text-[#E94F37]'
                      }`}>{t.direction}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-white/70">{t.lots}</td>
                    <td className="px-3 py-2.5 font-mono text-white/70">{fmtPrice(t.entry)}</td>
                    <td className="px-3 py-2.5 font-mono text-white/70">{fmtPrice(t.close)}</td>
                    <td className="px-3 py-2.5 font-mono text-[#E94F37]/70">{fmtPrice(t.sl)}</td>
                    <td className="px-3 py-2.5 font-mono text-[#00897B]/70">{fmtPrice(t.tp)}</td>
                    <td className={`px-3 py-2.5 font-mono font-semibold ${t.trade_r !== null && t.trade_r >= 0 ? 'text-[#00897B]' : 'text-[#E94F37]'}`}>
                      {fmtR(t.trade_r)}
                    </td>
                    <td className={`px-3 py-2.5 font-mono font-semibold ${t.pnl >= 0 ? 'text-[#00897B]' : 'text-[#E94F37]'}`}>
                      {fmtUSD(t.pnl)}
                    </td>
                    <td className={`px-3 py-2.5 font-mono ${t.net_pct >= 0 ? 'text-[#00897B]' : 'text-[#E94F37]'}`}>
                      {fmtPct(t.net_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden divide-y divide-white/5">
            {filteredTrades.length === 0 ? (
              <div className="text-center py-12 text-[#4A6080] font-mono text-xs">No trades found</div>
            ) : filteredTrades.map(t => (
              <div
                key={t.idx}
                onClick={() => setSelectedTrade(t)}
                className="p-4 hover:bg-white/4 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[#4A6080]">#{String(t.idx).padStart(2, '0')}</span>
                    <span className="font-mono font-semibold text-white">{t.symbol}</span>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      t.direction === 'BUY' ? 'bg-[#00897B]/15 text-[#00897B]' : 'bg-[#E94F37]/15 text-[#E94F37]'
                    }`}>{t.direction}</span>
                  </div>
                  <span className={`font-mono font-semibold text-sm ${t.pnl >= 0 ? 'text-[#00897B]' : 'text-[#E94F37]'}`}>
                    {fmtUSD(t.pnl)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-mono text-[#4A6080]">
                  <span>{dayShort(t.day)} {fmtDT(t.open)}</span>
                  <span>→</span>
                  <span>{fmtDT(t.close_time)}</span>
                  <span className={t.trade_r !== null && t.trade_r >= 0 ? 'text-[#00897B]' : 'text-[#E94F37]'}>
                    {fmtR(t.trade_r)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ===== SYMBOL STATS TABLE ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="bg-[#0D1E35]/80 border border-white/8 rounded-2xl overflow-hidden backdrop-blur-sm"
        >
          <div className="p-4 border-b border-white/8">
            <div className="text-xs font-mono uppercase tracking-widest text-[#4A6080] flex items-center gap-2">
              <BarChart2 size={12} className="text-[#0077B6]" />
              Symbol Performance
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/8">
                  {['Symbol', 'Trades', 'Wins', 'Losses', 'Win Rate', 'Total P/L'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-mono text-[9px] uppercase tracking-widest text-[#4A6080] font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {symbols.map((s, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/4 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-semibold text-white">{s.symbol}</td>
                    <td className="px-4 py-2.5 font-mono text-white/70">{s.trades}</td>
                    <td className="px-4 py-2.5 font-mono text-[#00897B]">{s.wins}</td>
                    <td className="px-4 py-2.5 font-mono text-[#E94F37]">{s.losses}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden max-w-16">
                          <div
                            className="h-full rounded-full bg-[#00897B]"
                            style={{ width: `${s.win_rate * 100}%` }}
                          />
                        </div>
                        <span className="font-mono text-white/70">{(s.win_rate * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className={`px-4 py-2.5 font-mono font-semibold ${s.pnl >= 0 ? 'text-[#00897B]' : 'text-[#E94F37]'}`}>
                      {fmtUSD(s.pnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

      </div>

      {/* ===== FOOTER ===== */}
      <div className="border-t border-white/8 bg-[#070F1C] py-6">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-[#0077B6] to-[#023E8A] flex items-center justify-center">
              <TrendingUp size={12} className="text-white" />
            </div>
            <span className="font-mono text-[10px] text-[#4A6080] uppercase tracking-widest">APEXHUB · Trading Journal · {meta.year_full}</span>
          </div>
          <div className="font-mono text-[10px] text-[#4A6080]">
            Drop .xlsx file anywhere to sync · Click SYNC button to upload
          </div>
        </div>
      </div>

      {/* ===== TRADE DRAWER ===== */}
      <TradeDrawer trade={selectedTrade} onClose={() => setSelectedTrade(null)} />
    </div>
  );
}
