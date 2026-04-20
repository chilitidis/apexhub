// ===== TITANS Trading Journal — Data Types & Utilities =====
// Design: Ocean Depth Premium — deep navy, ocean blue accents, teal/coral for P/L
//
// EXCEL STRUCTURE (TITANS.xlsx):
//   Row 7:  KPI labels (STARTING BALANCE, NET P/L, WIN RATE, TRADES, BEST TRADE, RISK TARGET)
//   Row 8:  KPI values
//   Row 13: Trade headers: [empty, DAY, OPEN, CLOSE, SYMBOL, SIDE, LOTS, ENTRY, EXIT, SL, TP, R, P/L($), SWAP, COMMISSION, NET%, TF, CHART BEFORE, CHART AFTER, empty]
//   Row 14+: Trade data rows
//   Col T (index 19): Balance after trade

export interface Trade {
  idx: number;
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
  tf: string;
  chart_before: string;
  chart_after: string;
  balance_before: number;
  balance_after: number;
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
// Handles the exact TITANS Excel structure:
// - Header row detection (looks for 'DAY' or 'SYMBOL' in first 20 rows)
// - Columns: DAY(B), OPEN(C), CLOSE(D), SYMBOL(E), SIDE(F), LOTS(G), ENTRY(H), EXIT(I),
//            SL(J), TP(K), R(L), P/L($)(M), SWAP(N), COMMISSION(O), NET%(P), TF(Q),
//            CHART BEFORE(R), CHART AFTER(S), BALANCE AFTER(T)
// - Starting balance from KPI row (row 8, col B)

declare global {
  interface Window {
    XLSX: any;
  }
}

const parseNum = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = v.toString().replace(/[$,%\s]/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};

const parseDir = (v: any): 'BUY' | 'SELL' => {
  const s = (v || '').toString().toUpperCase().trim();
  if (s.includes('BUY') || s === 'B' || s === 'LONG') return 'BUY';
  return 'SELL';
};

const parseDateCell = (v: any): string => {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') {
    // Try to parse various date formats
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString();
    return v;
  }
  if (typeof v === 'number') {
    // Excel serial date
    const d = new Date((v - 25569) * 86400 * 1000);
    return d.toISOString();
  }
  return String(v);
};

