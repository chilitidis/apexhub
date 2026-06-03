/**
 * positionCalc.ts — pure position-sizing math for the Position Calculator.
 *
 * Core idea (works for every asset class):
 *
 *   moneyRisked = balance * riskPct        (or a fixed amount the user types)
 *   stopDistance = |entry - stopLoss|       (in price units)
 *   valuePerUnitMove = how much money one "unit of position" gains/loses
 *                      when price moves by 1.0 in PRICE units, expressed in
 *                      the QUOTE currency of the instrument.
 *   lossPerLot = stopDistance * valuePerUnitMove * conversionToAccount
 *   lotSize = moneyRisked / lossPerLot
 *
 * The only asset-specific knowledge is `valuePerUnitMove` — i.e. how many
 * units of the base asset one "lot"/"contract" controls. We keep that in the
 * INSTRUMENTS table (contractSize) per category, plus a sensible pip/point
 * definition for display.
 *
 * Offline-first: when the instrument's QUOTE currency differs from the
 * account currency, the caller supplies a manual `conversionRate`
 * (quote → account). For same-currency cases the rate is 1.
 */

export type AssetCategory = "forex" | "indices" | "metals" | "crypto";
export type AccountCurrency = "USD" | "EUR";
export type RiskMode = "percent" | "amount";

export interface InstrumentDef {
  /** Symbol shown to the user, e.g. "EURUSD", "US30", "XAUUSD", "BTCUSD". */
  symbol: string;
  /** Human label, e.g. "Euro / US Dollar", "Dow Jones 30". */
  label: string;
  category: AssetCategory;
  /**
   * Units of the base asset controlled by ONE standard lot / contract.
   *  - Forex: 100,000 (1 standard lot = 100k base units)
   *  - Metals: XAUUSD 100 oz, XAGUSD 5,000 oz (common broker spec)
   *  - Indices: 1 (1 contract = 1 index point per 1.0 move, i.e. $1/point)
   *  - Crypto: 1 (1 lot = 1 coin)
   */
  contractSize: number;
  /** Quote currency (the right side of the pair / the P&L currency). */
  quoteCurrency: string;
  /** Price move that equals "1 pip"/"1 point" — for display + distance. */
  pipSize: number;
  /** Word used in the UI for the smallest step: "pips" or "points". */
  pipLabel: "pips" | "points";
}

/**
 * Built-in instrument catalogue. Not exhaustive of every broker symbol, but
 * covers the major Forex pairs, the main indices, metals and top crypto.
 * Users can also pick "Custom" and type the contract size + pip size by hand.
 */
export const INSTRUMENTS: InstrumentDef[] = [
  // ---- FOREX MAJORS ----
  fx("EURUSD", "Euro / US Dollar", "USD"),
  fx("GBPUSD", "British Pound / US Dollar", "USD"),
  fx("AUDUSD", "Australian Dollar / US Dollar", "USD"),
  fx("NZDUSD", "New Zealand Dollar / US Dollar", "USD"),
  fx("USDJPY", "US Dollar / Japanese Yen", "JPY", true),
  fx("USDCHF", "US Dollar / Swiss Franc", "CHF"),
  fx("USDCAD", "US Dollar / Canadian Dollar", "CAD"),
  // ---- FOREX MINORS / CROSSES ----
  fx("EURGBP", "Euro / British Pound", "GBP"),
  fx("EURJPY", "Euro / Japanese Yen", "JPY", true),
  fx("GBPJPY", "British Pound / Japanese Yen", "JPY", true),
  fx("EURCHF", "Euro / Swiss Franc", "CHF"),
  fx("AUDJPY", "Australian Dollar / Japanese Yen", "JPY", true),
  fx("CADJPY", "Canadian Dollar / Japanese Yen", "JPY", true),
  fx("GBPAUD", "British Pound / Australian Dollar", "AUD"),
  fx("EURAUD", "Euro / Australian Dollar", "AUD"),

  // ---- INDICES (CFD, $1 per index point per contract) ----
  index("US30", "Dow Jones 30 (US30)", "USD"),
  index("US100", "Nasdaq 100 (US100)", "USD"),
  index("US500", "S&P 500 (US500)", "USD"),
  index("GER40", "DAX 40 (GER40)", "EUR"),
  index("UK100", "FTSE 100 (UK100)", "GBP"),
  index("JP225", "Nikkei 225 (JP225)", "JPY"),
  index("US2000", "Russell 2000 (US2000)", "USD"),

  // ---- METALS ----
  metal("XAUUSD", "Gold / US Dollar", 100, "USD", 0.1, "points"),
  metal("XAGUSD", "Silver / US Dollar", 5000, "USD", 0.01, "points"),

  // ---- CRYPTO (1 lot = 1 coin) ----
  crypto("BTCUSD", "Bitcoin / US Dollar", "USD"),
  crypto("ETHUSD", "Ethereum / US Dollar", "USD"),
  crypto("XRPUSD", "Ripple / US Dollar", "USD"),
  crypto("SOLUSD", "Solana / US Dollar", "USD"),
  crypto("LTCUSD", "Litecoin / US Dollar", "USD"),
  crypto("BNBUSD", "BNB / US Dollar", "USD"),
];

