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
 *   (e.g. GBPJPY on a EUR account), we first try a LIVE usd-per-unit map
 *   (fetched from the FX rates endpoint) and only then fall back to the
 *   built-in static table below — the user still never has to type a rate.
 *
 * The instrument catalogue itself lives in shared/instruments.ts (single
 * source of truth shared with the server-side signal parser); it is
 * re-exported here so existing imports keep working.
 */

import {
  INSTRUMENTS,
  findInstrument,
  instrumentsByCategory,
  normalizeSymbol,
  type AssetCategory,
  type InstrumentDef,
} from "@shared/instruments";

export {
  INSTRUMENTS,
  findInstrument,
  instrumentsByCategory,
  normalizeSymbol,
  type AssetCategory,
  type InstrumentDef,
};

export type AccountCurrency = "USD" | "EUR";
export type RiskMode = "percent" | "amount";

/* ------------------------------------------------------------------ */
/* Static FX reference table (approximate, units of USD per 1 unit).  */
/* Used only as a fallback when neither leg of the pair is the account*/
/* currency AND no live rates are available. Values are indicative    */
/* mid-rates — good enough for sizing.                                */
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

/**
 * How many ACCOUNT-currency units 1 unit of `ccy` is worth. Prefers the live
 * usd-per-unit map when it contains BOTH currencies; falls back to the static
 * table otherwise. Returns rate 0 when neither source can resolve it.
 */
function rateToAccount(
  ccy: string,
  account: AccountCurrency,
  liveUsdPerUnit?: Record<string, number> | null,
): { rate: number; usedStaticRate: boolean } {
  const liveCcy = liveUsdPerUnit?.[ccy];
  const liveAcct = liveUsdPerUnit?.[account];
  if (liveCcy && liveAcct && liveCcy > 0 && liveAcct > 0) {
    return { rate: liveCcy / liveAcct, usedStaticRate: false };
  }
  const usdPerCcy = USD_PER_UNIT[ccy];
  const usdPerAccount = USD_PER_UNIT[account];
  if (!usdPerCcy || !usdPerAccount) return { rate: 0, usedStaticRate: true };
  // (USD/ccy) / (USD/account) = account/ccy
  return { rate: usdPerCcy / usdPerAccount, usedStaticRate: true };
}

/**
 * Resolve the quote→account conversion rate AUTOMATICALLY.
 *
 * `entry` is the current price of the instrument (quote per 1 base unit).
 * `liveUsdPerUnit` (optional) is a live map of USD-per-1-unit rates; when a
 * table lookup is needed it takes precedence over the static USD_PER_UNIT.
 * Returns { rate, approximate, usedStaticRate } where `approximate` is true
 * when a table (live or static) was used instead of the instrument's own
 * price, and `usedStaticRate` is true only when the STATIC table was used.
 */
export function resolveConversionRate(args: {
  baseCurrency: string;
  quoteCurrency: string;
  account: AccountCurrency;
  entry: number;
  liveUsdPerUnit?: Record<string, number> | null;
}): { rate: number; approximate: boolean; usedStaticRate: boolean } {
  const { baseCurrency, quoteCurrency, account, entry, liveUsdPerUnit } = args;

  // 1. Quote already in account currency → no conversion.
  if (quoteCurrency === account) return { rate: 1, approximate: false, usedStaticRate: false };

  // 2. Base is the account currency → quote→account = 1 / entry.
  //    e.g. USDJPY on USD account: loss is in JPY; 1 JPY = (1/entry) USD.
  if (baseCurrency === account && entry > 0) {
    return { rate: 1 / entry, approximate: false, usedStaticRate: false };
  }

  // 3. Table fallback (e.g. GBPJPY on a EUR account): live map first, then
  //    the built-in static table.
  const table = rateToAccount(quoteCurrency, account, liveUsdPerUnit);
  if (table.rate > 0)
    return { rate: table.rate, approximate: table.usedStaticRate, usedStaticRate: table.usedStaticRate };

  // 4. Could not resolve — signal caller to ask for manual input.
  return { rate: 0, approximate: true, usedStaticRate: true };
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
  /**
   * Optional: base currency of the instrument. When provided together with a
   * non-positive `conversionRate`, computePosition resolves the rate itself
   * via resolveConversionRate (using `liveUsdPerUnit` when supplied).
   */
  baseCurrency?: string;
  /** Optional live USD-per-1-unit FX map (from signals.fxRates). */
  liveUsdPerUnit?: Record<string, number> | null;
  /** Optional: pass-through flag when the caller resolved the rate itself. */
  usedStaticRate?: boolean;
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
  /** True when the STATIC fallback FX table was used for the conversion. */
  usedStaticRate: boolean;
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

  // Resolve the conversion rate: use the caller-supplied rate when it is a
  // valid positive number; otherwise (new signal-panel path) derive it from
  // the instrument currencies + optional live FX map.
  let rate = input.conversionRate;
  let usedStaticRate = input.usedStaticRate ?? false;
  if ((!Number.isFinite(rate) || rate <= 0) && input.baseCurrency !== undefined) {
    const auto = resolveConversionRate({
      baseCurrency: input.baseCurrency,
      quoteCurrency: input.quoteCurrency,
      account: input.accountCurrency,
      entry,
      liveUsdPerUnit: input.liveUsdPerUnit,
    });
    rate = auto.rate;
    usedStaticRate = auto.usedStaticRate;
  }
  rate = num(rate, "Conversion rate");
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
    usedStaticRate,
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

/**
 * Round a lot size DOWN to `dp` decimals. Used by Team Signals — we never
 * round a lot UP, so the member can only ever risk slightly LESS than their
 * configured risk, never more.
 */
export function floorLot(v: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.floor((v + Number.EPSILON) * f) / f;
}
