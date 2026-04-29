// importExcel.ts — Read an Ultimate Trading Journal (or legacy MT5) workbook back into TradingData.
//
// Designed to round-trip with exportExcel.ts:
//   Sheet 1 ("Journal"):
//     B2  → "◆  TRADING JOURNAL  ·  <ΜΗΝΑΣ> <YYYY>"  (parsed for month + year)
//     B8  → starting balance
//     Row 13 → headers
//     Rows 14..40 → trade data (B=DAY .. S=CHART AFTER)
//   Sheet 2 ("Notes"), optional:
//     Row 4+ → [#, SYMBOL, DATE, SIDE, PRE-CHECK, PSYCHOLOGY, LESSONS]
//
// Also tolerates the older "MT5-style" templates (December 2025) where
// the layout starts at row 8 — those rows are detected heuristically.

import ExcelJS from 'exceljs';
import type { Trade, TradingData } from './trading';
import { computeKPIs } from './trading';

// ---------- helpers ----------

function cellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return '';
  const v = cell.value as unknown;
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[]; hyperlink?: string };
    if (typeof o.text === 'string') return o.text.trim();
    if (Array.isArray(o.richText)) return o.richText.map(r => r.text).join('').trim();
    if (typeof o.result === 'string' || typeof o.result === 'number') return String(o.result).trim();
    if (typeof o.hyperlink === 'string') return o.hyperlink.trim();
  }
  return String(v).trim();
}

