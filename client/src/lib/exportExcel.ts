// exportExcel.ts — Export TradingData back to Ultimate Trading Journal Excel format
//
// Reproduces the user's "ΑΠΡΙΛΙΟΣ" template structure exactly:
//   Row 2  → Title (merged B2:S2)
//   Row 4  → Account name (B4:F4) + Last sync (L4:S4)
//   Row 7  → KPI labels (6 cards)
//   Row 8  → KPI values
//   Row 9  → KPI sublabels
//   Row 12 → "TRADE LOG" header + executions counter
//   Row 13 → Column headers (DAY..CHART AFTER)
//   Row 14+ trade rows with live formulas (R, NET %, running balance T)
//   Row 42 → "PERFORMANCE ANALYTICS" header
//   Row 44-49 → 6 left + 6 right metric cards
//
// Uses ExcelJS for formulas, merges, styling, and number-formats — none of
// which are supported by the SheetJS community build.

import ExcelJS from 'exceljs';
import type { TradingData, Trade } from './trading';

// ===== PALETTE (mirrors the template) =====
const C_INK = 'FF0F2A4D';        // primary ink
const C_INK_SOFT = 'FF5F7A99';   // muted secondary text
const C_INK_GHOST = 'FF9AB0C7';  // tertiary text
const C_OCEAN = 'FF0077B6';      // accent blue
const C_PROFIT = 'FF00897B';     // teal
const C_LOSS = 'FFE94F37';       // coral
const BG_PANEL = 'FFF2F6FA';     // outer panel grey
const BG_STRIPE = 'FFE8EFF6';    // alternating row stripe
const BG_WHITE = 'FFFFFFFF';
const BG_BUY = 'FFD4EDE9';       // BUY pill
const BG_SELL = 'FFFBE0D9';      // SELL pill

// ===== NUMBER FORMATS =====
const FMT_USD0 = '"$"#,##0';
const FMT_USD2 = '"$"#,##0.00;"-$"#,##0.00;"$"0.00';
const FMT_PCT2_SIGNED = '"+"0.00%;"-"0.00%;0.00%';
const FMT_PCT_FULL = '0.0%';
const FMT_PRICE5 = '0.00000';
const FMT_LOTS = '0.0#';
const FMT_R = '"+"0.00"R";"-"0.00"R";0.00"R"';
const FMT_DT = 'dd"."mm"  "hh:mm';

// ===== GREEK DAY NAMES (Sun..Sat indexing matches Date.prototype.getDay) =====
const GREEK_DAYS = ['ΚΥΡ', 'ΔΕΥ', 'ΤΡΙ', 'ΤΕΤ', 'ΠΕΜ', 'ΠΑΡ', 'ΣΑΒ'];

function greekDay(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return GREEK_DAYS[d.getDay()];
}