function fx(
  symbol: string,
  label: string,
  quote: string,
  isJpy = false,
): InstrumentDef {
  return {
    symbol,
    label,
    category: "forex",
    contractSize: 100_000,
    quoteCurrency: quote,
    // JPY pairs quote to 3 decimals → 1 pip = 0.01; others → 1 pip = 0.0001.
    pipSize: isJpy ? 0.01 : 0.0001,
    pipLabel: "pips",
  };
}

function index(symbol: string, label: string, quote: string): InstrumentDef {
  return {
    symbol,
    label,
    category: "indices",
    contractSize: 1, // $1 (quote) per index point, per contract
    quoteCurrency: quote,
    pipSize: 1,
    pipLabel: "points",
  };
}

function metal(
  symbol: string,
  label: string,
  contractSize: number,
  quote: string,
  pipSize: number,
  pipLabel: "pips" | "points",
): InstrumentDef {
  return { symbol, label, category: "metals", contractSize, quoteCurrency: quote, pipSize, pipLabel };
}

function crypto(symbol: string, label: string, quote: string): InstrumentDef {
  return {
    symbol,
    label,
    category: "crypto",
    contractSize: 1, // 1 lot = 1 coin
    quoteCurrency: quote,
    pipSize: 1,
    pipLabel: "points",
  };
}

export function findInstrument(symbol: string): InstrumentDef | undefined {
  return INSTRUMENTS.find((i) => i.symbol === symbol);
}

export function instrumentsByCategory(cat: AssetCategory): InstrumentDef[] {
  return INSTRUMENTS.filter((i) => i.category === cat);
}

export interface PositionInput {
  balance: number;
  accountCurrency: AccountCurrency;
  riskMode: RiskMode;
  /** When riskMode = "percent": e.g. 1 means 1%. */
  riskPercent: number;
  /** When riskMode = "amount": money to risk in the account currency. */
  riskAmount: number;
  entry: number;
  stopLoss: number;
  /** Units controlled by one lot/contract (from the instrument or custom). */
  contractSize: number;
  /** Quote currency of the instrument (e.g. "USD", "JPY", "EUR"). */
  quoteCurrency: string;
  /** Price move that equals 1 pip/point — used for SL-distance display only. */
  pipSize: number;
  /**
   * Conversion rate from the instrument's QUOTE currency to the ACCOUNT
   * currency (quote → account). 1 when they match. Required (and must be > 0)
   * when they differ.
   */
  conversionRate: number;
}

export interface PositionResult {
  /** Recommended position size in lots/contracts (rounded to 2 dp for display). */
  lotSize: number;
  /** Raw, unrounded lot size (useful for chained calcs). */
  lotSizeRaw: number;
  /** Money risked in the account currency. */
  moneyRisked: number;
  /** Stop distance in raw price units (|entry - stopLoss|). */
  stopDistancePrice: number;
  /** Stop distance expressed in pips/points. */
  stopDistancePips: number;
  /** Loss in the account currency for ONE lot if the stop is hit. */
  lossPerLot: number;
  /** Units of base asset controlled at the recommended size. */
  units: number;
  /** Notional position value in account currency (units * entry * rate). */
  notional: number;
  /** Non-fatal warnings/notes for the UI. */
  warnings: string[];
}