function cellNumber(cell: ExcelJS.Cell | undefined): number | null {
  if (!cell) return null;
  const v = cell.value as unknown;
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9.,\-+]/g, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === 'object') {
    const o = v as { result?: unknown };
    if (typeof o.result === 'number') return o.result;
    if (typeof o.result === 'string') {
      const n = parseFloat(o.result);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

function cellDateISO(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return '';
  const v = cell.value as unknown;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'number') {
    // Excel serial date
    const ms = (v - 25569) * 86400 * 1000;
    return new Date(ms).toISOString();
  }
  const s = cellText(cell);
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

// ---------- Greek month → canonical name ----------
// Strip diacritics so "ΑΠΡΙΛΙΟΣ" / "Απρίλιος" / "ΑΠΡΊΛΙΟΣ" all match.
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

const MONTHS_GR = [
  'ΙΑΝΟΥΑΡΙΟΣ', 'ΦΕΒΡΟΥΑΡΙΟΣ', 'ΜΑΡΤΙΟΣ', 'ΑΠΡΙΛΙΟΣ',
  'ΜΑΙΟΣ', 'ΙΟΥΝΙΟΣ', 'ΙΟΥΛΙΟΣ', 'ΑΥΓΟΥΣΤΟΣ',
  'ΣΕΠΤΕΜΒΡΙΟΣ', 'ΟΚΤΩΒΡΙΟΣ', 'ΝΟΕΜΒΡΙΟΣ', 'ΔΕΚΕΜΒΡΙΟΣ',
];

function detectMonthYear(title: string): { monthName: string; yearFull: string } | null {
  const norm = normalize(title);
  // Try to find any Greek month token
  const monthFound = MONTHS_GR.find(m => norm.includes(m));
  if (!monthFound) return null;
  // 4-digit year
  const yearMatch = norm.match(/(20\d{2})/);
  const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
  return { monthName: monthFound, yearFull: year };
}

// ---------- main ----------

export interface ImportResult {
  data: TradingData;
  warnings: string[];
}

export async function importFromExcel(file: File): Promise<ImportResult> {
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const journal = wb.worksheets[0];
  if (!journal) throw new Error('Excel file is empty');

  const warnings: string[] = [];

  // ---- detect template variant by checking row 13 headers ----
  const headerRow13 = (col: string) => normalize(cellText(journal.getCell(`${col}13`)));
  // Detect the canonical Ultimate Trading Journal layout (formerly known as the
  // APEXHUB workbook) by checking the column-13 header signature.
  const looksLikeUltimateLayout =
    headerRow13('B') === 'DAY' || headerRow13('C') === 'OPEN' || headerRow13('E') === 'SYMBOL';

  let tradeStart = 14;
  // Bumped from 40 to 2000 so MT5 statements with hundreds of positions per
  // month round-trip cleanly through this importer.
  let tradeEnd = 2000;
  let monthName = '';
  let yearFull = '';
  let starting = 0;

  if (looksLikeUltimateLayout) {
    const title = cellText(journal.getCell('B2'));
    const detected = detectMonthYear(title);
    if (detected) {
      monthName = detected.monthName;
      yearFull = detected.yearFull;
    } else {
      warnings.push('Δεν βρέθηκε μήνας στον τίτλο (B2) — θα χρησιμοποιηθεί ο τρέχων.');
    }
    starting = cellNumber(journal.getCell('B8')) ?? 0;
  } else {
    // Heuristic for old MT5 templates: trades start at row 8, columns shift.
    tradeStart = 8;
    tradeEnd = 200;
    starting = cellNumber(journal.getCell('B5')) ?? cellNumber(journal.getCell('C5')) ?? 0;
    warnings.push('Άγνωστο template — δοκιμάζω παλιό MT5 layout.');
  }

  if (!monthName) {
    const now = new Date();
    monthName = MONTHS_GR[now.getMonth()];
    yearFull = String(now.getFullYear());
  }

  // ---- read trade rows ----
  // Stop early once we hit a trailing run of empty rows so we don't iterate
  // through the analytics block that lives below the trade log.
  const trades: Trade[] = [];
  let blankStreak = 0;
  for (let r = tradeStart; r <= tradeEnd; r++) {
    const symbol = cellText(journal.getCell(`E${r}`));
    if (!symbol) {
      blankStreak++;
      if (blankStreak >= 5 && trades.length > 0) break;
      continue;
    }
    blankStreak = 0;

    const direction = cellText(journal.getCell(`F${r}`)).toUpperCase();
    if (direction !== 'BUY' && direction !== 'SELL') continue;

    const lots = cellNumber(journal.getCell(`G${r}`)) ?? 0;
    const entry = cellNumber(journal.getCell(`H${r}`)) ?? 0;
    const close = cellNumber(journal.getCell(`I${r}`)) ?? 0;
    const sl = cellNumber(journal.getCell(`J${r}`));
    const tp = cellNumber(journal.getCell(`K${r}`));
    const pnl = cellNumber(journal.getCell(`M${r}`)) ?? 0;
    const swap = cellNumber(journal.getCell(`N${r}`)) ?? 0;
    const commission = cellNumber(journal.getCell(`O${r}`)) ?? 0;
    const tf = cellText(journal.getCell(`Q${r}`));
    const chartBefore = cellText(journal.getCell(`R${r}`));
    const chartAfter = cellText(journal.getCell(`S${r}`));
    const day = cellText(journal.getCell(`B${r}`));
    const open = cellDateISO(journal.getCell(`C${r}`));
    const closeTime = cellDateISO(journal.getCell(`D${r}`));

    trades.push({
      idx: trades.length + 1,
      day,
      open,
      close_time: closeTime,
      symbol,
      direction: direction as 'BUY' | 'SELL',
      lots,
      entry,
      close,
      sl,
      tp,
      trade_r: null,
      pnl,
      swap,
      commission,
      net_pct: starting > 0 ? (pnl + swap + commission) / starting : 0,
      tf,
      chart_before: chartBefore,
      chart_after: chartAfter,
    });
  }

  if (trades.length === 0) {
    warnings.push('Δεν βρέθηκαν trades στο αρχείο.');
  }

  // ---- merge in notes from Sheet 2 if present ----
  const notesWs = wb.getWorksheet('Notes');
  if (notesWs) {
    let r = 4;
    while (r <= 4 + trades.length + 5) {
      const idxRaw = cellNumber(notesWs.getCell(`B${r}`));
      const symbol = cellText(notesWs.getCell(`C${r}`));
      if (!symbol && idxRaw == null) {
        r++;
        continue;
      }
      const preChecklist = cellText(notesWs.getCell(`F${r}`));
      const psychology = cellText(notesWs.getCell(`G${r}`));
      const lessons = cellText(notesWs.getCell(`H${r}`));
      // Match by idx if present, else by sequential row
      const targetIdx = idxRaw ?? r - 3;
      const t = trades.find(tr => tr.idx === targetIdx);
      if (t) {
        if (preChecklist) t.pre_checklist = preChecklist;
        if (psychology) t.psychology = psychology;
        if (lessons) t.lessons_learned = lessons;
      }
      r++;
    }
  }

  // ---- compose TradingData ----
  const data = computeKPIs(trades, starting);
  data.meta = {
    ...data.meta,
    month_name: monthName,
    year_full: yearFull,
    year_short: yearFull.slice(2),
  };

  return { data, warnings };
}
