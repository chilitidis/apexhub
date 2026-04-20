// ===== TITANS Trading Journal — Data Types & Utilities =====
// Design: Ocean Depth Premium — deep navy, ocean blue accents, teal/coral for P/L

export interface Trade {
  idx: number;
  ticket: string | number;
  day: string;
  open: string;
  close_time: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  lots: number;
  entry: number;
  close: number;
  sl: number | null;
  tp: number | null;
  trade_r: number | null;
  pnl: number;
  swap: number;
  commission: number;
  net_pct: number;
  balance_after: number;
  tf?: string;
}

export interface SymbolStat {
  symbol: string;
  pnl: number;
  trades: number;
  win_rate: number;
  wins: number;
  losses: number;
}

export interface KPIs {
  starting: number;
  ending: number;
  net_result: number;
  return_pct: number;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  profit_factor: number;
  avg_win: number;
  avg_loss: number;
  max_win_streak: number;
  max_loss_streak: number;
  best_trade: { pnl: number; symbol: string; idx: number };
  worst_trade: { pnl: number; symbol: string; idx: number };
  max_drawdown_pct: number;
  avg_r: number;
  total_r: number;
}

export interface Meta {
  month_name: string;
  year_short: string;
  year_full: string;
  subtitle: string;
  last_sync: string;
}

export interface TradingData {
  trades: Trade[];
  kpis: KPIs;
  symbols: SymbolStat[];
  meta: Meta;
}

// ===== FORMATTERS =====

export const fmtUSD = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  const sign = n >= 0 ? '+' : '-';
  return sign + '$' + abs.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const fmtUSDnoSign = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return '—';
  return '$' + n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const fmtPct = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return '—';
  return (n >= 0 ? '+' : '') + (n * 100).toFixed(2) + '%';
};

export const fmtR = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + 'R';
};

export const fmtPrice = (n: number | null | undefined | string): string => {
  if (n === null || n === undefined || n === '') return '—';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '—';
  return num < 10
    ? num.toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 5 })
    : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const fmtDT = (s: string | null | undefined): string => {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.getDate().toString().padStart(2, '0') + '.' +
    (d.getMonth() + 1).toString().padStart(2, '0') + '  ' +
    d.getHours().toString().padStart(2, '0') + ':' +
    d.getMinutes().toString().padStart(2, '0');
};

export const dayShort = (d: string): string => {
  const map: Record<string, string> = {
    'ΔΕΥΤΕΡΑ': 'ΔΕΥ', 'ΤΡΙΤΗ': 'ΤΡΙ', 'ΤΕΤΑΡΤΗ': 'ΤΕΤ',
    'ΠΕΜΠΤΗ': 'ΠΕΜ', 'ΠΑΡΑΣΚΕΥΗ': 'ΠΑΡ', 'ΣΑΒΒΑΤΟ': 'ΣΑΒ', 'ΚΥΡΙΑΚΗ': 'ΚΥΡ'
  };
  return map[d] || (d ? d.slice(0, 3) : '—');
};

export const durationStr = (open: string, close: string): string => {
  if (!open || !close) return '—';
  const o = new Date(open), c = new Date(close);
  if (isNaN(o.getTime()) || isNaN(c.getTime())) return '—';
  const diff = Math.abs(c.getTime() - o.getTime());
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
};

// ===== EXCEL PARSER =====

declare global {
  interface Window {
    XLSX: any;
  }
}

