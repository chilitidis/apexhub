// exportExcel.ts — Export TradingData back to APEXHUB Excel format
// Uses SheetJS (window.XLSX) which is already loaded in index.html

import { computeRunningBalances, type TradingData } from './trading';

declare global {
  interface Window { XLSX: any; }
}

const MONTH_NAMES_EL: Record<string, string> = {
  'ΙΑΝΟΥΑΡΙΟΣ': 'ΙΑΝΟΥΑΡΙΟΣ', 'ΦΕΒΡΟΥΑΡΙΟΣ': 'ΦΕΒΡΟΥΑΡΙΟΣ', 'ΜΑΡΤΙΟΣ': 'ΜΑΡΤΙΟΣ',
  'ΑΠΡΙΛΙΟΣ': 'ΑΠΡΙΛΙΟΣ', 'ΜΑΙΟΣ': 'ΜΑΙΟΣ', 'ΙΟΥΝΙΟΣ': 'ΙΟΥΝΙΟΣ',
  'ΙΟΥΛΙΟΣ': 'ΙΟΥΛΙΟΣ', 'ΑΥΓΟΥΣΤΟΣ': 'ΑΥΓΟΥΣΤΟΣ', 'ΣΕΠΤΕΜΒΡΙΟΣ': 'ΣΕΠΤΕΜΒΡΙΟΣ',
  'ΟΚΤΩΒΡΙΟΣ': 'ΟΚΤΩΒΡΙΟΣ', 'ΝΟΕΜΒΡΙΟΣ': 'ΝΟΕΜΒΡΙΟΣ', 'ΔΕΚΕΜΒΡΙΟΣ': 'ΔΕΚΕΜΒΡΙΟΣ',
};

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

export function exportToExcel(data: TradingData): void {
  const XLSX = window.XLSX;
  if (!XLSX) { alert('XLSX library not loaded'); return; }

  const { trades, kpis, meta } = data;
  const balances = computeRunningBalances(trades, kpis.starting);

  // Build rows array (row 0 = row 1 in Excel)
  const rows: any[][] = [];

  // Row 1: Title
  rows.push(['APEXHUB TRADING JOURNAL · ' + meta.month_name + ' ' + meta.year_full]);
  rows.push([]); // Row 2 empty
  rows.push([]); // Row 3 empty
  rows.push([]); // Row 4 empty
  rows.push([]); // Row 5 empty
  rows.push([]); // Row 6 empty

  // Row 7: KPI labels
  rows.push([
    '', 'STARTING BALANCE', 'NET P/L', 'WIN RATE', 'TRADES', 'BEST TRADE', 'WORST TRADE'
  ]);

  // Row 8: KPI values
  rows.push([
    '',
    kpis.starting,
    kpis.net_result,
    (kpis.win_rate * 100).toFixed(1) + '%',
    kpis.total_trades,
    kpis.best_trade.pnl,
    kpis.worst_trade.pnl,
  ]);

  rows.push([]); // Row 9
  rows.push([]); // Row 10
  rows.push([]); // Row 11
  rows.push([]); // Row 12

  // Row 13: Headers
  rows.push([
    '#', 'DAY', 'OPEN', 'CLOSE', 'SYMBOL', 'SIDE', 'LOTS',
    'ENTRY', 'EXIT', 'SL', 'TP', 'R', 'P/L ($)', 'SWAP',
    'COMMISSION', 'NET%', 'TF', 'CHART BEFORE', 'CHART AFTER', 'EQUITY'
  ]);

  // Rows 14+: Trade data (EQUITY = running balance after this trade settled)
  trades.forEach((t, i) => {
    rows.push([
      t.idx,
      t.day,
      fmtDate(t.open),
      fmtDate(t.close_time),
      t.symbol,
      t.direction,
      t.lots,
      t.entry,
      t.close,
      t.sl ?? '',
      t.tp ?? '',
      t.trade_r ?? '',
      t.pnl,
      t.swap,
      t.commission,
      t.net_pct ? (t.net_pct * 100).toFixed(4) + '%' : '',
      t.tf,
      t.chart_before,
      t.chart_after,
      balances[i] ?? kpis.starting,
    ]);
  });

  // Summary rows
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const totalSwap = trades.reduce((s, t) => s + t.swap, 0);
  const totalComm = trades.reduce((s, t) => s + t.commission, 0);
  rows.push(['ΤΟΤ', '', '', '', '', '', '', '', '', '', '', '', totalPnl, totalSwap, totalComm, '', '', '', '', '']);
  rows.push(['NET', '', '', '', kpis.net_result, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  rows.push(['RET', '', '', '', (kpis.return_pct * 100).toFixed(2) + '%', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  rows.push(['END', '', '', '', kpis.ending, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 4 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
    { wch: 6 }, { wch: 6 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 6 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
    { wch: 8 }, { wch: 6 }, { wch: 35 }, { wch: 35 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, meta.month_name + ' ' + meta.year_short);

  const filename = `APEXHUB_${meta.month_name}_${meta.year_full}.xlsx`;
  XLSX.writeFile(wb, filename);
}