export function parseExcelToTradingData(file: File): Promise<TradingData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = window.XLSX.read(data, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];

        // Convert to array of arrays (raw values)
        const rows: any[][] = window.XLSX.utils.sheet_to_json(ws, {
          header: 1,
          raw: false,
          dateNF: 'yyyy-mm-dd hh:mm:ss',
          defval: null,
        });

        // Also get raw rows for numbers
        const rawRows: any[][] = window.XLSX.utils.sheet_to_json(ws, {
          header: 1,
          raw: true,
          defval: null,
        });

        // ===== FIND HEADER ROW =====
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 25); i++) {
          const r = rows[i];
          if (!r) continue;
          // Look for 'DAY' or 'SYMBOL' or 'SIDE' in the row
          const hasDay = r.some((c: any) => typeof c === 'string' && c.toString().toUpperCase().trim() === 'DAY');
          const hasSym = r.some((c: any) => typeof c === 'string' && c.toString().toUpperCase().trim() === 'SYMBOL');
          if (hasDay || hasSym) {
            headerRowIdx = i;
            break;
          }
        }

        if (headerRowIdx === -1) {
          reject(new Error('Δεν βρέθηκε η γραμμή headers στο Excel. Βεβαιώσου ότι το αρχείο έχει τη σωστή μορφή.'));
          return;
        }

        const headers = rows[headerRowIdx].map((h: any) =>
          (h || '').toString().toUpperCase().trim()
        );

        // Map column names to indices
        const colIdx = (names: string[]): number => {
          for (const name of names) {
            const idx = headers.findIndex((h: string) => h === name || h.includes(name));
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const dayCol = colIdx(['DAY', 'ΗΜΕΡΑ', 'ΗΜΈΡΑ']);
        const openCol = colIdx(['OPEN', 'OPEN TIME', 'ENTRY TIME', 'DATE OPEN']);
        const closeCol = colIdx(['CLOSE', 'CLOSE TIME', 'EXIT TIME', 'DATE CLOSE']);
        const symbolCol = colIdx(['SYMBOL', 'PAIR', 'INSTRUMENT']);
        const sideCol = colIdx(['SIDE', 'DIRECTION', 'TYPE', 'BUY/SELL']);
        const lotsCol = colIdx(['LOTS', 'VOLUME', 'SIZE', 'QTY']);
        const entryCol = colIdx(['ENTRY', 'OPEN PRICE', 'PRICE OPEN']);
        const exitCol = colIdx(['EXIT', 'CLOSE PRICE', 'PRICE CLOSE', 'EXIT PRICE']);
        const slCol = colIdx(['SL', 'STOP LOSS', 'STOPLOSS', 'S/L']);
        const tpCol = colIdx(['TP', 'TAKE PROFIT', 'TAKEPROFIT', 'T/P']);
        const rCol = colIdx(['R', 'TRADE R', 'R-MULTIPLE', 'R VALUE']);
        const pnlCol = colIdx(['P/L ($)', 'P/L', 'PROFIT', 'PNL', 'NET PROFIT', 'GAIN/LOSS', 'RESULT']);
        const swapCol = colIdx(['SWAP', 'ROLLOVER']);
        const commCol = colIdx(['COMMISSION', 'COMM', 'FEE']);
        const netPctCol = colIdx(['NET %', 'NET%', 'RETURN %', 'RETURN%', '% RETURN']);
        const tfCol = colIdx(['TF', 'TIMEFRAME', 'TIME FRAME']);
        const chartBeforeCol = colIdx(['CHART BEFORE', 'BEFORE', 'CHART_BEFORE']);
        const chartAfterCol = colIdx(['CHART AFTER', 'AFTER', 'CHART_AFTER']);

        // Balance after is usually the LAST column (col T in TITANS = index 19)
        // Try to find it, or use the last column
        let balanceAfterCol = headers.length; // default to last col
        // Check if last non-null column in header row has a value
        for (let c = headers.length - 1; c >= 0; c--) {
          if (rawRows[headerRowIdx + 1] && rawRows[headerRowIdx + 1][c] !== null && rawRows[headerRowIdx + 1][c] !== undefined) {
            // Check if it looks like a balance (large number > 1000)
            const v = parseNum(rawRows[headerRowIdx + 1][c]);
            if (v !== null && v > 1000) {
              balanceAfterCol = c;
              break;
            }
          }
        }

        // ===== FIND STARTING BALANCE =====
        // Look in rows before header for a large number that could be starting balance
        let startingBalance = 0;
        for (let i = 0; i < headerRowIdx; i++) {
          const r = rawRows[i];
          if (!r) continue;
          for (let c = 0; c < r.length; c++) {
            const v = parseNum(r[c]);
            if (v !== null && v > 10000 && v < 100000000) {
              // Check if nearby cell has "STARTING" or "BALANCE" label
              const rowStr = rows[i].map((x: any) => (x || '').toString().toUpperCase()).join(' ');
              if (rowStr.includes('START') || rowStr.includes('BALANCE') || rowStr.includes('ΑΡΧΙΚ')) {
                startingBalance = v;
                break;
              }
            }
          }
          if (startingBalance > 0) break;
        }

        // ===== PARSE TRADES =====
        const trades: Trade[] = [];
        let runningBalance = startingBalance;

        for (let i = headerRowIdx + 1; i < rows.length; i++) {
          const r = rows[i];
          const rr = rawRows[i];
          if (!r || !rr) continue;

          // Skip empty rows
          const sym = symbolCol >= 0 ? (r[symbolCol] || '').toString().trim() : '';
          if (!sym || sym.toUpperCase() === 'SYMBOL' || sym.toUpperCase() === 'TOTAL') continue;

          // Skip rows that look like summaries (no valid symbol)
          if (sym.length > 15) continue;

          const pnl = parseNum(rr[pnlCol]) ?? 0;
          const balAfter = parseNum(rr[balanceAfterCol]);
          const prevBalance = runningBalance;

          if (balAfter !== null && balAfter > 1000) {
            runningBalance = balAfter;
          } else {
            runningBalance += pnl + (parseNum(rr[swapCol]) ?? 0);
          }

          // Parse dates — use formatted string rows for display
          const openStr = openCol >= 0 ? parseDateCell(rr[openCol] || r[openCol]) : '';
          const closeStr = closeCol >= 0 ? parseDateCell(rr[closeCol] || r[closeCol]) : '';

          trades.push({
            idx: trades.length + 1,
            day: dayCol >= 0 ? (r[dayCol] || '').toString().toUpperCase().trim() : '',
            open: openStr,
            close_time: closeStr,
            symbol: sym.toUpperCase(),
            direction: sideCol >= 0 ? parseDir(r[sideCol]) : 'BUY',
            lots: parseNum(rr[lotsCol]) ?? 0,
            entry: parseNum(rr[entryCol]) ?? 0,
            close: parseNum(rr[exitCol]) ?? 0,
            sl: parseNum(rr[slCol]),
            tp: parseNum(rr[tpCol]),
            trade_r: parseNum(rr[rCol]),
            pnl,
            swap: parseNum(rr[swapCol]) ?? 0,
            commission: parseNum(rr[commCol]) ?? 0,
            net_pct: parseNum(rr[netPctCol]) ?? 0,
            tf: tfCol >= 0 ? (r[tfCol] || '').toString().trim() : '',
            chart_before: chartBeforeCol >= 0 ? (r[chartBeforeCol] || '').toString().trim() : '',
            chart_after: chartAfterCol >= 0 ? (r[chartAfterCol] || '').toString().trim() : '',
            balance_before: prevBalance,
            balance_after: runningBalance,
          });
        }

        if (trades.length === 0) {
          reject(new Error('Δεν βρέθηκαν trades στο Excel. Βεβαιώσου ότι το αρχείο έχει τη σωστή μορφή.'));
          return;
        }

        // If starting balance not found, derive from first trade
        if (startingBalance === 0 && trades.length > 0) {
          startingBalance = trades[0].balance_after - trades[0].pnl - trades[0].swap;
          // Update balance_before for first trade
          trades[0].balance_before = startingBalance;
        }

        resolve(computeKPIs(trades, startingBalance));
      } catch (err: any) {
        reject(new Error('Σφάλμα κατά την ανάγνωση: ' + (err?.message || String(err))));
      }
    };
    reader.onerror = () => reject(new Error('Αδυναμία ανάγνωσης αρχείου'));
    reader.readAsBinaryString(file);
  });
}