export function parseExcelToTradingData(file: File): Promise<TradingData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = window.XLSX.read(data, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd hh:mm:ss' });

        // Find header row
        let headerRow = -1;
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const r = rows[i];
          if (r && r.some((c: any) => typeof c === 'string' && c.toString().toLowerCase().includes('ticket'))) {
            headerRow = i;
            break;
          }
        }
        if (headerRow === -1) {
          // Try to find by common column names
          for (let i = 0; i < Math.min(rows.length, 20); i++) {
            const r = rows[i];
            if (r && r.some((c: any) => typeof c === 'string' && ['symbol', 'pair', 'instrument'].includes(c.toString().toLowerCase()))) {
              headerRow = i;
              break;
            }
          }
        }
        if (headerRow === -1) headerRow = 0;

        const headers = rows[headerRow].map((h: any) => (h || '').toString().toLowerCase().trim());

        const col = (name: string): number => {
          const variants: Record<string, string[]> = {
            ticket: ['ticket', 'order', '#', 'id', 'trade id'],
            day: ['day', 'ημερα', 'ημέρα', 'weekday'],
            open: ['open time', 'open', 'entry time', 'date open', 'time open', 'open date'],
            close_time: ['close time', 'close', 'exit time', 'date close', 'time close', 'close date'],
            symbol: ['symbol', 'pair', 'instrument', 'asset', 'currency'],
            direction: ['direction', 'type', 'side', 'buy/sell', 'action'],
            lots: ['lots', 'volume', 'size', 'qty', 'quantity'],
            entry: ['entry', 'open price', 'price open', 'entry price'],
            close_price: ['close price', 'exit', 'price close', 'exit price', 'close'],
            sl: ['sl', 'stop loss', 'stoploss', 's/l'],
            tp: ['tp', 'take profit', 'takeprofit', 't/p'],
            trade_r: ['trade r', 'r', 'r-multiple', 'r multiple', 'r value'],
            pnl: ['profit', 'p/l', 'pnl', 'net profit', 'gain/loss', 'result', 'profit/loss'],
            swap: ['swap', 'rollover'],
            commission: ['commission', 'comm', 'fee'],
            net_pct: ['net %', 'net pct', 'return %', 'return pct', '% return', 'net return'],
            balance: ['balance', 'account balance', 'running balance', 'balance after'],
            tf: ['tf', 'timeframe', 'time frame'],
          };

          for (const [, v] of Object.entries(variants)) {
            if (v.includes(name)) {
              const idx = headers.findIndex((h: string) => v.includes(h));
              if (idx !== -1) return idx;
            }
          }
          // Direct match
          const idx = headers.findIndex((h: string) => h === name);
          return idx;
        };

        const ticketCol = col('ticket');
        const dayCol = col('day');
        const openCol = col('open');
        const closeTimeCol = col('close_time');
        const symbolCol = col('symbol');
        const directionCol = col('direction');
        const lotsCol = col('lots');
        const entryCol = col('entry');
        const closePriceCol = col('close_price');
        const slCol = col('sl');
        const tpCol = col('tp');
        const tradeRCol = col('trade_r');
        const pnlCol = col('pnl');
        const swapCol = col('swap');
        const commissionCol = col('commission');
        const netPctCol = col('net_pct');
        const balanceCol = col('balance');
        const tfCol = col('tf');

        const parseNum = (v: any): number | null => {
          if (v === null || v === undefined || v === '') return null;
          const s = v.toString().replace(/[,$%\s]/g, '').replace(',', '.');
          const n = parseFloat(s);
          return isNaN(n) ? null : n;
        };

        const parseDir = (v: any): 'BUY' | 'SELL' => {
          const s = (v || '').toString().toUpperCase().trim();
          if (s.includes('BUY') || s === 'B' || s === 'LONG') return 'BUY';
          return 'SELL';
        };

        const trades: Trade[] = [];
        let balance = 0;

        for (let i = headerRow + 1; i < rows.length; i++) {
          const r = rows[i];
          if (!r || !r.length) continue;
          const sym = symbolCol >= 0 ? (r[symbolCol] || '').toString().trim() : '';
          if (!sym || sym.toLowerCase() === 'symbol') continue;
          const pnl = parseNum(pnlCol >= 0 ? r[pnlCol] : null) ?? 0;
          const balAfter = parseNum(balanceCol >= 0 ? r[balanceCol] : null);
          if (balAfter !== null) balance = balAfter;
          else balance += pnl;

          trades.push({
            idx: trades.length + 1,
            ticket: ticketCol >= 0 ? (r[ticketCol] || '').toString() : String(i),
            day: dayCol >= 0 ? (r[dayCol] || '').toString().toUpperCase().trim() : '',
            open: openCol >= 0 ? (r[openCol] || '').toString() : '',
            close_time: closeTimeCol >= 0 ? (r[closeTimeCol] || '').toString() : '',
            symbol: sym.toUpperCase(),
            direction: directionCol >= 0 ? parseDir(r[directionCol]) : 'BUY',
            lots: parseNum(lotsCol >= 0 ? r[lotsCol] : null) ?? 0,
            entry: parseNum(entryCol >= 0 ? r[entryCol] : null) ?? 0,
            close: parseNum(closePriceCol >= 0 ? r[closePriceCol] : null) ?? 0,
            sl: parseNum(slCol >= 0 ? r[slCol] : null),
            tp: parseNum(tpCol >= 0 ? r[tpCol] : null),
            trade_r: parseNum(tradeRCol >= 0 ? r[tradeRCol] : null),
            pnl,
            swap: parseNum(swapCol >= 0 ? r[swapCol] : null) ?? 0,
            commission: parseNum(commissionCol >= 0 ? r[commissionCol] : null) ?? 0,
            net_pct: parseNum(netPctCol >= 0 ? r[netPctCol] : null) ?? 0,
            balance_after: balance,
            tf: tfCol >= 0 ? (r[tfCol] || '').toString() : undefined,
          });
        }

        resolve(computeKPIs(trades));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

