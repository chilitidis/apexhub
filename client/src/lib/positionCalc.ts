/**
 * positionCalc.ts — pure position-sizing math for the Position Calculator.
 *
 * Core formula (works for every asset class):
 *
 *   moneyRisked   = balance * riskPct        (or a fixed amount the user types)
 *   stopDistance  = |entry - stopLoss|       (in price units, = QUOTE currency)
 *   lossPerLot    = contractSize * stopDistance * (quote→account rate)
 *   lotSize       = moneyRisked / lossPerLot
 *
 * `contractSize` is the units of base asset controlled by ONE standard lot /
 * contract. The only currency subtlety is converting the loss (which is in the
 * instrument's QUOTE currency) into the account currency.
 *
 * AUTOMATIC CONVERSION (no manual entry needed):
 *   We derive the quote→account rate from the instrument itself + the live
 *   `entry` price whenever possible:
 *     1. quote == account            → rate = 1
 *     2. base  == account            → rate = 1 / entry        (e.g. USDJPY, USD acct)
 *     3. quote == account (direct)   → rate = 1                 (e.g. EURUSD, USD acct)
 *     4. base  == account on a pair  → rate = 1 / entry         (e.g. EURUSD, EUR acct)
 *   When neither the base nor the quote currency is the account currency
 *   (e.g. GBPJPY on a EUR account), we fall back to a built-in static FX table
 *   (USD_RATES / EUR cross) so the user still never has to type a rate.
 */

export type AssetCategory = "forex" | "indices" | "metals" | "crypto";
export type AccountCurrency = "USD" | "EUR";
export type RiskMode = "percent" | "amount";

export interface InstrumentDef {
  symbol: string;
  label: string;
  category: AssetCategory;
  /** Units of base asset controlled by ONE standard lot / contract. */
  contractSize: number;
  /** Base currency (left side of an FX pair). Empty for non-forex. */
  baseCurrency: string;
  /** Quote currency (right side / the P&L currency). */
  quoteCurrency: string;
  /** Price move that equals "1 pip"/"1 point" — for display + distance. */
  pipSize: number;
  pipLabel: "pips" | "points";
}

/* ------------------------------------------------------------------ */
/* Static FX reference table (approximate, units of USD per 1 unit).  */
/* Used only as a fallback when neither leg of the pair is the account*/
/* currency. Values are indicative mid-rates — good enough for sizing.*/
/* ------------------------------------------------------------------ */
export const USD_PER_UNIT: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  JPY: 0.0067,
  CHF: 1.12,
  AUD: 0.66,
  NZD: 0.61,
  CAD: 0.73,
  SGD: 0.74,
  HKD: 0.128,
  SEK: 0.095,
  NOK: 0.094,
  DKK: 0.145,
  PLN: 0.25,
  ZAR: 0.054,
  MXN: 0.058,
  TRY: 0.031,
  CNH: 0.138,
};

/** How many ACCOUNT-currency units 1 unit of `ccy` is worth (via USD table). */
function staticRateToAccount(ccy: string, account: AccountCurrency): number {
  const usdPerCcy = USD_PER_UNIT[ccy];
  const usdPerAccount = USD_PER_UNIT[account];
  if (!usdPerCcy || !usdPerAccount) return 0;
  return usdPerCcy / usdPerAccount; // (USD/ccy) / (USD/account) = account/ccy
}

/* ------------------------------------------------------------------ */
/* Instrument catalogue                                               */
/* ------------------------------------------------------------------ */
function fx(base: string, quote: string, label: string): InstrumentDef {
  const isJpy = quote === "JPY";
  return {
    symbol: `${base}${quote}`,
    label,
    category: "forex",
    contractSize: 100_000,
    baseCurrency: base,
    quoteCurrency: quote,
    pipSize: isJpy ? 0.01 : 0.0001,
    pipLabel: "pips",
  };
}

function index(symbol: string, label: string, quote: string): InstrumentDef {
  return { symbol, label, category: "indices", contractSize: 1, baseCurrency: "", quoteCurrency: quote, pipSize: 1, pipLabel: "points" };
}