export function computeKPIs(trades: Trade[], startingBalanceOverride?: number): TradingData {
  const now = new Date();
  const monthNames = [
    'ΙΑΝΟΥΑΡΙΟΣ', 'ΦΕΒΡΟΥΑΡΙΟΣ', 'ΜΑΡΤΙΟΣ', 'ΑΠΡΙΛΙΟΣ', 'ΜΑΙΟΣ', 'ΙΟΥΝΙΟΣ',
    'ΙΟΥΛΙΟΣ', 'ΑΥΓΟΥΣΤΟΣ', 'ΣΕΠΤΕΜΒΡΙΟΣ', 'ΟΚΤΩΒΡΙΟΣ', 'ΝΟΕΜΒΡΙΟΣ', 'ΔΕΚΕΜΒΡΙΟΣ',
  ];

  const starting = startingBalanceOverride ?? (trades.length > 0 ? trades[0].balance_before : 0);
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
    const dd = peak > 0 ? (peak - t.balance_after) / peak : 0;
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

  // Try to detect month from trades
  let monthIdx = now.getMonth();
  let yearFull = now.getFullYear().toString();
  if (trades.length > 0 && trades[0].open) {
    const d = new Date(trades[0].open);
    if (!isNaN(d.getTime())) {
      monthIdx = d.getMonth();
      yearFull = d.getFullYear().toString();
    }
  }

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
      month_name: monthNames[monthIdx],
      year_short: yearFull.slice(2),
      year_full: yearFull,
      subtitle: 'INNER CIRCLE · PRIVATE ACCOUNT',
      last_sync,
    },
  };
}