export class PositionCalcError extends Error {}

/**
 * Compute the recommended position size. Throws PositionCalcError on invalid
 * input (missing/zero values, equal entry & stop, etc.) so the UI can show a
 * friendly message.
 */
export function computePosition(input: PositionInput): PositionResult {
  const warnings: string[] = [];

  const balance = num(input.balance, "Balance");
  if (balance <= 0) throw new PositionCalcError("Το balance πρέπει να είναι > 0.");

  const entry = num(input.entry, "Entry");
  const stop = num(input.stopLoss, "Stop loss");
  if (entry <= 0 || stop <= 0)
    throw new PositionCalcError("Entry και Stop Loss πρέπει να είναι > 0.");
  if (entry === stop)
    throw new PositionCalcError("Το Stop Loss δεν μπορεί να είναι ίδιο με το Entry.");

  const contractSize = num(input.contractSize, "Contract size");
  if (contractSize <= 0)
    throw new PositionCalcError("Το contract size πρέπει να είναι > 0.");

  const pipSize = input.pipSize > 0 ? input.pipSize : 1;

  const rate = num(input.conversionRate, "Conversion rate");
  if (rate <= 0)
    throw new PositionCalcError("Η ισοτιμία μετατροπής πρέπει να είναι > 0.");

  // ---- money risked ----
  let moneyRisked: number;
  if (input.riskMode === "percent") {
    const pct = num(input.riskPercent, "Risk %");
    if (pct <= 0) throw new PositionCalcError("Το risk % πρέπει να είναι > 0.");
    if (pct > 100) throw new PositionCalcError("Το risk % δεν μπορεί να ξεπερνά το 100.");
    if (pct > 10) warnings.push("Ρισκάρεις πάνω από 10% του κεφαλαίου — πολύ επιθετικό.");
    moneyRisked = balance * (pct / 100);
  } else {
    const amt = num(input.riskAmount, "Risk amount");
    if (amt <= 0) throw new PositionCalcError("Το ποσό ρίσκου πρέπει να είναι > 0.");
    if (amt > balance) throw new PositionCalcError("Το ποσό ρίσκου δεν μπορεί να ξεπερνά το balance.");
    moneyRisked = amt;
  }

  // ---- stop distance ----
  const stopDistancePrice = Math.abs(entry - stop);
  const stopDistancePips = stopDistancePrice / pipSize;

  // ---- loss per 1 lot, in account currency ----
  // One lot controls `contractSize` units of base asset. A price move of
  // `stopDistancePrice` (in QUOTE currency per base unit) therefore loses
  // contractSize * stopDistancePrice in the QUOTE currency; multiply by the
  // quote→account rate to express it in the account currency.
  const lossPerLot = contractSize * stopDistancePrice * rate;
  if (lossPerLot <= 0)
    throw new PositionCalcError("Αδύνατος υπολογισμός — έλεγξε τις τιμές.");

  const lotSizeRaw = moneyRisked / lossPerLot;
  const lotSize = roundTo(lotSizeRaw, 2);

  if (lotSize <= 0)
    warnings.push("Το προτεινόμενο lot στρογγυλοποιείται σε 0 — αύξησε το ρίσκο ή μείωσε το SL distance.");

  const units = lotSizeRaw * contractSize;
  const notional = units * entry * rate;

  return {
    lotSize,
    lotSizeRaw,
    moneyRisked: roundTo(moneyRisked, 2),
    stopDistancePrice: roundTo(stopDistancePrice, 8),
    stopDistancePips: roundTo(stopDistancePips, 2),
    lossPerLot: roundTo(lossPerLot, 2),
    units: roundTo(units, 4),
    notional: roundTo(notional, 2),
    warnings,
  };
}

function num(v: number, field: string): number {
  if (v == null || Number.isNaN(v) || !Number.isFinite(v))
    throw new PositionCalcError(`Συμπλήρωσε σωστά το πεδίο: ${field}.`);
  return v;
}

export function roundTo(v: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round((v + Number.EPSILON) * f) / f;
}
