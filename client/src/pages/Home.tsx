// Ultimate Trading Journal — Main Dashboard
// Design: Ocean Depth Premium — deep navy, ocean blue accents, teal/coral for P/L
// Layout: Full-width dashboard, sticky topbar, active trade banner, hero section,
//         monthly sidebar, KPI grid, charts, trades table, overall growth section

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Upload, RefreshCw, Download,
  Activity, Target, BarChart2, Award, AlertTriangle, X,
  ChevronDown, Search, Zap, Shield, Calendar, ChevronLeft,
  ChevronRight, Plus, Trash2, FileInput, BarChart3, Clock,
  Wifi, WifiOff, Edit3, ArrowRight, CalendarPlus, FileSpreadsheet,
  Share2, Brain, Notebook, Lock, Calculator, Wallet, ArrowUpToLine, ArrowDownToLine
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, Cell, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  LineChart, Line
} from 'recharts';
import { DEFAULT_DATA } from '@/lib/defaultData';
import type { TradingData, Trade } from '@/lib/trading';
import { fmtUSD, fmtUSDnoSign, fmtPct, fmtR, fmtPrice, fmtDT, dayShort, durationStr, parseExcelToTradingData, computeKPIs, computeRunningBalances, createEmptyMonth, sumAdjustments } from '@/lib/trading';
import type { Adjustment } from '@/lib/trading';
import { exportToExcel } from '@/lib/exportExcel';
import AddTradeModal from '@/components/AddTradeModal';
import NewMonthModal from '@/components/NewMonthModal';
import ImportExcelModal from '@/components/ImportExcelModal';
import ThemeToggle from '@/components/ThemeToggle';
import TradeDetailDialog from '@/components/TradeDetailDialog';
import ShareCardDialog from '@/components/ShareCardDialog';
import WhatIfCalculatorDialog from '@/components/WhatIfCalculatorDialog';
import AdjustmentModal from '@/components/AdjustmentModal';
import { getOverallGrowthData, monthSortValue } from '@/lib/monthlyHistory';
import { useJournal, useAccounts, type MonthSnapshot } from '@/hooks/useJournal';
import { resolveRange, PERIOD_LABELS, computePeriodView, type PeriodPreset, type PeriodKpis, type StampedTrade } from '@/lib/periodFilter';
import { useAuth } from '@/_core/hooks/useAuth';
import { CLERK_ENABLED, getLoginUrl } from '@/const';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import { toast } from 'sonner';
import { useRoute, useLocation } from 'wouter';

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
            : typeof p.value === 'number'
            ? p.value.toFixed(2)
            : p.value}
        </div>
      ))}
    </div>
  );
};