function metal(symbol: string, label: string, contractSize: number, quote: string, pipSize: number): InstrumentDef {
  return { symbol, label, category: "metals", contractSize, baseCurrency: symbol.slice(0, 3), quoteCurrency: quote, pipSize, pipLabel: "points" };
}

function crypto(symbol: string, label: string, quote: string): InstrumentDef {
  return { symbol, label, category: "crypto", contractSize: 1, baseCurrency: symbol.replace(quote, ""), quoteCurrency: quote, pipSize: 1, pipLabel: "points" };
}

export const INSTRUMENTS: InstrumentDef[] = [
  // ===== FOREX MAJORS =====
  fx("EUR", "USD", "Euro / US Dollar"),
  fx("GBP", "USD", "British Pound / US Dollar"),
  fx("AUD", "USD", "Australian Dollar / US Dollar"),
  fx("NZD", "USD", "New Zealand Dollar / US Dollar"),
  fx("USD", "JPY", "US Dollar / Japanese Yen"),
  fx("USD", "CHF", "US Dollar / Swiss Franc"),
  fx("USD", "CAD", "US Dollar / Canadian Dollar"),

  // ===== EUR CROSSES =====
  fx("EUR", "GBP", "Euro / British Pound"),
  fx("EUR", "JPY", "Euro / Japanese Yen"),
  fx("EUR", "CHF", "Euro / Swiss Franc"),
  fx("EUR", "AUD", "Euro / Australian Dollar"),
  fx("EUR", "NZD", "Euro / New Zealand Dollar"),
  fx("EUR", "CAD", "Euro / Canadian Dollar"),

  // ===== GBP CROSSES =====
  fx("GBP", "JPY", "British Pound / Japanese Yen"),
  fx("GBP", "CHF", "British Pound / Swiss Franc"),
  fx("GBP", "AUD", "British Pound / Australian Dollar"),
  fx("GBP", "NZD", "British Pound / New Zealand Dollar"),
  fx("GBP", "CAD", "British Pound / Canadian Dollar"),

  // ===== JPY CROSSES =====
  fx("AUD", "JPY", "Australian Dollar / Japanese Yen"),
  fx("NZD", "JPY", "New Zealand Dollar / Japanese Yen"),
  fx("CAD", "JPY", "Canadian Dollar / Japanese Yen"),
  fx("CHF", "JPY", "Swiss Franc / Japanese Yen"),

  // ===== OTHER CROSSES =====
  fx("AUD", "NZD", "Australian Dollar / New Zealand Dollar"),
  fx("AUD", "CAD", "Australian Dollar / Canadian Dollar"),
  fx("AUD", "CHF", "Australian Dollar / Swiss Franc"),
  fx("NZD", "CAD", "New Zealand Dollar / Canadian Dollar"),
  fx("NZD", "CHF", "New Zealand Dollar / Swiss Franc"),
  fx("CAD", "CHF", "Canadian Dollar / Swiss Franc"),

  // ===== EXOTICS =====
  fx("USD", "SGD", "US Dollar / Singapore Dollar"),
  fx("USD", "HKD", "US Dollar / Hong Kong Dollar"),
  fx("USD", "SEK", "US Dollar / Swedish Krona"),
  fx("USD", "NOK", "US Dollar / Norwegian Krone"),
  fx("USD", "DKK", "US Dollar / Danish Krone"),
  fx("USD", "PLN", "US Dollar / Polish Zloty"),
  fx("USD", "ZAR", "US Dollar / South African Rand"),
  fx("USD", "MXN", "US Dollar / Mexican Peso"),
  fx("USD", "TRY", "US Dollar / Turkish Lira"),
  fx("USD", "CNH", "US Dollar / Chinese Yuan (offshore)"),
  fx("EUR", "PLN", "Euro / Polish Zloty"),
  fx("EUR", "SEK", "Euro / Swedish Krona"),
  fx("EUR", "NOK", "Euro / Norwegian Krone"),
  fx("EUR", "TRY", "Euro / Turkish Lira"),

  // ===== INDICES =====
  index("US30", "Dow Jones 30 (US30)", "USD"),
  index("US100", "Nasdaq 100 (US100)", "USD"),
  index("US500", "S&P 500 (US500)", "USD"),
  index("GER40", "DAX 40 (GER40)", "EUR"),
  index("UK100", "FTSE 100 (UK100)", "GBP"),
  index("JP225", "Nikkei 225 (JP225)", "JPY"),
  index("US2000", "Russell 2000 (US2000)", "USD"),
  index("EU50", "Euro Stoxx 50 (EU50)", "EUR"),
  index("FRA40", "CAC 40 (FRA40)", "EUR"),
  index("AUS200", "ASX 200 (AUS200)", "AUD"),

  // ===== METALS =====
  metal("XAUUSD", "Gold / US Dollar", 100, "USD", 0.1),
  metal("XAGUSD", "Silver / US Dollar", 5000, "USD", 0.01),

  // ===== CRYPTO =====
  crypto("BTCUSD", "Bitcoin / US Dollar", "USD"),
  crypto("ETHUSD", "Ethereum / US Dollar", "USD"),
  crypto("XRPUSD", "Ripple / US Dollar", "USD"),
  crypto("SOLUSD", "Solana / US Dollar", "USD"),
  crypto("LTCUSD", "Litecoin / US Dollar", "USD"),
  crypto("BNBUSD", "BNB / US Dollar", "USD"),
  crypto("ADAUSD", "Cardano / US Dollar", "USD"),
  crypto("DOGEUSD", "Dogecoin / US Dollar", "USD"),
];