export function computeKPIs(trades: Trade[]): TradingData {
  const now = new Date();
  const monthNames = ['ΙΑΝΟΥΑΡΙΟΣ', 'ΦΕΒΡΟΥΑΡΙΟΣ', 'ΜΑΡΤΙΟΣ', 'ΑΠΡΙΛΙΟΣ', 'ΜΑΙΟΣ', 'ΙΟΥΝΙΟΣ',
    'ΙΟΥΛΙΟΣ', 'ΑΥΓΟΥΣΤΟΣ', 'ΣΕΠΤΕΜΒΡΙΟΣ', 'ΟΚΤΩΒΡΙΟΣ', 'ΝΟΕΜΒΡΙΟΣ', 'ΔΕΚΕΜΒΡΙΟΣ'];

  const starting = trades.length > 0 ? trades[0].balance_after - trades[0].pnl : 0;
  const ending = trades.length > 0 ? trades[trades.length - 1].balance_after : starting;
  const net_result = ending - starting;
  const return_pct = starting > 0 ? net_result / starting : 0;

  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  const win_rate = trades.length > 0 ? wins.length / trades.length : 0;

  const gross_profit = wins.reduce((s, t) => s + t.pnl, 0);
  const gross_loss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profit_factor = gross_loss > 0 ? gross_profit / gross_loss : gross_profit > 0 ? 999 : 0;

  const avg_win = wins.length > 0 ? gross_profit / wins.length : 0;
  const avg_loss = losses.length > 0 ? gross_loss / losses.length : 0;

  let max_win_streak = 0, max_loss_streak = 0, cur_w = 0, cur_l = 0;
  for (const t of trades) {
    if (t.pnl > 0) { cur_w++; cur_l = 0; max_win_streak = Math.max(max_win_streak, cur_w); }
    else { cur_l++; cur_w = 0; max_loss_streak = Math.max(max_loss_streak, cur_l); }
  }

  const best = trades.reduce((b, t) => (!b || t.pnl > b.pnl ? t : b), trades[0]);
  const worst = trades.reduce((b, t) => (!b || t.pnl < b.pnl ? t : b), trades[0]);

  // Max drawdown
  let peak = starting, max_dd = 0;
  for (const t of trades) {
    if (t.balance_after > peak) peak = t.balance_after;
    const dd = (peak - t.balance_after) / peak;
    if (dd > max_dd) max_dd = dd;
  }

  // R stats
  const rValues = trades.filter(t => t.trade_r !== null).map(t => t.trade_r as number);
  const avg_r = rValues.length > 0 ? rValues.reduce((s, r) => s + r, 0) / rValues.length : 0;
  const total_r = rValues.reduce((s, r) => s + r, 0);

  // Symbol stats
  const symMap: Record<string, { pnl: number; trades: number; wins: number; losses: number }> = {};
  for (const t of trades) {
    if (!symMap[t.symbol]) symMap[t.symbol] = { pnl: 0, trades: 0, wins: 0, losses: 0 };
    symMap[t.symbol].pnl += t.pnl;
    symMap[t.symbol].trades++;
    if (t.pnl > 0) symMap[t.symbol].wins++;
    else symMap[t.symbol].losses++;
  }
  const symbols: SymbolStat[] = Object.entries(symMap).map(([symbol, s]) => ({
    symbol,
    pnl: s.pnl,
    trades: s.trades,
    wins: s.wins,
    losses: s.losses,
    win_rate: s.trades > 0 ? s.wins / s.trades : 0,
  })).sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));

  const pad2 = (n: number) => n.toString().padStart(2, '0');
  const last_sync = `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()} · ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

  return {
    trades,
    kpis: {
      starting, ending, net_result, return_pct,
      total_trades: trades.length,
      wins: wins.length, losses: losses.length, win_rate,
      profit_factor, avg_win, avg_loss,
      max_win_streak, max_loss_streak,
      best_trade: best ? { pnl: best.pnl, symbol: best.symbol, idx: best.idx } : { pnl: 0, symbol: '—', idx: 0 },
      worst_trade: worst ? { pnl: worst.pnl, symbol: worst.symbol, idx: worst.idx } : { pnl: 0, symbol: '—', idx: 0 },
      max_drawdown_pct: max_dd,
      avg_r, total_r,
    },
    symbols,
    meta: {
      month_name: monthNames[now.getMonth()],
      year_short: now.getFullYear().toString().slice(2),
      year_full: now.getFullYear().toString(),
      subtitle: 'INNER CIRCLE · PRIVATE ACCOUNT',
      last_sync,
    },
  };
}