// ===== CHART THUMBNAIL HELPER =====
function getTvThumbnail(url: string): string | null {
  if (!url) return null;
  const m = url.match(/tradingview\.com\/x\/([A-Za-z0-9]+)/);
  if (!m) return null;
  const id = m[1];
  const firstLetter = id[0].toLowerCase();
  return `https://s3.tradingview.com/snapshots/${firstLetter}/${id}.png`;
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
      <div className="flex items-center justify-between px-3 py-2" style={{ background: `${accentColor}15` }}>
        <span className="font-mono text-[9px] uppercase tracking-widest font-semibold" style={{ color: accentColor }}>{label}</span>
        <span className="font-mono text-[9px] text-[#4A6080]">↗ Open</span>
      </div>
      {thumbUrl && !imgError ? (
        <div className="relative bg-[#0A1628] aspect-video">
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-[#0077B6] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <img
            src={thumbUrl}
            alt={label}
            className={`w-full h-full object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity font-mono text-xs text-white bg-black/60 px-3 py-1.5 rounded-lg">
              Open Full Chart
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-[#0A1628] aspect-video flex items-center justify-center">
          <span className="font-mono text-[10px] text-[#4A6080]">{imgError ? 'Preview unavailable' : 'No chart URL'}</span>
        </div>
      )}
    </a>
  );
}

function ChartThumbnails({ before, after }: { before: string; after: string }) {
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

// ===== STARTING BALANCE (editable KPI) =====
function StartingBalanceCard({
  starting,
  disabled,
  onChange,
}: {
  starting: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(starting));

  useEffect(() => {
    if (!editing) setDraft(String(starting));
  }, [starting, editing]);

  const commit = () => {
    const num = parseFloat(draft.replace(/,/g, ''));
    if (!isFinite(num) || num < 0) {
      toast.error('Invalid starting balance');
      setDraft(String(starting));
      setEditing(false);
      return;
    }
    if (num !== starting) onChange(num);
    setEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative bg-[#0D1E35]/80 border border-white/8 rounded-xl p-4 backdrop-blur-sm overflow-hidden group"
    >
      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl" style={{ background: '#0077B6' }} />
      <div className="flex items-start justify-between mb-2">
        <div className="text-[#4A6080] font-mono text-[9px] uppercase tracking-[0.15em]">◉ Starting</div>
        {!disabled && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[#4A6080] hover:text-[#0094C6]"
            title="Edit starting balance"
          >
            <Edit3 size={11} />
          </button>
        )}
      </div>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setDraft(String(starting)); setEditing(false); }
          }}
          className="font-mono text-xl font-semibold leading-tight text-white bg-[#0A1628] border border-[#0077B6]/40 rounded px-2 py-1 w-full focus:outline-none focus:border-[#0077B6]"
        />
      ) : (
        <div className="font-mono text-xl font-semibold leading-tight text-white">
          {fmtUSDnoSign(starting)}
        </div>
      )}
      <div className="font-mono text-[10px] text-[#4A6080] mt-1.5">
        {disabled ? 'Disabled while period filter active' : 'Base · USD · click to edit'}
      </div>
    </motion.div>
  );
}

// ===== KPI CARD =====
function KpiCard({ label, value, sub, accent, icon, valueClass = 'text-white', delay = 0 }: {
  label: string; value: string; sub?: string; accent: string; icon?: React.ReactNode;
  valueClass?: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative bg-[#0D1E35]/80 border border-white/8 rounded-xl p-4 backdrop-blur-sm overflow-hidden"
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

// ===== ACTIVE TRADE BANNER =====
interface ActiveTrade {
  symbol: string;
  direction: 'BUY' | 'SELL';
  lots: number;
  entry: number;
  currentPrice: number;
  openTime: string;
  floatingPnl: number;
  balance: number;
}

function ActiveTradeBanner({ activeTrade, onEdit, onClose }: {
  activeTrade: ActiveTrade;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [displayPnl, setDisplayPnl] = useState(activeTrade.floatingPnl);
  const [displayBalance, setDisplayBalance] = useState(activeTrade.balance);
  const [tick, setTick] = useState(0);
  const isPos = displayPnl >= 0;

  // Simulate live fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      const fluctuation = (Math.random() - 0.5) * Math.abs(activeTrade.floatingPnl) * 0.04;
      const newPnl = activeTrade.floatingPnl + fluctuation;
      setDisplayPnl(newPnl);
      setDisplayBalance(activeTrade.balance + newPnl - activeTrade.floatingPnl);
      setTick(t => t + 1);
    }, 1200);
    return () => clearInterval(interval);
  }, [activeTrade]);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`border-b overflow-hidden ${isPos ? 'bg-[#00897B]/8 border-[#00897B]/20' : 'bg-[#E94F37]/8 border-[#E94F37]/20'}`}
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Pulse indicator */}
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full animate-pulse ${isPos ? 'bg-[#00897B]' : 'bg-[#E94F37]'}`} />
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#4A6080]">ACTIVE TRADE</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          {/* Symbol + direction */}
          <div className="flex items-center gap-2">
            <span className="font-['Space_Grotesk'] font-semibold text-sm text-white">{activeTrade.symbol}</span>
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
              activeTrade.direction === 'BUY'
                ? 'bg-[#00897B]/20 text-[#00897B]'
                : 'bg-[#E94F37]/20 text-[#E94F37]'
            }`}>{activeTrade.direction}</span>
            <span className="font-mono text-[10px] text-[#4A6080]">{activeTrade.lots} lots</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          {/* Entry */}
          <div className="font-mono text-[10px] text-[#4A6080]">
            Entry: <span className="text-white">{activeTrade.entry}</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          {/* Floating P/L — animates */}
          <motion.div
            key={tick}
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
            className={`font-mono font-bold text-sm ${isPos ? 'text-[#00897B]' : 'text-[#E94F37]'}`}
          >
            {isPos ? '▲' : '▼'} {fmtUSD(displayPnl)}
          </motion.div>
          <div className="w-px h-3 bg-white/10" />
          {/* Live balance */}
          <div className="font-mono text-[10px] text-[#4A6080]">
            Balance: <motion.span
              key={`bal-${tick}`}
              initial={{ opacity: 0.7 }}
              animate={{ opacity: 1 }}
              className="text-white font-semibold"
            >{fmtUSDnoSign(displayBalance)}</motion.span>
          </div>
          {/* Open time */}
          {activeTrade.openTime && (
            <>
              <div className="w-px h-3 bg-white/10" />
              <div className="font-mono text-[10px] text-[#4A6080] flex items-center gap-1">
                <Clock size={9} />
                {activeTrade.openTime}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onEdit}
            className="font-mono text-[9px] uppercase tracking-wider text-[#4A6080] hover:text-white transition-colors px-2 py-1 rounded border border-white/8 hover:border-white/20"
          >
            Edit
          </button>
          <button onClick={onClose} className="text-[#4A6080] hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ===== ACTIVE TRADE INPUT MODAL =====
function ActiveTradeModal({ initial, onSave, onClose }: {
  initial: Partial<ActiveTrade> | null;
  onSave: (t: ActiveTrade) => void;
  onClose: () => void;
}) {
  const [symbol, setSymbol] = useState(initial?.symbol || '');
  const [direction, setDirection] = useState<'BUY' | 'SELL'>(initial?.direction || 'BUY');
  const [lots, setLots] = useState(String(initial?.lots || ''));
  const [entry, setEntry] = useState(String(initial?.entry || ''));
  const [currentPrice, setCurrentPrice] = useState(String(initial?.currentPrice || ''));
  const [floatingPnl, setFloatingPnl] = useState(String(initial?.floatingPnl || ''));
  const [balance, setBalance] = useState(String(initial?.balance || ''));
  const [openTime, setOpenTime] = useState(initial?.openTime || '');

  const handleSave = () => {
    if (!symbol || !entry || !floatingPnl || !balance) {
      toast.error('Συμπλήρωσε Symbol, Entry, Floating P/L και Balance');
      return;
    }
    onSave({
      symbol: symbol.toUpperCase(),
      direction,
      lots: parseFloat(lots) || 0,
      entry: parseFloat(entry) || 0,
      currentPrice: parseFloat(currentPrice) || 0,
      floatingPnl: parseFloat(floatingPnl) || 0,
      balance: parseFloat(balance) || 0,
      openTime,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-[#0D1E35] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="font-['Space_Grotesk'] font-semibold text-white">Active Trade</div>
            <div className="font-mono text-[9px] text-[#4A6080] uppercase tracking-wider mt-0.5">Εισαγωγή στοιχείων από MT5</div>
          </div>
          <button onClick={onClose} className="text-[#4A6080] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[9px] text-[#4A6080] uppercase tracking-wider block mb-1.5">Symbol *</label>
              <input
                value={symbol}
                onChange={e => setSymbol(e.target.value)}
                placeholder="EURUSD"
                className="w-full bg-[#0A1628] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-[#4A6080] focus:outline-none focus:border-[#0077B6]"
              />
            </div>
            <div>
              <label className="font-mono text-[9px] text-[#4A6080] uppercase tracking-wider block mb-1.5">Direction</label>
              <div className="flex gap-2">
                {(['BUY', 'SELL'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setDirection(d)}
                    className={`flex-1 py-2 rounded-lg font-mono text-[10px] font-bold transition-all ${
                      direction === d
                        ? d === 'BUY' ? 'bg-[#00897B]/20 text-[#00897B] border border-[#00897B]/40' : 'bg-[#E94F37]/20 text-[#E94F37] border border-[#E94F37]/40'
                        : 'bg-[#0A1628] text-[#4A6080] border border-white/8'
                    }`}
                  >{d}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[9px] text-[#4A6080] uppercase tracking-wider block mb-1.5">Lots</label>
              <input value={lots} onChange={e => setLots(e.target.value)} placeholder="0.10" className="w-full bg-[#0A1628] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-[#4A6080] focus:outline-none focus:border-[#0077B6]" />
            </div>
            <div>
              <label className="font-mono text-[9px] text-[#4A6080] uppercase tracking-wider block mb-1.5">Entry Price *</label>
              <input value={entry} onChange={e => setEntry(e.target.value)} placeholder="1.08500" className="w-full bg-[#0A1628] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-[#4A6080] focus:outline-none focus:border-[#0077B6]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[9px] text-[#4A6080] uppercase tracking-wider block mb-1.5">Floating P/L ($) *</label>
              <input value={floatingPnl} onChange={e => setFloatingPnl(e.target.value)} placeholder="+250.00" className="w-full bg-[#0A1628] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-[#4A6080] focus:outline-none focus:border-[#0077B6]" />
            </div>
            <div>
              <label className="font-mono text-[9px] text-[#4A6080] uppercase tracking-wider block mb-1.5">Balance ($) *</label>
              <input value={balance} onChange={e => setBalance(e.target.value)} placeholder="512000" className="w-full bg-[#0A1628] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-[#4A6080] focus:outline-none focus:border-[#0077B6]" />
            </div>
          </div>

          <div>
            <label className="font-mono text-[9px] text-[#4A6080] uppercase tracking-wider block mb-1.5">Open Time</label>
            <input value={openTime} onChange={e => setOpenTime(e.target.value)} placeholder="17.04 14:30" className="w-full bg-[#0A1628] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-[#4A6080] focus:outline-none focus:border-[#0077B6]" />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 font-mono text-xs text-[#4A6080] hover:text-white transition-colors">
            Άκυρο
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-[#0077B6] font-mono text-xs font-semibold text-white hover:bg-[#0096D6] transition-colors"
          >
            Αποθήκευση
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ===== IMPORT LINKS MODAL =====
function ImportLinksModal({ trades, onImport, onClose }: {
  trades: Trade[];
  onImport: (updated: Trade[]) => void;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>('');

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Παρακαλώ ανέβασε αρχείο Excel (.xlsx ή .xls)');
      return;
    }
    try {
      const { parseExcelToTradingData } = await import('@/lib/trading');
      const parsed = await parseExcelToTradingData(file);
      // Merge links by trade index
      let updated = 0;
      const newTrades = trades.map(t => {
        const match = parsed.trades.find(p => p.idx === t.idx);
        if (match) {
          const hasNewBefore = match.chart_before && match.chart_before !== t.chart_before;
          const hasNewAfter = match.chart_after && match.chart_after !== t.chart_after;
          if (hasNewBefore || hasNewAfter) {
            updated++;
            return {
              ...t,
              chart_before: match.chart_before || t.chart_before,
              chart_after: match.chart_after || t.chart_after,
            };
          }
        }
        return t;
      });
      onImport(newTrades);
      setStatus(`✓ Ενημερώθηκαν ${updated} trades με νέα chart links`);
      toast.success(`✓ Ενημερώθηκαν ${updated} trades με νέα chart links`);
      setTimeout(onClose, 1500);
    } catch (err: any) {
      toast.error(err?.message || 'Σφάλμα κατά την ανάγνωση');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-[#0D1E35] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="font-['Space_Grotesk'] font-semibold text-white">Import Chart Links</div>
            <div className="font-mono text-[9px] text-[#4A6080] uppercase tracking-wider mt-0.5">Ανέβασε Excel με CHART BEFORE/AFTER links</div>
          </div>
          <button onClick={onClose} className="text-[#4A6080] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-white/10 hover:border-[#0077B6]/50 rounded-xl p-8 text-center cursor-pointer transition-all group"
        >
          <FileInput size={32} className="text-[#4A6080] group-hover:text-[#0077B6] mx-auto mb-3 transition-colors" />
          <div className="font-mono text-xs text-[#4A6080] group-hover:text-white transition-colors">
            Κάνε click ή drag & drop
          </div>
          <div className="font-mono text-[9px] text-[#4A6080] mt-1">.xlsx · .xls</div>
        </div>

        {status && (
          <div className="mt-3 font-mono text-xs text-[#00897B] text-center">{status}</div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        />

        <div className="mt-4 p-3 bg-[#0A1628] rounded-xl">
          <div className="font-mono text-[9px] text-[#4A6080] uppercase tracking-wider mb-2">Πώς λειτουργεί:</div>
          <div className="font-mono text-[9px] text-[#4A6080] space-y-1">
            <div>1. Άνοιξε το MT5 / Ultimate Trading Journal Excel σου</div>
            <div>2. Πρόσθεσε τα TradingView links στις στήλες CHART BEFORE / CHART AFTER</div>
            <div>3. Ανέβασε το Excel εδώ — θα ενημερωθούν μόνο τα links</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ===== TRADE DRAWER =====
function TradeDrawer({ trade, onClose, onEdit, onDelete }: { trade: Trade | null; onClose: () => void; onEdit?: (t: Trade) => void; onDelete?: (idx: number) => void }) {
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
                <div className="flex items-center gap-1">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(trade)}
                      className="p-1.5 rounded text-[#4A6080] hover:text-[#0094C6] hover:bg-[#0094C6]/10 transition-all"
                      title="Edit trade"
                    >
                      <Edit3 size={16} />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(trade.idx)}
                      className="p-1.5 rounded text-[#4A6080] hover:text-[#E94F37] hover:bg-[#E94F37]/10 transition-all"
                      title="Delete trade"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  <button onClick={onClose} className="text-[#4A6080] hover:text-white transition-colors p-1.5">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* P/L Banner */}
              <div className={`rounded-xl p-4 mb-6 border ${
                isPnlPos ? 'bg-[#00897B]/10 border-[#00897B]/20' : 'bg-[#E94F37]/10 border-[#E94F37]/20'
              }`}>
                <div className="text-[#4A6080] font-mono text-xs uppercase tracking-wider mb-1">Net P/L</div>
                <div className={`font-mono text-3xl font-bold ${isPnlPos ? 'text-[#00897B]' : 'text-[#E94F37]'}`}>
                  {fmtUSD(trade.pnl)}
                  {trade.net_pct !== 0 && (
                    <span className="text-sm text-[#4A6080] font-mono ml-2">
                      ({fmtPct(trade.net_pct)})
                    </span>
                  )}
                </div>
                <div className="flex gap-4 mt-2 text-xs font-mono text-[#4A6080]">
                  <span>Swap: {fmtUSD(trade.swap)}</span>
                  <span>Comm: {fmtUSD(trade.commission)}</span>
                  {trade.trade_r !== null && <span className={trade.trade_r >= 0 ? 'text-[#00897B]' : 'text-[#E94F37]'}>{fmtR(trade.trade_r)}</span>}
                </div>
              </div>

              {/* Execution Details */}
              <div className="space-y-3 mb-6">
                <div className="text-xs font-mono uppercase tracking-widest text-[#4A6080] mb-3">Execution</div>
                {[
                  ['Open', fmtDT(trade.open)],
                  ['Close', fmtDT(trade.close_time)],
                  ['Duration', durationStr(trade.open, trade.close_time)],
                  ['Lots', String(trade.lots)],
                  ['Entry', fmtPrice(trade.entry)],
                  ['Exit', fmtPrice(trade.close)],
                  ['SL', fmtPrice(trade.sl)],
                  ['TP', fmtPrice(trade.tp)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="font-mono text-[10px] text-[#4A6080] uppercase tracking-wider">{label}</span>
                    <span className="font-mono text-xs text-white">{value}</span>
                  </div>
                ))}
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

// ===== MONTHLY SIDEBAR =====
function MonthlySidebar({ history, currentKey, onSelect, onDelete, onClose, isOpen }: {
  history: MonthSnapshot[];
  currentKey: string;
  onSelect: (snap: MonthSnapshot) => void;
  onDelete: (key: string) => void;
  onClose: () => void;
  isOpen: boolean;
}) {
  // Close on Escape key for keyboard users.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop closes the panel on ANY outside click (all breakpoints). */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 top-0 h-full w-72 bg-[#070F1C] border-r border-white/8 z-40 overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="font-['Space_Grotesk'] font-semibold text-white text-sm">Monthly History</div>
                  <div className="font-mono text-[9px] text-[#4A6080] uppercase tracking-wider mt-0.5">{history.length} μήνες</div>
                </div>
                <button onClick={onClose} className="text-[#4A6080] hover:text-white transition-colors" title="Close">
                  <X size={16} />
                </button>
              </div>

              {history.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar size={24} className="text-[#4A6080] mx-auto mb-2" />
                  <div className="font-mono text-[10px] text-[#4A6080] uppercase tracking-wider">
                    Δεν υπάρχουν αποθηκευμένοι μήνες
                  </div>
                  <div className="font-mono text-[9px] text-[#4A6080] mt-1">
                    Ανέβασε Excel για να αποθηκευτεί αυτόματα
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {[...history].sort((a, b) => monthSortValue(b) - monthSortValue(a)).map(snap => {
                    const isActive = snap.key === currentKey;
                    const isPos = snap.net_result >= 0;
                    return (
                      <div
                        key={snap.key}
                        className={`group relative rounded-xl p-3 cursor-pointer transition-all border ${
                          isActive
                            ? 'bg-[#0077B6]/15 border-[#0077B6]/30'
                            : 'bg-[#0D1E35]/60 border-white/5 hover:border-white/15'
                        }`}
                        onClick={() => onSelect(snap)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-['Space_Grotesk'] font-semibold text-xs text-white">
                              {snap.month_name.slice(0, 3)} '{snap.year_short}
                            </div>
                            <div className={`font-mono text-xs font-bold mt-0.5 ${isPos ? 'text-[#00897B]' : 'text-[#E94F37]'}`}>
                              {fmtUSD(snap.net_result)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-[9px] text-[#4A6080]">{snap.total_trades} trades</div>
                            <div className="font-mono text-[9px] text-[#4A6080]">{(snap.win_rate * 100).toFixed(0)}% WR</div>
                          </div>
                        </div>
                        {/* Mini return bar */}
                        <div className="mt-2 h-0.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isPos ? 'bg-[#00897B]' : 'bg-[#E94F37]'}`}
                            style={{ width: `${Math.min(Math.abs(snap.return_pct) * 100 * 20, 100)}%` }}
                          />
                        </div>
                        <div className={`font-mono text-[9px] mt-1 ${isPos ? 'text-[#00897B]' : 'text-[#E94F37]'}`}>
                          {(snap.return_pct * 100).toFixed(2)}%
                        </div>
                        {/* Delete button */}
                        <button
                          onClick={e => { e.stopPropagation(); onDelete(snap.key); }}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-[#4A6080] hover:text-[#E94F37]"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ===== CURRENT BALANCE (HERO) =====
// Read-only, always derived from starting balance + Σ(pnl + swap + commission)
// across every saved month plus the current month's open trades. The number is
// intentionally not user-editable so it always agrees with the trade log.
function CurrentBalanceHero({
  value,
  periodActive,
  periodLabel,
  netResult,
  returnPct,
}: {
  value: number;
  periodActive: boolean;
  periodLabel: string;
  netResult: number;
  returnPct: number;
}) {
  const isNeg = netResult < 0;
  return (
    <div>
      <div
        className="font-mono text-[10px] text-[#4A6080] uppercase tracking-[0.15em] mb-1 flex items-center justify-end gap-2"
        title="Computed from starting balance + sum of trade P/L. Not editable."
      >
        Current Balance
        <Lock size={9} className="opacity-60" aria-hidden />
      </div>
      <div
        className="font-mono text-[clamp(28px,5vw,48px)] font-semibold text-white leading-none select-text"
        title="Auto-computed from your trade log"
      >
        {fmtUSDnoSign(value)}
      </div>
      <div className={`font-mono text-sm mt-2 ${isNeg ? 'text-[#E94F37]' : 'text-[#00897B]'}`}>
        {isNeg ? '▼' : '▲'} {fmtUSD(netResult)} ({fmtPct(returnPct)})
      </div>
      {periodActive && periodLabel && (
        <div className="font-mono text-[10px] text-[#F4A261] uppercase tracking-wider mt-1">
          Period: {periodLabel}
        </div>
      )}
    </div>
  );
}

// Human-readable label for a resolved period range (used in the hero subtitle).
function formatPeriodRange(range: { preset: string; from: Date | null; to: Date | null }): string {
  const fmt = (d: Date | null) =>
    d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}` : '…';
  if (range.preset === 'all') return 'All time';
  if (range.preset === '30d' || range.preset === '60d' || range.preset === '90d') {
    return `Last ${range.preset.replace('d', ' days')} (${fmt(range.from)} → ${fmt(range.to)})`;
  }
  if (range.preset === 'this-month') return `This month (${fmt(range.from)} → ${fmt(range.to)})`;
  return `${fmt(range.from)} → ${fmt(range.to)}`;
}

// ===== OVERALL GROWTH SECTION =====
function OverallGrowthSection({ history }: { history: MonthSnapshot[] }) {
  // Sort ascending by key
  const sortedAll = [...history].sort((a, b) => monthSortValue(a) - monthSortValue(b));
  const allKeys = sortedAll.map(h => h.key);

  const [fromKey, setFromKey] = useState<string>(allKeys[0] || '');
  const [toKey, setToKey] = useState<string>(allKeys[allKeys.length - 1] || '');
  const [mode, setMode] = useState<'usd' | 'pct'>('usd');

  // Re-sync if history length changes
  useEffect(() => {
    if (allKeys.length > 0) {
      if (!allKeys.includes(fromKey)) setFromKey(allKeys[0]);
      if (!allKeys.includes(toKey)) setToKey(allKeys[allKeys.length - 1]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length]);

  if (history.length < 2) return null;

  // Filter range
  const filtered = sortedAll.filter(h =>
    (!fromKey || h.key >= fromKey) && (!toKey || h.key <= toKey)
  );
  const filteredForData = filtered.length > 0 ? filtered : sortedAll;

  const growthData = getOverallGrowthData(filteredForData);
  const totalPnl = filteredForData.reduce((s, h) => s + h.net_result, 0);
  const firstBalance = filteredForData[0]?.starting || 0;
  const lastBalance = filteredForData[filteredForData.length - 1]?.ending || 0;
  const overallReturn = firstBalance > 0 ? ((lastBalance - firstBalance) / firstBalance) * 100 : 0;

  const isPct = mode === 'pct';
  const headerValueText = isPct
    ? `${overallReturn >= 0 ? '+' : ''}${overallReturn.toFixed(2)}%`
    : fmtUSD(totalPnl);
  const headerValueColor = isPct
    ? (overallReturn >= 0 ? 'text-[#00897B]' : 'text-[#E94F37]')
    : (totalPnl >= 0 ? 'text-[#00897B]' : 'text-[#E94F37]');

  const areaKey = isPct ? 'growth_pct' : 'balance';
  const barKey = isPct ? 'return_pct' : 'pnl';
  const yFormatter = isPct
    ? (v: number) => `${v.toFixed(0)}%`
    : (v: number) => '$' + (v / 1000).toFixed(0) + 'k';

  const monthLabel = (h: MonthSnapshot) => `${h.month_name.slice(0, 3)} '${h.year_short}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.6 }}
      className="bg-[#0D1E35]/80 border border-white/8 rounded-2xl p-5 backdrop-blur-sm"
    >
      {/* Date Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Calendar size={12} className="text-[#0094C6]" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#6E8AA8]">Period:</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={fromKey}
            onChange={(e) => setFromKey(e.target.value)}
            className="bg-[#050B16] border border-white/10 rounded px-2.5 py-1.5 font-mono text-[11px] text-white focus:border-[#0094C6] focus:outline-none"
          >
            {sortedAll.map(h => (
              <option key={h.key} value={h.key}>{monthLabel(h)}</option>
            ))}
          </select>
          <ArrowRight size={12} className="text-[#4A6080]" />
          <select
            value={toKey}
            onChange={(e) => setToKey(e.target.value)}
            className="bg-[#050B16] border border-white/10 rounded px-2.5 py-1.5 font-mono text-[11px] text-white focus:border-[#0094C6] focus:outline-none"
          >
            {sortedAll.map(h => (
              <option key={h.key} value={h.key}>{monthLabel(h)}</option>
            ))}
          </select>
          <button
            onClick={() => { setFromKey(allKeys[0]); setToKey(allKeys[allKeys.length - 1]); }}
            className="px-2.5 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 font-mono text-[10px] uppercase tracking-wider text-white/70 transition-all"
            title="Reset to all months"
          >
            ALL
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-[#4A6080] mb-1 flex items-center gap-2">
            <BarChart3 size={12} className="text-[#0077B6]" />
            Overall Growth — {filteredForData.length} of {history.length} Months
          </div>
          <div className={`font-mono text-2xl font-semibold ${headerValueColor}`}>
            {headerValueText}
          </div>
        </div>
        {/* USD / PCT mode toggle */}
        <div className="inline-flex items-center bg-[#050B16] border border-white/8 rounded-lg p-0.5 self-start">
          {(['usd', 'pct'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded font-mono text-[10px] uppercase tracking-widest transition-all ${mode === m ? 'bg-[#0077B6] text-white' : 'text-[#4A6080] hover:text-white'}`}
            >
              {m === 'usd' ? '$' : '%'}
            </button>
          ))}
        </div>
      </div>

      {/* Balance growth chart */}
      <div className="h-48 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={growthData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C_OCEAN} stopOpacity={0.3} />
                <stop offset="95%" stopColor={C_OCEAN} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fill: '#4A6080', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#4A6080', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} tickFormatter={yFormatter} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey={areaKey} stroke={C_OCEAN} strokeWidth={2} fill="url(#growthGrad)" dot={{ fill: C_OCEAN, r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly P/L bars */}
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={growthData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fill: '#4A6080', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#4A6080', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} tickFormatter={yFormatter} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
            <Bar dataKey={barKey} radius={[3, 3, 0, 0]}>
              {growthData.map((entry, i) => (
                <Cell key={i} fill={(isPct ? entry.return_pct : entry.pnl) >= 0 ? C_PROFIT : C_LOSS} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

// ===== MAIN DASHBOARD =====
// Clerk users land on a fully blank state — no preset month name, no year, no
// starting balance. The UI renders placeholder text ("No month yet") until the
// user presses NEW MONTH or IMPORT. Legacy / demo users keep the sample data.
function buildEmptyMonth(): TradingData {
  return createEmptyMonth('', '', 0);
}

export default function Home() {
  // URL shape: /account/:id — when not authenticated (demo) we fall back to 0
  const [, params] = useRoute('/account/:id');
  const [, setLocation] = useLocation();
  const parsedId = params?.id ? Number(params.id) : NaN;
  const accountId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;

  // Resolve the account being viewed so we can show its name + color in the
  // topbar and thread the account name into the Excel export filename.
  const { accounts: allAccounts } = useAccounts();
  const currentAccount = useMemo(
    () => allAccounts.find((a) => a.id === accountId) ?? null,
    [allAccounts, accountId],
  );

  // If the URL points to an account that no longer exists (e.g. after a
  // delete), bounce the user back to the picker.
  useEffect(() => {
    if (!CLERK_ENABLED) return;
    if (!accountId) return;
    if (allAccounts.length === 0) return; // still loading / empty
    const exists = allAccounts.some((a) => a.id === accountId);
    if (!exists) setLocation('/');
  }, [accountId, allAccounts, setLocation]);

  // Clerk tenants start empty; legacy / demo users keep the sample dataset.
  const INITIAL_DATA: TradingData = CLERK_ENABLED ? buildEmptyMonth() : DEFAULT_DATA;
  const [data, setData] = useState<TradingData>(INITIAL_DATA);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [showShareCard, setShowShareCard] = useState(false);
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState<Adjustment | null>(null);
  const [filter, setFilter] = useState<'all' | 'wins' | 'losses' | 'buy' | 'sell'>('all');
  const [search, setSearch] = useState('');
  const [chartTab, setChartTab] = useState<'equity' | 'drawdown' | 'pnl'>('equity');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importLinksInputRef = useRef<HTMLInputElement>(null);

  // Active trade + monthly history — server-backed via useJournal.
  const [showActiveTradeModal, setShowActiveTradeModal] = useState(false);
  const {
    isAuthenticated,
    authLoading,
    user,
    monthlyHistory,
    activeTrade,
    saveMonth,
    deleteMonth,
    saveActiveTrade,
    clearActiveTrade,
    isLoading: journalLoading,
  } = useJournal(accountId);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showImportLinks, setShowImportLinks] = useState(false);
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [showNewMonth, setShowNewMonth] = useState(false);
  const [showImportExcel, setShowImportExcel] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);

  // Current month key
  const currentKey = (() => {
    const monthOrder = [
      'ΙΑΝΟΥΑΡΙΟΣ', 'ΦΕΒΡΟΥΑΡΙΟΣ', 'ΜΑΡΤΙΟΣ', 'ΑΠΡΙΛΙΟΣ', 'ΜΑΙΟΣ', 'ΙΟΥΝΙΟΣ',
      'ΙΟΥΛΙΟΣ', 'ΑΥΓΟΥΣΤΟΣ', 'ΣΕΠΤΕΜΒΡΙΟΣ', 'ΟΚΤΩΒΡΙΟΣ', 'ΝΟΕΜΒΡΙΟΣ', 'ΔΕΚΕΜΒΡΙΟΣ',
    ];
    const idx = monthOrder.indexOf(data.meta.month_name);
    return `${data.meta.year_full}-${(idx + 1).toString().padStart(2, '0')}`;
  })();

  // On initial load / after login, replace the in-memory DEFAULT_DATA with the
  // snapshot that matches the currently displayed month so any changes made
  // previously are reflected immediately.
  const hydratedFromServerRef = useRef(false);
  useEffect(() => {
    if (hydratedFromServerRef.current) return;
    if (authLoading || journalLoading) return;
    if (!monthlyHistory || monthlyHistory.length === 0) return;
    // Prefer the exact current key; otherwise fall back to the most recent snapshot.
    const match = monthlyHistory.find(h => h.key === currentKey) ?? monthlyHistory[0];
    if (!match) return;
    try {
      const parsedTrades = JSON.parse(match.trades_json);
      const full = computeKPIs(parsedTrades, match.starting);
      // Preserve the snapshot's month metadata over whatever computeKPIs inferred.
      full.meta = {
        ...full.meta,
        month_name: match.month_name,
        year_full: match.year_full,
        year_short: match.year_short,
      };
      setData(full);
      hydratedFromServerRef.current = true;
    } catch {
      // Leave DEFAULT_DATA in place on parse errors.
    }
  }, [authLoading, journalLoading, monthlyHistory, currentKey]);

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
      // Persist to server-backed journal.
      await saveMonth(parsed);
      toast.success(`✓ Συγχρονίστηκαν ${parsed.trades.length} trades · Αποθηκεύτηκε`);
    } catch (err: any) {
      toast.error(err?.message || 'Σφάλμα κατά την ανάγνωση του Excel');
    }
  }, [saveMonth]);

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

  const handleSelectMonth = (snap: MonthSnapshot) => {
    try {
      const parsedTrades = JSON.parse(snap.trades_json);
      const full = computeKPIs(parsedTrades, snap.starting);
      // Preserve the snapshot's own month labels so the hero header/KPIs
      // match what the user clicked instead of whatever computeKPIs inferred
      // from trade dates.
      full.meta = {
        ...full.meta,
        month_name: snap.month_name,
        year_full: snap.year_full,
        year_short: snap.year_short,
      };
      setData(full);
      setFilter('all');
      setSearch('');
      setChartTab('equity');
      setShowSidebar(false);
      // Mark as hydrated so the one-shot useEffect does not overwrite this
      // explicit user selection if the snapshots query re-fires later.
      hydratedFromServerRef.current = true;
      toast.success(`✓ ${snap.month_name} '${snap.year_short} φορτώθηκε`);
    } catch {
      toast.error('Σφάλμα κατά τη φόρτωση μήνα');
    }
  };

  const handleDeleteMonth = async (key: string) => {
    try {
      await deleteMonth(key);
      toast.success('Ο μήνας διαγράφηκε από το ιστορικό');
    } catch (err: any) {
      toast.error(err?.message || 'Αποτυχία διαγραφής');
    }
  };

  const handleImportLinks = async (updatedTrades: Trade[]) => {
    const updated = computeKPIs(updatedTrades, data.kpis.starting);
    setData(updated);
    try {
      await saveMonth(updated);
    } catch (err: any) {
      toast.error(err?.message || 'Αποτυχία αποθήκευσης');
    }
  };

  const handleSaveTrade = async (trade: Trade) => {
    const existingIdx = data.trades.findIndex(t => t.idx === trade.idx);
    let newTrades: Trade[];
    if (existingIdx >= 0) {
      newTrades = [...data.trades];
      newTrades[existingIdx] = trade;
      toast.success(`✓ Trade #${trade.idx} updated`);
    } else {
      newTrades = [...data.trades, trade].sort((a, b) => {
        const ao = new Date(a.open).getTime();
        const bo = new Date(b.open).getTime();
        return ao - bo;
      });
      newTrades = newTrades.map((t, i) => ({ ...t, idx: i + 1 }));
      toast.success(`✓ Trade #${trade.idx} added`);
    }
    const updated = computeKPIs(newTrades, data.kpis.starting);
    setData(updated);
    setShowAddTrade(false);
    setEditingTrade(null);
    try {
      await saveMonth(updated);
    } catch (err: any) {
      toast.error(err?.message || 'Αποτυχία αποθήκευσης στο server');
    }
  };

  const handleEditTrade = (trade: Trade) => {
    setEditingTrade(trade);
    setSelectedTrade(null);
    setShowAddTrade(true);
  };

  const handleStartingChange = async (newStarting: number) => {
    const recomputed = computeKPIs(data.trades, newStarting);
    // Preserve displayed month metadata (computeKPIs infers month from trades).
    recomputed.meta = { ...data.meta, last_sync: recomputed.meta.last_sync };
    setData(recomputed);
    try {
      await saveMonth(recomputed);
      toast.success('✓ Starting balance updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save starting balance');
    }
  };

  const handleSaveAdjustment = async (adj: Adjustment) => {
    const list = data.adjustments ? [...data.adjustments] : [];
    const existingIdx = list.findIndex(a => a.id === adj.id);
    if (existingIdx >= 0) {
      list[existingIdx] = adj;
    } else {
      list.push(adj);
    }
    // newest first by date
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const updated = computeKPIs(data.trades, data.kpis.starting, list);
    updated.meta = { ...data.meta, last_sync: updated.meta.last_sync };
    setData(updated);
    setEditingAdjustment(null);
    try {
      await saveMonth(updated);
      toast.success(adj.type === 'withdrawal'
        ? `✓ Ανάληψη ${fmtUSDnoSign(adj.amount)} καταχωρήθηκε`
        : `✓ Κατάθεση ${fmtUSDnoSign(adj.amount)} καταχωρήθηκε`);
    } catch (err: any) {
      toast.error(err?.message || 'Αποτυχία αποθήκευσης');
    }
  };

  const handleDeleteAdjustment = async (id: string) => {
    if (!confirm('Διαγραφή cash movement;')) return;
    const list = (data.adjustments || []).filter(a => a.id !== id);
    const updated = computeKPIs(data.trades, data.kpis.starting, list);
    updated.meta = { ...data.meta, last_sync: updated.meta.last_sync };
    setData(updated);
    try {
      await saveMonth(updated);
      toast.success('✓ Διαγράφηκε');
    } catch (err: any) {
      toast.error(err?.message || 'Αποτυχία αποθήκευσης');
    }
  };

  const handleEditAdjustment = (adj: Adjustment) => {
    setEditingAdjustment(adj);
    setShowAdjustment(true);
  };

  const handleDeleteTrade = async (idx: number) => {
    if (!confirm(`Διαγραφή trade #${idx};`)) return;
    const newTrades = data.trades.filter(t => t.idx !== idx).map((t, i) => ({ ...t, idx: i + 1 }));
    const updated = computeKPIs(newTrades, data.kpis.starting);
    setData(updated);
    setSelectedTrade(null);
    try {
      await saveMonth(updated);
      toast.success(`✓ Trade #${idx} deleted`);
    } catch (err: any) {
      toast.error(err?.message || 'Αποτυχία αποθήκευσης διαγραφής');
    }
  };

  // ===== Period filter — applies to KPIs / charts / tables =====
  const periodRange = useMemo(() => {
    if (periodPreset === 'custom') {
      return resolveRange('custom', {
        from: customFrom ? new Date(customFrom) : null,
        to: customTo ? new Date(customTo) : null,
      });
    }
    return resolveRange(periodPreset);
  }, [periodPreset, customFrom, customTo]);

  const periodActive = periodRange.preset !== 'all' && (periodRange.from !== null || periodRange.to !== null);

  // ===== Global Current Balance =====
  // ----- Current Balance is DERIVED, never editable -----
  // Single source of truth: the latest snapshotted month's `ending`, which is
  // already `starting + Σ(pnl + swap + commission)` (see
  // `lib/monthlyHistory.ts → recomputeSnapshotKpis`). For users who haven't
  // saved any month yet we fall back to the live KPIs of the current month.
  // This guarantees the Current Balance always agrees with the trade log and
  // can never drift because of a stale manual override.
  const globalCurrentBalance = useMemo<number>(() => {
    if (monthlyHistory.length > 0) {
      const sorted = [...monthlyHistory].sort(
        (a, b) => monthSortValue(b) - monthSortValue(a),
      );
      const latest = sorted[0];
      if (latest && Number.isFinite(latest.ending) && latest.ending > 0) {
        return latest.ending;
      }
    }
    if (Number.isFinite(data.kpis.ending) && data.kpis.ending > 0) {
      return data.kpis.ending;
    }
    if (Number.isFinite(data.kpis.starting) && data.kpis.starting > 0) {
      return data.kpis.starting;
    }
    return 0;
  }, [monthlyHistory, data.kpis.ending, data.kpis.starting]);

  // One-time cleanup of any stale, manually-edited Current Balance values that
  // older builds persisted to localStorage. Runs per-user so we wipe both the
  // legacy un-namespaced key and the per-account key.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem('apexhub_current_balance');
      if (user?.openId) {
        window.localStorage.removeItem(`apexhub_current_balance:${user.openId}`);
      }
    } catch {
      /* storage unavailable */
    }
  }, [user?.openId]);

  // ===== Period view (cross-month) =====
  // When a period preset is active, recompute KPIs across every snapshot and
  // present them as if they were a single trading window. Otherwise fall back
  // to the active month's data.
  const periodView = useMemo(() => {
    if (!periodActive) return null;
    return computePeriodView(monthlyHistory, periodRange, globalCurrentBalance);
  }, [periodActive, monthlyHistory, periodRange, globalCurrentBalance]);

  // Adapter: project the cross-month aggregate into the legacy KPIs shape so
  // existing UI (KPI cards, charts, sub-text) keeps working without a rewrite.
  const adaptedKpis = useMemo(() => {
    if (!periodView) return data.kpis;
    const pk: PeriodKpis = periodView.kpis;
    const ending = globalCurrentBalance + pk.net_result;
    return {
      starting: globalCurrentBalance,
      ending,
      net_result: pk.net_result,
      return_pct: pk.return_pct,
      total_trades: pk.total_trades,
      wins: pk.wins,
      losses: pk.losses,
      win_rate: pk.win_rate,
      profit_factor: pk.profit_factor,
      avg_win: pk.avg_win,
      avg_loss: pk.avg_loss,
      max_win_streak: pk.max_win_streak,
      max_loss_streak: pk.max_loss_streak,
      best_trade: pk.best_trade
        ? { pnl: pk.best_trade.pnl, symbol: pk.best_trade.symbol, idx: pk.best_trade.idx }
        : { pnl: 0, symbol: '—', idx: 0 },
      worst_trade: pk.worst_trade
        ? { pnl: pk.worst_trade.pnl, symbol: pk.worst_trade.symbol, idx: pk.worst_trade.idx }
        : { pnl: 0, symbol: '—', idx: 0 },
      max_drawdown_pct: pk.max_drawdown_pct,
      avg_r: 0,
      total_r: 0,
    };
  }, [periodView, data.kpis, globalCurrentBalance]);

  const adaptedSymbols = useMemo(() => {
    if (!periodView) return data.symbols;
    return periodView.kpis.symbols.map(s => ({
      symbol: s.symbol,
      pnl: s.pnl,
      trades: s.trades,
      win_rate: s.win_rate,
      wins: s.wins,
      losses: s.losses,
    }));
  }, [periodView, data.symbols]);

  const adaptedTrades: Trade[] = useMemo(() => {
    if (!periodView) return data.trades;
    // StampedTrade extends Trade so this cast is safe; the extra fields are
    // ignored by downstream consumers that only know the Trade shape.
    return periodView.trades.map((t: StampedTrade) => ({ ...t })) as Trade[];
  }, [periodView, data.trades]);

  const trades = adaptedTrades;
  const kpis = adaptedKpis;
  const symbols = adaptedSymbols;
  const meta = data.meta;

  // Filtered trades (win/loss/buy/sell/search on top of the period view)
  const filteredTrades = (trades as Trade[]).filter((t: Trade) => {
    if (filter === 'wins' && t.pnl <= 0) return false;
    if (filter === 'losses' && t.pnl >= 0) return false;
    if (filter === 'buy' && t.direction !== 'BUY') return false;
    if (filter === 'sell' && t.direction !== 'SELL') return false;
    if (search && !t.symbol.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Equity curve data — computed from the period-scoped trades using a running
  // cumulative balance derived from kpis.starting (no per-trade balance needed).
  const periodBalances = useMemo(
    () => computeRunningBalances(trades as Trade[], kpis.starting),
    [trades, kpis.starting],
  );
  const equityData = [
    { name: 'Start', value: kpis.starting, drawdown: 0, pnl: 0 },
    ...(trades as Trade[]).map((t: Trade, i: number) => {
      const series = periodBalances.slice(0, i + 1);
      const peak = Math.max(kpis.starting, ...series);
      const current = periodBalances[i] ?? kpis.starting;
      const dd = peak > 0 ? ((peak - current) / peak) * 100 : 0;
      return {
        name: `#${t.idx}`,
        value: current,
        drawdown: -dd,
        pnl: t.pnl,
      };
    }),
  ];

  // P/L bar data
  const pnlBarData = (trades as Trade[]).map((t: Trade) => ({
    name: `#${t.idx}`,
    symbol: t.symbol,
    value: t.pnl,
  }));

  // Symbol bar data
  const symbolData = symbols.slice(0, 9).map((s: typeof symbols[number]) => ({
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

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />

      {/* ===== ACTIVE TRADE BANNER ===== */}
      <AnimatePresence>
        {activeTrade && (
          <ActiveTradeBanner
            activeTrade={activeTrade}
            onEdit={() => setShowActiveTradeModal(true)}
            onClose={() => { clearActiveTrade().catch(() => {}); }}
          />
        )}
      </AnimatePresence>

      {/* ===== TOPBAR ===== */}
      <div className="sticky top-0 z-30 bg-[#070F1C]/90 backdrop-blur-md border-b border-white/8">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Sidebar toggle */}
            <button
              onClick={() => setShowSidebar(true)}
              className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-[#4A6080] hover:text-white hover:bg-white/5 transition-all"
              title="Monthly History"
            >
              <Calendar size={14} />
              {monthlyHistory.length > 0 && (
                <span className="font-mono text-[9px] bg-[#0077B6] text-white rounded-full w-4 h-4 flex items-center justify-center">
                  {monthlyHistory.length}
                </span>
              )}
            </button>
            <div className="w-px h-5 bg-white/8" />
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663576082454/8kEKtsKWxF9JiwbjRbrvBM/utj-logo-badge-N5NDtvx9GcDyhxwM7gRvFA.webp"
              alt="Ultimate Trading Journal"
              className="w-8 h-8 rounded-lg object-contain"
            />
            <div className="hidden sm:block">
              <div className="font-['Space_Grotesk'] font-semibold text-sm text-white tracking-wide">ULTIMATE</div>
              <div className="font-mono text-[9px] text-[#4A6080] uppercase tracking-[0.12em]">TRADING JOURNAL</div>
            </div>
            {/* Current account badge + switcher. Only shown when an accountId
                is in the URL (i.e. signed-in, multi-account flow). */}
            {CLERK_ENABLED && currentAccount && (
              <>
                <div className="w-px h-5 bg-white/8 hidden md:block" />
                <button
                  onClick={() => setLocation('/')}
                  className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#0D1E35]/80 hover:bg-[#0D1E35] hover:border-white/20 transition-all"
                  title="Switch account"
                  data-testid="current-account-badge"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: currentAccount.color || '#0077B6' }}
                  />
                  <div className="text-left">
                    <div className="font-['Space_Grotesk'] font-semibold text-[11px] text-white leading-tight max-w-[140px] truncate">
                      {currentAccount.name}
                    </div>
                    <div className="font-mono text-[8px] text-[#4A6080] uppercase tracking-widest leading-tight">
                      {currentAccount.accountType === 'prop' && 'Prop Firm'}
                      {currentAccount.accountType === 'live' && 'Personal Live'}
                      {currentAccount.accountType === 'demo' && 'Demo'}
                      {currentAccount.accountType === 'other' && 'Other'}
                      <span className="text-[#4A6080]"> · Switch</span>
                    </div>
                  </div>
                  <ChevronDown size={11} className="text-[#4A6080] group-hover:text-white transition-colors" />
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#4A6080]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00897B] animate-pulse-dot" />
              LIVE
            </div>
            <div className="hidden sm:block font-mono text-[10px] text-[#4A6080]">
              SYNC · {meta.last_sync}
            </div>
            {/* + NEW MONTH button - opens modal to spin up empty month */}
            <button
              onClick={() => setShowNewMonth(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0D1E35] border border-[#0094C6]/30 hover:border-[#0094C6] rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider text-[#0094C6] hover:text-white hover:bg-[#0094C6]/10 transition-all"
              title="Start a new month with zero trades"
            >
              <CalendarPlus size={12} strokeWidth={2.5} /> <span className="hidden md:inline">NEW MONTH</span>
            </button>
            {/* + IMPORT EXCEL button - opens modal to upload an .xlsx and create a month */}
            <button
              onClick={() => setShowImportExcel(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0D1E35] border border-[#5E60CE]/30 hover:border-[#5E60CE] rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider text-[#5E60CE] hover:text-white hover:bg-[#5E60CE]/10 transition-all"
              title="Import an MT5 / Ultimate Trading Journal .xlsx file as a new month"
            >
              <FileSpreadsheet size={12} strokeWidth={2.5} /> <span className="hidden md:inline">IMPORT</span>
            </button>
            {/* + ADD TRADE button - primary CTA */}
            <button
              onClick={() => { setEditingTrade(null); setShowAddTrade(true); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-br from-[#0094C6] to-[#005377] hover:from-[#00B4D8] hover:to-[#0094C6] rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider text-white shadow-lg shadow-[#0094C6]/20 transition-all"
              title="Add new trade"
            >
              <Plus size={12} strokeWidth={3} /> <span className="hidden xs:inline sm:inline">ADD TRADE</span><span className="xs:hidden sm:hidden">NEW</span>
            </button>
            {/* Export button */}
            <button
              onClick={async () => {
                try {
                  await exportToExcel(data, currentAccount?.name);
                  toast.success('✓ Excel εξήχθη');
                } catch (err) {
                  console.error('[exportToExcel]', err);
                  toast.error('Excel export απέτυχε');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0D1E35] border border-white/10 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider text-white/80 hover:border-[#00897B]/50 hover:text-[#00897B] transition-all"
              title="Export to Excel"
            >
              <Download size={12} /> <span className="hidden md:inline">EXPORT</span>
            </button>
            {/* Withdrawal / Deposit button — opens the cash-movement modal */}
            <button
              onClick={() => { setEditingAdjustment(null); setShowAdjustment(true); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0D1E35] border border-white/10 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider text-white/80 hover:border-[#F4A261]/60 hover:text-[#F4A261] transition-all"
              title="Cash movement (withdrawal / deposit)"
              data-testid="withdrawal-button"
            >
              <Wallet size={12} /> <span className="hidden md:inline">CASH</span>
            </button>
            {/* What-If / Risk Calculator button — opens the R-multiple replay dialog */}
            <button
              onClick={() => setShowWhatIf(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0D1E35] border border-white/10 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider text-white/80 hover:border-[#5E60CE]/60 hover:text-[#A8AAFF] transition-all"
              title="What-If risk calculator"
              data-testid="whatif-button"
            >
              <Calculator size={12} /> <span className="hidden md:inline">CALC</span>
            </button>
            {/* Share snapshot button — opens the Share Card dialog */}
            <button
              onClick={() => setShowShareCard(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0D1E35] border border-white/10 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider text-white/80 hover:border-[#F4A261]/60 hover:text-[#F4A261] transition-all"
              title="Share snapshot"
              data-testid="share-button"
            >
              <Share2 size={12} /> <span className="hidden md:inline">SHARE</span>
            </button>
            {/* Dark/Light theme toggle */}
            <ThemeToggle />
            {/* Clerk user menu (only rendered when Clerk is active) */}
            {CLERK_ENABLED && (
              <div className="ml-1 flex items-center">
                <SignedIn>
                  <UserButton
                    appearance={{
                      elements: {
                        avatarBox: 'w-8 h-8 ring-1 ring-white/10',
                      },
                    }}
                    afterSignOutUrl="/"
                  />
                </SignedIn>
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className="flex items-center gap-1.5 px-3 py-2 bg-[#0D1E35] border border-white/10 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider text-white/80 hover:border-[#0094C6]/60 hover:text-[#0094C6] transition-all">
                      SIGN IN
                    </button>
                  </SignInButton>
                </SignedOut>
              </div>
            )}
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
                {meta.month_name
                  ? (<>{meta.month_name} <span className="text-[#0077B6]">'{meta.year_short}</span></>)
                  : (<span className="text-[#4A6080]">START YOUR JOURNAL</span>)
                }
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="font-mono text-[10px] text-[#4A6080] uppercase tracking-[0.15em] mt-2"
              >
                {meta.month_name
                  ? `ULTIMATE · ${kpis.total_trades} TRADES · ${(kpis.win_rate * 100).toFixed(1)}% WR`
                  : 'ULTIMATE · PRESS NEW MONTH OR IMPORT TO BEGIN'}
              </motion.div>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-right"
            >
              <CurrentBalanceHero
                value={globalCurrentBalance}
                periodActive={periodActive}
                periodLabel={periodActive ? formatPeriodRange(periodRange) : ''}
                netResult={kpis.net_result}
                returnPct={kpis.return_pct}
              />
            </motion.div>
          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-8">

        {/* ===== PERIOD FILTER ===== */}
        <div className="bg-[#0D1E35]/80 border border-white/8 rounded-2xl p-4 backdrop-blur-sm flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={12} className="text-[#0094C6]" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#6E8AA8]">Period</span>
            {periodActive && (
              <span className="font-mono text-[9px] text-[#F4A261] uppercase tracking-wider">
                · showing {filteredTrades.length}/{(data.trades as Trade[]).length} trades
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all','this-month','30d','60d','90d','custom'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriodPreset(p)}
                className={`px-2.5 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-wider transition-all ${
                  periodPreset === p
                    ? 'bg-[#0077B6] text-white'
                    : 'bg-[#0A1628] text-[#4A6080] border border-white/8 hover:text-white'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          {periodPreset === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="bg-[#0A1628] border border-white/10 rounded-lg px-2.5 py-1.5 font-mono text-[10px] text-white focus:outline-none focus:border-[#0077B6]"
              />
              <span className="font-mono text-[#4A6080] text-[10px]">→</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="bg-[#0A1628] border border-white/10 rounded-lg px-2.5 py-1.5 font-mono text-[10px] text-white focus:outline-none focus:border-[#0077B6]"
              />
            </div>
          )}
        </div>

        {/* ===== KPI GRID ===== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StartingBalanceCard
            starting={kpis.starting}
            disabled={periodActive}
            onChange={handleStartingChange}
          />
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
            sub={`${kpis.best_trade.symbol} · #${kpis.best_trade.idx} · ${kpis.starting > 0 ? fmtPct(kpis.best_trade.pnl / kpis.starting) : '—'}`}
            accent={C_PROFIT}
            icon={<Award size={12} />}
            valueClass="text-[#00897B]"
            delay={0.25}
          />
          <KpiCard
            label="▼ Worst Trade"
            value={fmtUSD(kpis.worst_trade.pnl)}
            sub={`${kpis.worst_trade.symbol} · #${kpis.worst_trade.idx} · ${kpis.starting > 0 ? fmtPct(kpis.worst_trade.pnl / kpis.starting) : '—'}`}
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
            <div className="flex gap-1.5">
              {(['equity', 'drawdown', 'pnl'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setChartTab(tab)}
                  className={`px-3 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-wider transition-all ${
                    chartTab === tab ? 'bg-[#0077B6] text-white' : 'bg-[#0A1628] text-[#4A6080] hover:text-white border border-white/8'
                  }`}
                >
                  {tab === 'equity' ? 'Equity' : tab === 'drawdown' ? 'DD' : 'P/L'}
                </button>
              ))}
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              {chartTab === 'equity' ? (
                <AreaChart data={equityData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C_OCEAN} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={C_OCEAN} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill: '#4A6080', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fill: '#4A6080', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={v => '$' + (v / 1000).toFixed(0) + 'k'}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="value" stroke={C_OCEAN} strokeWidth={2} fill="url(#eqGrad)" dot={false} />
                </AreaChart>
              ) : chartTab === 'drawdown' ? (
                <AreaChart data={equityData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C_LOSS} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={C_LOSS} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill: '#4A6080', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#4A6080', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(1) + '%'} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="drawdown" stroke={C_LOSS} strokeWidth={2} fill="url(#ddGrad)" dot={false} />
                </AreaChart>
              ) : (
                <BarChart data={pnlBarData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill: '#4A6080', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#4A6080', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} tickFormatter={v => '$' + (v / 1000).toFixed(1) + 'k'} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {pnlBarData.map((entry, i) => (
                      <Cell key={i} fill={entry.value >= 0 ? C_PROFIT : C_LOSS} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* ===== CHARTS ROW ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Symbol P/L */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="bg-[#0D1E35]/80 border border-white/8 rounded-2xl p-5 backdrop-blur-sm"
          >
            <div className="text-xs font-mono uppercase tracking-widest text-[#4A6080] mb-4 flex items-center gap-2">
              <BarChart2 size={12} className="text-[#0077B6]" />
              Symbol P/L
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={symbolData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#4A6080', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} tickFormatter={v => '$' + (v / 1000).toFixed(1) + 'k'} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#fff', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} width={55} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine x={0} stroke="rgba(255,255,255,0.1)" />
                  <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                    {symbolData.map((entry: typeof symbolData[number], i: number) => (
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
            className="bg-[#0D1E35]/80 border border-white/8 rounded-2xl p-5 backdrop-blur-sm"
          >
            <div className="text-xs font-mono uppercase tracking-widest text-[#4A6080] mb-4 flex items-center gap-2">
              <Target size={12} className="text-[#0077B6]" />
              Win / Loss
            </div>
            <div className="relative h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    startAngle={90} endAngle={-270}
                  >
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any, n: any) => [`${v} trades`, n]} contentStyle={{ background: '#0D1E35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontFamily: 'JetBrains Mono', fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="font-mono text-2xl font-bold text-white">{(kpis.win_rate * 100).toFixed(1)}%</div>
                <div className="font-mono text-[9px] text-[#4A6080] uppercase tracking-wider">Win Rate</div>
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
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4A6080]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Symbol..."
                  className="bg-[#0A1628] border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-xs font-mono text-white placeholder-[#4A6080] focus:outline-none focus:border-[#0077B6] w-28"
                />
              </div>
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
                  {['#', 'Day', 'Open', 'Close', 'Symbol', 'Side', 'Lots', 'Entry', 'Exit', 'SL', 'TP', 'R', 'Net'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-mono text-[9px] uppercase tracking-widest text-[#4A6080] font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map(t => {
                  return (
                    <tr
                      key={t.idx}
                      onClick={() => setSelectedTrade(t)}
                      className="border-b border-white/5 hover:bg-white/4 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-2.5 font-mono text-[#4A6080]">#{String(t.idx).padStart(2, '0')}</td>
                      <td className="px-3 py-2.5 font-mono text-white/70">{dayShort(t.day)}</td>
                      <td className="px-3 py-2.5 font-mono text-white/70">{fmtDT(t.open)}</td>
                      <td className="px-3 py-2.5 font-mono text-white/70">{fmtDT(t.close_time)}</td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-white">{t.symbol}</td>
                      <td className="px-3 py-2.5">
                        <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          t.direction === 'BUY' ? 'bg-[#00897B]/15 text-[#00897B]' : 'bg-[#E94F37]/15 text-[#E94F37]'
                        }`}>{t.direction}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-white/70">{t.lots}</td>
                      <td className="px-3 py-2.5 font-mono text-white/70">{fmtPrice(t.entry)}</td>
                      <td className="px-3 py-2.5 font-mono text-white/70">{fmtPrice(t.close)}</td>
                      <td className="px-3 py-2.5 font-mono text-[#4A6080]">{fmtPrice(t.sl)}</td>
                      <td className="px-3 py-2.5 font-mono text-[#4A6080]">{fmtPrice(t.tp)}</td>
                      <td className={`px-3 py-2.5 font-mono text-xs ${t.trade_r !== null && t.trade_r >= 0 ? 'text-[#00897B]' : 'text-[#E94F37]'}`}>
                        {fmtR(t.trade_r)}
                      </td>
                      <td className={`px-3 py-2.5 font-mono font-semibold ${t.pnl >= 0 ? 'text-[#00897B]' : 'text-[#E94F37]'}`}>
                        {fmtUSD(t.pnl)}
                        {t.net_pct !== 0 && (
                          <span className="ml-1.5 text-[9px] text-[#4A6080]">({fmtPct(t.net_pct)})</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden divide-y divide-white/5">
            {filteredTrades.map(t => (
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
                    {t.net_pct !== 0 && (
                      <span className="ml-1 text-[9px] text-[#4A6080]">({fmtPct(t.net_pct)})</span>
                    )}
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
                  {['Symbol', 'Trades', 'Wins', 'Losses', 'Win Rate', 'Total P/L', '%'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-mono text-[9px] uppercase tracking-widest text-[#4A6080] font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {symbols.map((s: typeof symbols[number], i: number) => (
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
                    <td className={`px-4 py-2.5 font-mono ${s.pnl >= 0 ? 'text-[#00897B]' : 'text-[#E94F37]'}`}>
                      {kpis.starting > 0 ? fmtPct(s.pnl / kpis.starting) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* ===== CASH MOVEMENTS (withdrawals / deposits) ===== */}
        {data.adjustments && data.adjustments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.6 }}
            className="bg-[#0D1E35]/80 border border-white/8 rounded-2xl overflow-hidden backdrop-blur-sm"
          >
            <div className="p-4 border-b border-white/8 flex items-center justify-between">
              <div className="text-xs font-mono uppercase tracking-widest text-[#4A6080] flex items-center gap-2">
                <Wallet size={12} className="text-[#F4A261]" />
                Cash Movements
                <span className="text-[#4A6080]">· {data.adjustments.length}</span>
              </div>
              <div className="font-mono text-[10px] text-[#4A6080]">
                Net: <span className={sumAdjustments(data.adjustments) >= 0 ? 'text-[#00897B] font-semibold' : 'text-[#E94F37] font-semibold'}>{fmtUSD(sumAdjustments(data.adjustments))}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/8">
                    {['Date', 'Type', 'Amount', 'Note', ''].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-mono text-[9px] uppercase tracking-widest text-[#4A6080] font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.adjustments.map((adj) => {
                    const isWd = adj.type === 'withdrawal';
                    const accent = isWd ? '#E94F37' : '#00897B';
                    return (
                      <tr key={adj.id} className="border-b border-white/5 hover:bg-white/4 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-white/70">{adj.date}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold uppercase tracking-wider"
                            style={{ background: `${accent}22`, color: accent }}
                          >
                            {isWd ? <ArrowUpToLine size={10} /> : <ArrowDownToLine size={10} />}
                            {isWd ? 'Withdrawal' : 'Deposit'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: accent }}>
                          {isWd ? '−' : '+'}{fmtUSDnoSign(adj.amount)}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-white/60 max-w-[260px] truncate" title={adj.note || ''}>
                          {adj.note || '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEditAdjustment(adj)}
                              className="p-1.5 rounded-md text-[#4A6080] hover:text-white hover:bg-white/5 transition-all"
                              title="Edit"
                            >
                              <Edit3 size={11} />
                            </button>
                            <button
                              onClick={() => handleDeleteAdjustment(adj.id)}
                              className="p-1.5 rounded-md text-[#4A6080] hover:text-[#E94F37] hover:bg-[#E94F37]/10 transition-all"
                              title="Delete"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* ===== OVERALL GROWTH ===== */}
        {monthlyHistory.length >= 2 && (
          <OverallGrowthSection history={monthlyHistory} />
        )}

      </div>

      {/* ===== FOOTER ===== */}
      <div className="border-t border-white/8 bg-[#070F1C] py-6">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663576082454/8kEKtsKWxF9JiwbjRbrvBM/utj-logo-badge-N5NDtvx9GcDyhxwM7gRvFA.webp"
              alt="Ultimate Trading Journal"
              className="w-7 h-7 rounded-lg object-contain"
            />
            <span className="font-mono text-[10px] text-[#4A6080] uppercase tracking-widest">Ultimate Trading Journal · {meta.year_full}</span>
          </div>
          <div className="font-mono text-[10px] text-[#4A6080]">
            Drop .xlsx · SYNC · EXPORT
          </div>
        </div>
      </div>

      {/* ===== SHARE CARD DIALOG ===== */}
      {showShareCard && (
        <ShareCardDialog
          open={showShareCard}
          onClose={() => setShowShareCard(false)}
          data={data}
          account={currentAccount}
          accountId={accountId}
        />
      )}

      {/* ===== ADJUSTMENT (CASH MOVEMENT) MODAL ===== */}
      <AdjustmentModal
        open={showAdjustment}
        onClose={() => { setShowAdjustment(false); setEditingAdjustment(null); }}
        onSave={handleSaveAdjustment}
        defaultDate={new Date().toISOString().slice(0, 10)}
        initial={editingAdjustment ?? undefined}
      />

      {/* ===== WHAT-IF / RISK CALCULATOR DIALOG ===== */}
      {showWhatIf && (
        <WhatIfCalculatorDialog
          open={showWhatIf}
          onClose={() => setShowWhatIf(false)}
          monthTrades={data.trades}
          allTimeTrades={(() => {
            // Concatenate trades from every saved month + the live current month,
            // de-duplicated by (open + symbol + entry) so we don't double-count
            // when the live month is also persisted as a snapshot.
            const seen = new Set<string>();
            const out: Trade[] = [];
            const push = (tr: Trade) => {
              const key = `${tr.open}|${tr.symbol}|${tr.entry}|${tr.close}`;
              if (seen.has(key)) return;
              seen.add(key);
              out.push(tr);
            };
            for (const snap of monthlyHistory) {
              try {
                const arr = JSON.parse(snap.trades_json) as Trade[];
                if (Array.isArray(arr)) arr.forEach(push);
              } catch { /* ignore malformed snapshots */ }
            }
            data.trades.forEach(push);
            return out;
          })()}
          monthLabel={`${meta.month_name || 'CURRENT'} ${meta.year_full || ''}`.trim()}
          currentKey={currentKey}
          scopeMonths={(() => {
            // Build the catalogue: every saved month + the live current month
            // (in case it hasn't been snapshotted yet).
            const seen = new Set<string>();
            const out: Array<{
              key: string;
              monthName: string;
              yearFull: string;
              yearShort: string;
              tradeCount: number;
            }> = [];
            for (const snap of monthlyHistory) {
              if (seen.has(snap.key)) continue;
              seen.add(snap.key);
              let count = 0;
              try {
                const arr = JSON.parse(snap.trades_json) as Trade[];
                count = Array.isArray(arr) ? arr.length : 0;
              } catch { /* keep 0 */ }
              out.push({
                key: snap.key,
                monthName: snap.month_name,
                yearFull: snap.year_full,
                yearShort: snap.year_short,
                tradeCount: count,
              });
            }
            if (currentKey && !seen.has(currentKey) && meta.month_name) {
              out.push({
                key: currentKey,
                monthName: meta.month_name,
                yearFull: meta.year_full || '',
                yearShort: meta.year_short || (meta.year_full || '').slice(-2),
                tradeCount: data.trades.length,
              });
            }
            return out;
          })()}
        />
      )}

      {/* ===== TRADE DETAIL DIALOG (full-screen replacement for the old drawer) ===== */}
      <TradeDetailDialog
        trade={selectedTrade}
        onClose={() => setSelectedTrade(null)}
        onEdit={handleEditTrade}
        onDelete={handleDeleteTrade}
      />

      {/* ===== MONTHLY SIDEBAR ===== */}
      <MonthlySidebar
        history={monthlyHistory}
        currentKey={currentKey}
        onSelect={handleSelectMonth}
        onDelete={handleDeleteMonth}
        onClose={() => setShowSidebar(false)}
        isOpen={showSidebar}
      />

      {/* ===== MODALS ===== */}
      <AnimatePresence>
        {showActiveTradeModal && (
          <ActiveTradeModal
            initial={activeTrade}
            onSave={(t) => { saveActiveTrade(t).catch((err) => toast.error(err?.message || 'Αποτυχία αποθήκευσης active trade')); }}
            onClose={() => setShowActiveTradeModal(false)}
          />
        )}
        {showImportLinks && (
          <ImportLinksModal
            trades={trades}
            onImport={handleImportLinks}
            onClose={() => setShowImportLinks(false)}
          />
        )}
        {showAddTrade && (
          <AddTradeModal
            initial={editingTrade}
            lastBalance={(() => {
              if (editingTrade) {
                const idxInPeriod = (trades as Trade[]).findIndex(x => x.idx === editingTrade.idx);
                if (idxInPeriod > 0) return periodBalances[idxInPeriod - 1];
                return kpis.starting;
              }
              return periodBalances.length > 0 ? periodBalances[periodBalances.length - 1] : kpis.starting;
            })()}
            nextIdx={trades.length + 1}
            onSave={handleSaveTrade}
            onClose={() => { setShowAddTrade(false); setEditingTrade(null); }}
          />
        )}
      </AnimatePresence>

      {/* ===== NEW MONTH MODAL ===== */}
      <NewMonthModal
        isOpen={showNewMonth}
        onClose={() => setShowNewMonth(false)}
        existingKeys={monthlyHistory.map(h => h.key)}
        defaultStarting={globalCurrentBalance || kpis.ending || kpis.starting}
        onOpenExisting={(key) => {
          const snap = monthlyHistory.find(h => h.key === key);
          if (snap) handleSelectMonth(snap);
        }}
        onConfirm={async ({ monthName, yearFull, starting }) => {
          // Build a fresh empty TradingData and switch to it instantly so the
          // user sees the cleared dashboard before the network round-trip
          // completes.
          const empty = createEmptyMonth(monthName, yearFull, starting);
          setData(empty);
          setFilter('all');
          setSearch('');
          setChartTab('equity');
          // Don't let the auto-hydrate effect overwrite our explicit selection.
          hydratedFromServerRef.current = true;
          try {
            await saveMonth(empty);
            toast.success(`✓ ${monthName} '${yearFull.slice(2)} δημιουργήθηκε · Όποιο νέο trade προσθέσεις θα πάει εδώ`);
          } catch (err: any) {
            toast.error(err?.message || 'Αποτυχία αποθήκευσης νέου μήνα');
            throw err;
          }
        }}
      />

      {/* ===== IMPORT EXCEL MODAL ===== */}
      {showImportExcel && (
        <ImportExcelModal
          existingMonthKeys={monthlyHistory.map(h => h.key)}
          onClose={() => setShowImportExcel(false)}
          onImport={async (importedData) => {
            setData(importedData);
            setFilter('all');
            setSearch('');
            setChartTab('equity');
            hydratedFromServerRef.current = true;
            try {
              await saveMonth(importedData);
            } catch (err: any) {
              toast.error(err?.message || 'Αποτυχία αποθήκευσης μήνα');
            }
          }}
        />
      )}

    </div>
  );
}