export function findInstrument(symbol: string): InstrumentDef | undefined {
  return INSTRUMENTS.find((i) => i.symbol === symbol);
}

export function instrumentsByCategory(cat: AssetCategory): InstrumentDef[] {
  return INSTRUMENTS.filter((i) => i.category === cat);
}

/**
 * Resolve the quote→account conversion rate AUTOMATICALLY.
 *
 * `entry` is the current price of the instrument (quote per 1 base unit).
 * Returns { rate, approximate } where `approximate` is true when the static
 * FX table was used as a fallback (no manual input is ever required).
 */
export function resolveConversionRate(args: {
  baseCurrency: string;
  quoteCurrency: string;
  account: AccountCurrency;
  entry: number;
}): { rate: number; approximate: boolean } {
  const { baseCurrency, quoteCurrency, account, entry } = args;

  // 1. Quote already in account currency → no conversion.
  if (quoteCurrency === account) return { rate: 1, approximate: false };

  // 2. Base is the account currency → quote→account = 1 / entry.
  //    e.g. USDJPY on USD account: loss is in JPY; 1 JPY = (1/entry) USD.
  if (baseCurrency === account && entry > 0) {
    return { rate: 1 / entry, approximate: false };
  }

  // 3. Static fallback (e.g. GBPJPY on a EUR account): use the FX table.
  const rate = staticRateToAccount(quoteCurrency, account);
  if (rate > 0) return { rate, approximate: true };

  // 4. Could not resolve — signal caller to ask for manual input.
  return { rate: 0, approximate: true };
}

export interface PositionInput {
  balance: number;
  accountCurrency: AccountCurrency;
  riskMode: RiskMode;
  riskPercent: number;
  riskAmount: number;
  entry: number;
  stopLoss: number;
  contractSize: number;
  quoteCurrency: string;
  pipSize: number;
  /** quote → account rate. 1 when they match. */
  conversionRate: number;
}

export interface PositionResult {
  lotSize: number;
  lotSizeRaw: number;
  moneyRisked: number;
  stopDistancePrice: number;
  stopDistancePips: number;
  lossPerLot: number;
  units: number;
  notional: number;
  warnings: string[];
}

export class PositionCalcError extends Error {}

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

  const stopDistancePrice = Math.abs(entry - stop);
  const stopDistancePips = stopDistancePrice / pipSize;

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
