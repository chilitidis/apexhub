/**
 * instruments.ts — the single source of truth for the tradable-instrument
 * catalogue used by BOTH the client Position Calculator and the server-side
 * Telegram signal parser.
 *
 * The catalogue used to live in client/src/lib/positionCalc.ts; it was moved
 * here (shared/) so the server can validate symbols in incoming Team Signals
 * without importing client code. positionCalc.ts re-exports everything, so
 * existing client imports keep working unchanged.
 */

export type AssetCategory = "forex" | "indices" | "metals" | "crypto" | "energy";

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

function energy(symbol: string, label: string, contractSize: number): InstrumentDef {
  // Oil CFDs: price in USD per barrel; contract size = barrels per 1 lot.
  // DEFAULT 100 barrels (FTMO-style). Brokers vary (100 vs 1000!) — the
  // Signals panel lets each member override via broker preset / custom.
  return { symbol, label, category: "energy", contractSize, baseCurrency: "", quoteCurrency: "USD", pipSize: 0.01, pipLabel: "points" };
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

  // ===== ENERGY =====
  energy("USOIL", "WTI Crude Oil (USOIL)", 100),
  energy("UKOIL", "Brent Crude Oil (UKOIL)", 100),

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

/* ------------------------------------------------------------------ */
/* Symbol normalization (used by the Telegram signal parser)          */
/* ------------------------------------------------------------------ */

/**
 * Common shorthand aliases seen in real-world Telegram posts. An alias is
 * only applied when it maps to an EXACT catalogue symbol — we never guess.
 */
const SYMBOL_ALIASES: Record<string, string> = {
  XAU: "XAUUSD",
  GOLD: "XAUUSD",
  XAG: "XAGUSD",
  SILVER: "XAGUSD",
  BTC: "BTCUSD",
  ETH: "ETHUSD",
  NAS100: "US100",
  NASDAQ: "US100",
  SPX500: "US500",
  SPX: "US500",
  DOW: "US30",
  DJ30: "US30",
  OIL: "USOIL",
  WTI: "USOIL",
  CRUDE: "USOIL",
  CRUDEOIL: "USOIL",
  XTIUSD: "USOIL",
  USOILCASH: "USOIL",
  BRENT: "UKOIL",
  BRENTOIL: "UKOIL",
  XBRUSD: "UKOIL",
  UKOILCASH: "UKOIL",
  DAX: "GER40",
  DAX40: "GER40",
};

/**
 * Normalize a raw token ("CAD/CHF", "eur-usd", "XAU") into a catalogue-style
 * symbol ("CADCHF", "EURUSD", "XAUUSD"). The result is NOT guaranteed to be a
 * valid instrument — callers must still check with `findInstrument`. Alias
 * expansion (XAU → XAUUSD) is only applied when the target exists in the
 * catalogue, so we never invent instruments.
 */
export function normalizeSymbol(raw: string): string {
  const cleaned = (raw || "").toUpperCase().replace(/[\/\-_\s.]/g, "");
  const alias = SYMBOL_ALIASES[cleaned];
  if (alias && findInstrument(alias)) return alias;
  return cleaned;
}