function toDate(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function fmtSyncStamp(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Trigger browser download from a buffer
function triggerDownload(buf: ArrayBuffer, filename: string) {
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ===== BUFFER BUILDER (used by both exportToExcel and tests) =====
export async function buildExcelBuffer(data: TradingData): Promise<ArrayBuffer> {
  return await _buildWorkbookBuffer(data);
}

// ===== MAIN ENTRY =====
// When `accountName` is provided, it is sanitized and embedded into the filename
// so multi-account users can tell exports apart at a glance. Falls back to the
// pre-multi-account filename when no account name is given.
export async function exportToExcel(
  data: TradingData,
  accountName?: string,
): Promise<void> {
  const buf = await _buildWorkbookBuffer(data);
  const filename = buildExportFilename(data, accountName);
  triggerDownload(buf, filename);
}

export function buildExportFilename(
  data: TradingData,
  accountName?: string,
): string {
  const slug = sanitizeAccountSlug(accountName);
  const account = slug ? `${slug}_` : '';
  return `UltimateTradingJournal_${account}${data.meta.month_name}_${data.meta.year_full}.xlsx`;
}

function sanitizeAccountSlug(name: string | undefined): string {
  if (!name) return '';
  // Keep ASCII letters/digits, collapse everything else to a single `-`.
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

async function _buildWorkbookBuffer(data: TradingData): Promise<ArrayBuffer> {
  const { trades, kpis, meta } = data;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ultimate Trading Journal';
  wb.created = new Date();

  const ws = wb.addWorksheet('Journal', {
    views: [{ showGridLines: false, state: 'frozen', xSplit: 0, ySplit: 13 }],
  });

  // ===== COLUMN WIDTHS (from template) =====
  const widths: Record<string, number> = {
    A: 3, B: 14, C: 17, D: 17, E: 11, F: 8, G: 6, H: 11, I: 11, J: 11,
    K: 11, L: 9, M: 13, N: 11, O: 12, P: 10, Q: 7, R: 40, S: 40, T: 3,
  };
  Object.entries(widths).forEach(([col, w]) => {
    ws.getColumn(col).width = w;
  });

  // ===== ROW HEIGHTS (top section) =====
  ws.getRow(1).height = 9.75;
  ws.getRow(2).height = 48;
  ws.getRow(3).height = 6;
  ws.getRow(4).height = 21.75;
  ws.getRow(5).height = 9.75;
  ws.getRow(6).height = 3.75;
  ws.getRow(7).height = 13.5;
  ws.getRow(8).height = 27.75;
  ws.getRow(9).height = 13.5;
  ws.getRow(10).height = 3.75;
  ws.getRow(11).height = 18;
  ws.getRow(12).height = 30;
  ws.getRow(13).height = 31.5;

  // ===== ROW 2 — TITLE =====
  ws.mergeCells('B2:S2');
  const titleCell = ws.getCell('B2');
  titleCell.value = `◆  TRADING JOURNAL  ·  ${meta.month_name} ${meta.year_full}`;
  titleCell.font = { name: 'Calibri', size: 22, bold: true, color: { argb: C_INK } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_PANEL } };

  // ===== ROW 4 — ACCOUNT + LAST SYNC =====
  ws.mergeCells('B4:F4');
  const accCell = ws.getCell('B4');
  accCell.value = (meta.subtitle || 'INNER CIRCLE  ·  PRIVATE ACCOUNT').toUpperCase();
  accCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: C_INK_SOFT } };
  accCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  accCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_PANEL } };

  ws.mergeCells('L4:S4');
  const syncCell = ws.getCell('L4');
  const syncDate = meta.last_sync ? new Date(meta.last_sync) : new Date();
  syncCell.value = `LAST SYNC  ·  ${fmtSyncStamp(syncDate)}`;
  syncCell.font = { name: 'Calibri', size: 9, color: { argb: C_INK_SOFT } };
  syncCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
  syncCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_PANEL } };

  // ===== KPI CARDS (rows 7-9) =====
  type Card = {
    labelMerge: string;
    valueMerge: string;
    subMerge: string;
    label: string;
    value: number | { formula: string };
    valueFmt: string;
    sub: string | { formula: string };
    valueColor?: string;
  };

  const kpiCards: Card[] = [
    {
      labelMerge: 'B7:D7', valueMerge: 'B8:D8', subMerge: 'B9:D9',
      label: '◉  STARTING BALANCE',
      value: kpis.starting,
      valueFmt: FMT_USD0,
      sub: 'Account base · USD',
    },
    {
      labelMerge: 'E7:G7', valueMerge: 'E8:G8', subMerge: 'E9:G9',
      label: '▲  NET P/L',
      value: { formula: 'T40-$B$8' },
      valueFmt: FMT_USD2,
      sub: { formula: 'TEXT((T40-$B$8)/$B$8,"+0.00%;-0.00%")&"  of starting"' },
    },
    {
      labelMerge: 'H7:J7', valueMerge: 'H8:J8', subMerge: 'H9:J9',
      label: '◈  WIN RATE',
      value: { formula: 'IFERROR(COUNTIF(M14:M40,">0")/COUNTA(M14:M40),0)' },
      valueFmt: FMT_PCT_FULL,
      sub: { formula: 'COUNTIF(M14:M40,">0")&"W  /  "&COUNTIF(M14:M40,"<0")&"L"' },
    },
    {
      labelMerge: 'K7:L7', valueMerge: 'K8:L8', subMerge: 'K9:L9',
      label: '■  TRADES',
      value: { formula: 'COUNTA(E14:E40)' },
      valueFmt: '0',
      sub: 'Executed · closed',
    },
    {
      labelMerge: 'M7:O7', valueMerge: 'M8:O8', subMerge: 'M9:O9',
      label: '★  BEST TRADE',
      value: { formula: 'MAX(M14:M40)' },
      valueFmt: FMT_USD2,
      sub: { formula: 'IFERROR(INDEX(E14:E40,MATCH(MAX(M14:M40),M14:M40,0))&"  ·  best win","")' },
    },
    {
      labelMerge: 'P7:S7', valueMerge: 'P8:S8', subMerge: 'P9:S9',
      label: '⚙  RISK TARGET',
      value: 0.01,
      valueFmt: FMT_PCT_FULL,
      sub: 'per trade',
      valueColor: C_OCEAN,
    },
  ];

  for (const card of kpiCards) {
    // Label
    ws.mergeCells(card.labelMerge);
    const lc = ws.getCell(card.labelMerge.split(':')[0]);
    lc.value = card.label;
    lc.font = { name: 'Calibri', size: 8, bold: true, color: { argb: C_INK_SOFT } };
    lc.alignment = { vertical: 'middle', horizontal: 'center' };
    lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_WHITE } };

    // Value
    ws.mergeCells(card.valueMerge);
    const vc = ws.getCell(card.valueMerge.split(':')[0]);
    if (typeof card.value === 'object' && 'formula' in card.value) {
      vc.value = { formula: card.value.formula } as ExcelJS.CellFormulaValue;
    } else {
      vc.value = card.value;
    }
    vc.numFmt = card.valueFmt;
    vc.font = { name: 'Calibri', size: 18, bold: true, color: { argb: card.valueColor || C_INK } };
    vc.alignment = { vertical: 'middle', horizontal: 'center' };
    vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_WHITE } };

    // Sub
    ws.mergeCells(card.subMerge);
    const sc = ws.getCell(card.subMerge.split(':')[0]);
    if (typeof card.sub === 'object' && 'formula' in card.sub) {
      sc.value = { formula: card.sub.formula } as ExcelJS.CellFormulaValue;
    } else {
      sc.value = card.sub;
    }
    sc.font = { name: 'Calibri', size: 9, color: { argb: C_INK_GHOST } };
    sc.alignment = { vertical: 'middle', horizontal: 'center' };
    sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_WHITE } };
  }

  // ===== ROW 12 — TRADE LOG SECTION HEADER =====
  ws.mergeCells('B12:H12');
  const tlHeader = ws.getCell('B12');
  tlHeader.value = '━━  TRADE LOG';
  tlHeader.font = { name: 'Calibri', size: 11, bold: true, color: { argb: C_INK } };
  tlHeader.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  tlHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_PANEL } };

  ws.mergeCells('P12:S12');
  const tlCount = ws.getCell('P12');
  tlCount.value = { formula: '"◆  "&COUNTA(E14:E40)&"  EXECUTIONS"' } as ExcelJS.CellFormulaValue;
  tlCount.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C_OCEAN } };
  tlCount.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
  tlCount.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_PANEL } };

  // ===== ROW 13 — COLUMN HEADERS =====
  const headers = [
    'DAY', 'OPEN', 'CLOSE', 'SYMBOL', 'SIDE', 'LOTS', 'ENTRY', 'EXIT',
    'SL', 'TP', 'R', 'P/L ($)', 'SWAP', 'COMMISSION', 'NET %', 'TF',
    'CHART BEFORE', 'CHART AFTER',
  ];
  headers.forEach((h, i) => {
    const col = String.fromCharCode('B'.charCodeAt(0) + i); // B..S
    const cell = ws.getCell(`${col}13`);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: BG_WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_INK } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // ===== TRADE ROWS (rows 14..40, capped to 27 trades like template) =====
  const TRADE_START = 14;
  const TRADE_END = 40;
  const visibleTrades: Trade[] = trades.slice(0, TRADE_END - TRADE_START + 1);

  for (let i = 0; i < TRADE_END - TRADE_START + 1; i++) {
    const r = TRADE_START + i;
    const t = visibleTrades[i];
    const stripe = i % 2 === 1;
    const rowFill = stripe ? BG_STRIPE : BG_WHITE;
    ws.getRow(r).height = 25.5;

    // Paint row background even on empty rows
    ['B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S'].forEach(col => {
      ws.getCell(`${col}${r}`).fill = {
        type: 'pattern', pattern: 'solid', fgColor: { argb: rowFill },
      };
    });

    // T column running-balance formula always present (so analytics keep working)
    const tCell = ws.getCell(`T${r}`);
    tCell.value = r === TRADE_START
      ? ({ formula: `$B$8+M${r}+N${r}+O${r}` } as ExcelJS.CellFormulaValue)
      : ({ formula: `T${r - 1}+M${r}+N${r}+O${r}` } as ExcelJS.CellFormulaValue);
    tCell.numFmt = FMT_USD2;
    tCell.font = { name: 'Calibri', size: 11, color: { argb: C_INK } };
    tCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_PANEL } };
    tCell.alignment = { vertical: 'middle', horizontal: 'center' };

    if (!t) continue;

    const isBuy = t.direction === 'BUY';
    const pnl = Number(t.pnl) || 0;
    const pnlColor = pnl >= 0 ? C_PROFIT : C_LOSS;

    // B — DAY
    const bC = ws.getCell(`B${r}`);
    bC.value = greekDay(t.open);
    bC.font = { name: 'Calibri', size: 9, bold: true, color: { argb: C_INK_SOFT } };
    bC.alignment = { vertical: 'middle', horizontal: 'center' };

    // C — OPEN
    const cC = ws.getCell(`C${r}`);
    const openD = toDate(t.open);
    if (openD) cC.value = openD;
    cC.numFmt = FMT_DT;
    cC.font = { name: 'Calibri', size: 10, color: { argb: C_INK_SOFT } };
    cC.alignment = { vertical: 'middle', horizontal: 'center' };

    // D — CLOSE
    const dC = ws.getCell(`D${r}`);
    const closeD = toDate(t.close_time);
    if (closeD) dC.value = closeD;
    dC.numFmt = FMT_DT;
    dC.font = { name: 'Calibri', size: 10, color: { argb: C_INK_SOFT } };
    dC.alignment = { vertical: 'middle', horizontal: 'center' };

    // E — SYMBOL
    const eC = ws.getCell(`E${r}`);
    eC.value = t.symbol;
    eC.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C_INK } };
    eC.alignment = { vertical: 'middle', horizontal: 'center' };

    // F — SIDE
    const fC = ws.getCell(`F${r}`);
    fC.value = t.direction;
    fC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isBuy ? BG_BUY : BG_SELL } };
    fC.font = { name: 'Calibri', size: 9, bold: true, color: { argb: isBuy ? C_PROFIT : C_LOSS } };
    fC.alignment = { vertical: 'middle', horizontal: 'center' };

    // G — LOTS
    const gC = ws.getCell(`G${r}`);
    gC.value = t.lots;
    gC.numFmt = FMT_LOTS;
    gC.font = { name: 'Calibri', size: 10, color: { argb: C_INK } };
    gC.alignment = { vertical: 'middle', horizontal: 'center' };

    // H — ENTRY
    const hC = ws.getCell(`H${r}`);
    hC.value = t.entry;
    hC.numFmt = FMT_PRICE5;
    hC.font = { name: 'Calibri', size: 10, color: { argb: C_INK } };
    hC.alignment = { vertical: 'middle', horizontal: 'center' };

    // I — EXIT
    const iC = ws.getCell(`I${r}`);
    iC.value = t.close;
    iC.numFmt = FMT_PRICE5;
    iC.font = { name: 'Calibri', size: 10, color: { argb: C_INK } };
    iC.alignment = { vertical: 'middle', horizontal: 'center' };

    // J — SL
    const jC = ws.getCell(`J${r}`);
    if (t.sl != null) jC.value = t.sl;
    jC.numFmt = FMT_PRICE5;
    jC.font = { name: 'Calibri', size: 10, color: { argb: C_LOSS } };
    jC.alignment = { vertical: 'middle', horizontal: 'center' };

    // K — TP
    const kC = ws.getCell(`K${r}`);
    if (t.tp != null) kC.value = t.tp;
    kC.numFmt = FMT_PRICE5;
    kC.font = { name: 'Calibri', size: 10, color: { argb: C_PROFIT } };
    kC.alignment = { vertical: 'middle', horizontal: 'center' };

    // L — R (formula)
    const lC = ws.getCell(`L${r}`);
    lC.value = {
      formula: `IF(OR(H${r}="",I${r}="",J${r}=""),"",IF(F${r}="BUY",IF(J${r}>=H${r},"SL!",(I${r}-H${r})/(H${r}-J${r})),IF(F${r}="SELL",IF(J${r}<=H${r},"SL!",(H${r}-I${r})/(J${r}-H${r})),"")))`,
    } as ExcelJS.CellFormulaValue;
    lC.numFmt = FMT_R;
    lC.font = { name: 'Calibri', size: 10, bold: true, color: { argb: pnlColor } };
    lC.alignment = { vertical: 'middle', horizontal: 'center' };

    // M — P/L ($)
    const mC = ws.getCell(`M${r}`);
    mC.value = pnl;
    mC.numFmt = FMT_USD2;
    mC.font = { name: 'Calibri', size: 10, bold: true, color: { argb: pnlColor } };
    mC.alignment = { vertical: 'middle', horizontal: 'center' };

    // N — SWAP
    const nC = ws.getCell(`N${r}`);
    const swap = Number(t.swap) || 0;
    nC.value = swap;
    nC.numFmt = FMT_USD2;
    nC.font = {
      name: 'Calibri', size: 10,
      color: { argb: swap > 0 ? C_PROFIT : swap < 0 ? C_LOSS : C_INK_SOFT },
    };
    nC.alignment = { vertical: 'middle', horizontal: 'center' };

    // O — COMMISSION
    const oC = ws.getCell(`O${r}`);
    oC.value = Number(t.commission) || 0;
    oC.numFmt = FMT_USD2;
    oC.font = { name: 'Calibri', size: 10, color: { argb: C_INK_SOFT } };
    oC.alignment = { vertical: 'middle', horizontal: 'center' };

    // P — NET % (formula referencing previous T row, or $B$8 for first)
    const pC = ws.getCell(`P${r}`);
    const denom = r === TRADE_START ? '$B$8' : `T${r - 1}`;
    pC.value = { formula: `IFERROR((M${r}+N${r}+O${r})/${denom},"")` } as ExcelJS.CellFormulaValue;
    pC.numFmt = FMT_PCT2_SIGNED;
    pC.font = { name: 'Calibri', size: 10, bold: true, color: { argb: pnlColor } };
    pC.alignment = { vertical: 'middle', horizontal: 'center' };

    // Q — TF
    const qC = ws.getCell(`Q${r}`);
    qC.value = t.tf || '';
    qC.font = { name: 'Calibri', size: 8, color: { argb: C_INK_GHOST } };
    qC.alignment = { vertical: 'middle', horizontal: 'center' };

    // R — CHART BEFORE
    const rC = ws.getCell(`R${r}`);
    if (t.chart_before) {
      rC.value = { text: t.chart_before, hyperlink: t.chart_before } as ExcelJS.CellHyperlinkValue;
    }
    rC.font = { name: 'Calibri', size: 9, color: { argb: C_OCEAN } };
    rC.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // S — CHART AFTER
    const sC = ws.getCell(`S${r}`);
    if (t.chart_after) {
      sC.value = { text: t.chart_after, hyperlink: t.chart_after } as ExcelJS.CellHyperlinkValue;
    }
    sC.font = { name: 'Calibri', size: 9, color: { argb: C_OCEAN } };
    sC.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  }

  // ===== ROW 42 — PERFORMANCE ANALYTICS HEADER =====
  ws.getRow(41).height = 19.5;
  ws.getRow(42).height = 30;
  ws.mergeCells('B42:S42');
  const paHeader = ws.getCell('B42');
  paHeader.value = '━━  PERFORMANCE ANALYTICS';
  paHeader.font = { name: 'Calibri', size: 11, bold: true, color: { argb: C_INK } };
  paHeader.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  paHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_PANEL } };
  ws.getRow(43).height = 7.5;

  // ===== ROWS 44-49 — METRIC PAIRS =====
  type Metric = {
    row: number;
    leftLabelMerge: string; leftValMerge: string; leftLabel: string;
    leftFormula: string; leftFmt: string;
    rightLabelMerge: string; rightValMerge: string; rightLabel: string;
    rightFormula: string; rightFmt: string;
  };

  const metrics: Metric[] = [
    {
      row: 44,
      leftLabelMerge: 'B44:D44', leftValMerge: 'E44:G44',
      leftLabel: 'TOTAL P/L (BROKER)', leftFormula: 'SUM(M14:M40)', leftFmt: FMT_USD2,
      rightLabelMerge: 'I44:L44', rightValMerge: 'M44:O44',
      rightLabel: 'AVG WIN', rightFormula: 'IFERROR(AVERAGEIF(M14:M40,">0"),0)', rightFmt: FMT_USD2,
    },
    {
      row: 45,
      leftLabelMerge: 'B45:D45', leftValMerge: 'E45:G45',
      leftLabel: 'TOTAL SWAP', leftFormula: 'SUM(N14:N40)', leftFmt: FMT_USD2,
      rightLabelMerge: 'I45:L45', rightValMerge: 'M45:O45',
      rightLabel: 'AVG LOSS', rightFormula: 'IFERROR(AVERAGEIF(M14:M40,"<0"),0)', rightFmt: FMT_USD2,
    },
    {
      row: 46,
      leftLabelMerge: 'B46:D46', leftValMerge: 'E46:G46',
      leftLabel: 'TOTAL COMMISSION', leftFormula: 'SUM(O14:O40)', leftFmt: FMT_USD2,
      rightLabelMerge: 'I46:L46', rightValMerge: 'M46:O46',
      rightLabel: 'AVG % WIN', rightFormula: 'IFERROR(AVERAGEIF(P14:P40,">0"),0)', rightFmt: FMT_PCT2_SIGNED,
    },
    {
      row: 47,
      leftLabelMerge: 'B47:D47', leftValMerge: 'E47:G47',
      leftLabel: 'NET RESULT', leftFormula: 'T40-$B$8', leftFmt: FMT_USD2,
      rightLabelMerge: 'I47:L47', rightValMerge: 'M47:O47',
      rightLabel: 'AVG % LOSS', rightFormula: 'IFERROR(AVERAGEIF(P14:P40,"<0"),0)', rightFmt: FMT_PCT2_SIGNED,
    },
    {
      row: 48,
      leftLabelMerge: 'B48:D48', leftValMerge: 'E48:G48',
      leftLabel: 'RETURN %', leftFormula: '(T40-$B$8)/$B$8', leftFmt: FMT_PCT2_SIGNED,
      rightLabelMerge: 'I48:L48', rightValMerge: 'M48:O48',
      rightLabel: 'PROFIT FACTOR',
      rightFormula: 'IFERROR(SUMIF(M14:M40,">0")/ABS(SUMIF(M14:M40,"<0")),0)', rightFmt: '0.00',
    },
    {
      row: 49,
      leftLabelMerge: 'B49:D49', leftValMerge: 'E49:G49',
      leftLabel: 'ENDING BALANCE', leftFormula: 'T40', leftFmt: FMT_USD2,
      rightLabelMerge: 'I49:L49', rightValMerge: 'M49:O49',
      rightLabel: 'WIN RATE',
      rightFormula: 'IFERROR(COUNTIF(M14:M40,">0")/COUNTA(M14:M40),0)', rightFmt: FMT_PCT_FULL,
    },
  ];

  for (const m of metrics) {
    ws.getRow(m.row).height = 21.75;
    const stripe = m.row % 2 === 1;
    const bg = stripe ? BG_STRIPE : BG_WHITE;

    // Pre-fill the entire row range so spacer columns don't show through
    ['B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S'].forEach(col => {
      ws.getCell(`${col}${m.row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    });

    // Left label
    ws.mergeCells(m.leftLabelMerge);
    const ll = ws.getCell(m.leftLabelMerge.split(':')[0]);
    ll.value = m.leftLabel;
    ll.font = { name: 'Calibri', size: 9, bold: true, color: { argb: C_INK_SOFT } };
    ll.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ll.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

    // Left value
    ws.mergeCells(m.leftValMerge);
    const lv = ws.getCell(m.leftValMerge.split(':')[0]);
    lv.value = { formula: m.leftFormula } as ExcelJS.CellFormulaValue;
    lv.numFmt = m.leftFmt;
    lv.font = { name: 'Calibri', size: 12, bold: true, color: { argb: C_INK } };
    lv.alignment = { vertical: 'middle', horizontal: 'center' };
    lv.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

    // Right label
    ws.mergeCells(m.rightLabelMerge);
    const rl = ws.getCell(m.rightLabelMerge.split(':')[0]);
    rl.value = m.rightLabel;
    rl.font = { name: 'Calibri', size: 9, bold: true, color: { argb: C_INK_SOFT } };
    rl.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    rl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

    // Right value
    ws.mergeCells(m.rightValMerge);
    const rv = ws.getCell(m.rightValMerge.split(':')[0]);
    rv.value = { formula: m.rightFormula } as ExcelJS.CellFormulaValue;
    rv.numFmt = m.rightFmt;
    rv.font = { name: 'Calibri', size: 12, bold: true, color: { argb: C_INK } };
    rv.alignment = { vertical: 'middle', horizontal: 'center' };
    rv.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  }

  // ===== SHEET 2 — NOTES & REFLECTION =====
  const notesWs = wb.addWorksheet('Notes', {
    views: [{ showGridLines: false, state: 'frozen', xSplit: 0, ySplit: 3 }],
  });
  notesWs.getColumn('A').width = 4;
  notesWs.getColumn('B').width = 6;
  notesWs.getColumn('C').width = 12;
  notesWs.getColumn('D').width = 17;
  notesWs.getColumn('E').width = 8;
  notesWs.getColumn('F').width = 50;
  notesWs.getColumn('G').width = 50;
  notesWs.getColumn('H').width = 50;

  notesWs.getRow(1).height = 9;
  notesWs.getRow(2).height = 36;
  notesWs.mergeCells('B2:H2');
  const notesTitle = notesWs.getCell('B2');
  notesTitle.value = `✎  TRADE REFLECTIONS  ·  ${meta.month_name} ${meta.year_full}`;
  notesTitle.font = { name: 'Calibri', size: 16, bold: true, color: { argb: C_INK } };
  notesTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  notesTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_PANEL } };

  notesWs.getRow(3).height = 24;
  const notesHeaders = ['#', 'SYMBOL', 'DATE', 'SIDE', 'PRE-CHECK LIST', 'PSYCHOLOGY', 'LESSONS LEARNED'];
  notesHeaders.forEach((h, i) => {
    const col = String.fromCharCode('B'.charCodeAt(0) + i);
    const c = notesWs.getCell(`${col}3`);
    c.value = h;
    c.font = { name: 'Calibri', size: 9, bold: true, color: { argb: BG_WHITE } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_INK } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  trades.forEach((t, i) => {
    const r = 4 + i;
    const stripe = i % 2 === 1;
    const bg = stripe ? BG_STRIPE : BG_WHITE;
    notesWs.getRow(r).height = 90;

    ['B','C','D','E','F','G','H'].forEach(col => {
      notesWs.getCell(`${col}${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    });

    const idxC = notesWs.getCell(`B${r}`);
    idxC.value = t.idx ?? i + 1;
    idxC.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C_INK_SOFT } };
    idxC.alignment = { vertical: 'top', horizontal: 'center' };

    const symC = notesWs.getCell(`C${r}`);
    symC.value = t.symbol;
    symC.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C_INK } };
    symC.alignment = { vertical: 'top', horizontal: 'center' };

    const dateC = notesWs.getCell(`D${r}`);
    const od = toDate(t.open);
    if (od) dateC.value = od;
    dateC.numFmt = FMT_DT;
    dateC.font = { name: 'Calibri', size: 9, color: { argb: C_INK_SOFT } };
    dateC.alignment = { vertical: 'top', horizontal: 'center' };

    const sideC = notesWs.getCell(`E${r}`);
    sideC.value = t.direction;
    sideC.font = { name: 'Calibri', size: 9, bold: true, color: { argb: t.direction === 'BUY' ? C_PROFIT : C_LOSS } };
    sideC.alignment = { vertical: 'top', horizontal: 'center' };

    const pcC = notesWs.getCell(`F${r}`);
    pcC.value = t.pre_checklist || '';
    pcC.font = { name: 'Calibri', size: 9, color: { argb: C_INK } };
    pcC.alignment = { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 };

    const psC = notesWs.getCell(`G${r}`);
    psC.value = t.psychology || '';
    psC.font = { name: 'Calibri', size: 9, color: { argb: C_INK } };
    psC.alignment = { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 };

    const llC = notesWs.getCell(`H${r}`);
    llC.value = t.lessons_learned || '';
    llC.font = { name: 'Calibri', size: 9, color: { argb: C_INK } };
    llC.alignment = { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 };
  });

  // ===== WRITE & RETURN BUFFER =====
  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}
