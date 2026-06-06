/**
 * PositionCalculator — fully working lot-size calculator.
 *
 * Computes the recommended position size from the trader's balance, risk
 * (percent or fixed amount), entry & stop-loss prices, and the chosen
 * instrument. Supports Forex, Indices, Metals and Crypto. When the
 * instrument's quote currency differs from the account currency, the user
 * supplies a manual conversion rate (offline-first, no live feed needed).
 *
 * The shell mirrors CalendarPage (sidebar + Ocean Depth header).
 */
import React, { useMemo, useState } from "react";
void React;
import { useLocation } from "wouter";
import { Calculator, AlertTriangle, ArrowRight, Info } from "lucide-react";
import { toast } from "sonner";
import { AppSidebar, type ViewKey } from "@/components/AppSidebar";
import { useAccounts } from "@/hooks/useJournal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INSTRUMENTS,
  instrumentsByCategory,
  findInstrument,
  computePosition,
  resolveConversionRate,
  PositionCalcError,
  type AssetCategory,
  type AccountCurrency,
  type RiskMode,
  type PositionResult,
} from "@/lib/positionCalc";
void INSTRUMENTS;

const CATEGORIES: { key: AssetCategory; label: string }[] = [
  { key: "forex", label: "Forex" },
  { key: "indices", label: "Indices" },
  { key: "metals", label: "Metals" },
  { key: "crypto", label: "Crypto" },
];

const CUSTOM = "__custom__";

function fmtMoney(n: number, cur: AccountCurrency): string {
  const sym = cur === "EUR" ? "€" : "$";
  return `${sym}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PositionCalculator() {
  const [, setLocation] = useLocation();
  const { accounts } = useAccounts();
  const [view] = useState<ViewKey>("position-calc");

  // ---- form state ----
  const [category, setCategory] = useState<AssetCategory>("forex");
  const [symbol, setSymbol] = useState<string>("EURUSD");
  const [accountCurrency, setAccountCurrency] = useState<AccountCurrency>("USD");
  const [balance, setBalance] = useState<string>("10000");
  const [riskMode, setRiskMode] = useState<RiskMode>("percent");
  const [riskPercent, setRiskPercent] = useState<string>("1");
  const [riskAmount, setRiskAmount] = useState<string>("100");
  const [entry, setEntry] = useState<string>("1.10000");
  const [stopLoss, setStopLoss] = useState<string>("1.09000");
  const [conversionRate, setConversionRate] = useState<string>("1");

  // Custom-instrument fields (only used when symbol === CUSTOM).
  const [customContract, setCustomContract] = useState<string>("100000");
  const [customPip, setCustomPip] = useState<string>("0.0001");
  const [customQuote, setCustomQuote] = useState<string>("USD");

  const list = useMemo(() => instrumentsByCategory(category), [category]);

  const instrument = symbol === CUSTOM ? null : findInstrument(symbol);
  const contractSize = symbol === CUSTOM ? Number(customContract) : instrument?.contractSize ?? 0;
  const pipSize = symbol === CUSTOM ? Number(customPip) : instrument?.pipSize ?? 1;
  const quoteCurrency = symbol === CUSTOM ? customQuote.toUpperCase() : instrument?.quoteCurrency ?? "USD";
  const baseCurrency = symbol === CUSTOM ? "" : instrument?.baseCurrency ?? "";
  const pipLabel = instrument?.pipLabel ?? "points";

  // ---- AUTOMATIC conversion (quote → account) ----
  // For known instruments we resolve the rate ourselves from the entry price
  // and a built-in FX table; the user never types an FX rate. For a fully
  // custom instrument we fall back to the manual field.
  const auto = useMemo(
    () =>
      resolveConversionRate({
        baseCurrency,
        quoteCurrency,
        account: accountCurrency,
        entry: Number(entry),
      }),
    [baseCurrency, quoteCurrency, accountCurrency, entry],
  );

  const isCustom = symbol === CUSTOM;
  // Conversion differs from 1 only when quote != account.
  const needsConversion = quoteCurrency !== accountCurrency;
  // Effective rate fed to the math.
  const effectiveRate = !needsConversion
    ? 1
    : isCustom
      ? Number(conversionRate)
      : auto.rate;
  // Only the custom path still needs a manual rate input.
  const needsManualRate = needsConversion && isCustom;

  function onPickCategory(cat: AssetCategory) {
    setCategory(cat);
    const first = instrumentsByCategory(cat)[0];
    if (first) {
      setSymbol(first.symbol);
      // Seed reasonable example prices per category.
      seedPricesFor(first.symbol);
    }
  }

  function seedPricesFor(sym: string) {
    const inst = findInstrument(sym);
    if (!inst) return;
    if (inst.category === "forex") {
      const jpy = inst.quoteCurrency === "JPY";
      setEntry(jpy ? "150.000" : "1.10000");
      setStopLoss(jpy ? "149.500" : "1.09000");
    } else if (inst.category === "indices") {
      setEntry("40000");
      setStopLoss("39900");
    } else if (inst.category === "metals") {
      setEntry(inst.symbol === "XAUUSD" ? "2400.0" : "30.00");
      setStopLoss(inst.symbol === "XAUUSD" ? "2390.0" : "29.50");
    } else if (inst.category === "crypto") {
      setEntry("60000");
      setStopLoss("59000");
    }
  }

  function onPickSymbol(sym: string) {
    setSymbol(sym);
    if (sym !== CUSTOM) seedPricesFor(sym);
  }

  // ---- compute ----
  const { result, error } = useMemo<{ result: PositionResult | null; error: string | null }>(() => {
    try {
      const r = computePosition({
        balance: Number(balance),
        accountCurrency,
        riskMode,
        riskPercent: Number(riskPercent),
        riskAmount: Number(riskAmount),
        entry: Number(entry),
        stopLoss: Number(stopLoss),
        contractSize,
        quoteCurrency,
        pipSize,
        conversionRate: effectiveRate,
      });
      return { result: r, error: null };
    } catch (e) {
      const msg = e instanceof PositionCalcError ? e.message : "Έλεγξε τα στοιχεία.";
      return { result: null, error: msg };
    }
  }, [
    balance, accountCurrency, riskMode, riskPercent, riskAmount, entry, stopLoss,
    contractSize, quoteCurrency, pipSize, effectiveRate,
  ]);

  function onSetView(v: ViewKey) {
    if (v === "position-calc") return;
    if (v === "dashboard") return setLocation("/dashboard");
    if (v === "accounts") return setLocation("/accounts");
    if (v === "calendar") return setLocation("/calendar");
    if (v === "pattern-analysis" || v === "pre-market" || v === "market-news" || v === "trading-coach") return openAction(v);
    toast.info("Σύντομα διαθέσιμο");
  }
  function openAction(action: string) {
    const id = accounts[0]?.id;
    if (!id) {
      toast.info("Δημιούργησε πρώτα έναν λογαριασμό");
      return setLocation("/accounts");
    }
    setLocation(`/account/${id}?action=${action}`);
  }
  const sidebarHandlers = {
    onAddTrade: () => openAction("add-trade"),
    onNewMonth: () => openAction("new-month"),
    onImport: () => openAction("import"),
    onSyncMt5: () => openAction("sync-mt5"),
    onCheck: () => openAction("check"),
    onCash: () => openAction("cash"),
    onCalc: () => openAction("what-if"),
    onExport: () => openAction("export"),
  };

  const inputCls =
    "w-full bg-[#0A1628] border border-white/10 rounded-lg px-3 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-[#0077B6] transition-colors";
  const labelCls = "font-mono text-[10px] uppercase tracking-widest text-[#6E8AA8] mb-1.5 block";

  return (
    <div className="min-h-screen bg-[#0A1628] flex">
      <AppSidebar view={view} setView={onSetView} handlers={sidebarHandlers} accountsCount={accounts.length} />
      <div className="flex-1 lg:ml-[248px]">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0077B6] to-[#023E8A] flex items-center justify-center">
              <Calculator size={22} className="text-white" />
            </div>
            <div>
              <h1 className="font-['Space_Grotesk'] text-2xl font-semibold text-white leading-tight">
                Position Calculator
              </h1>
              <p className="font-mono text-[11px] text-[#6E8AA8] uppercase tracking-wider">
                Υπολόγισε lot size βάσει balance · risk · stop loss
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* ===== INPUT PANEL ===== */}
            <div className="lg:col-span-3 bg-[#0D1E35]/80 border border-white/8 rounded-2xl p-5 backdrop-blur-sm space-y-5">
              {/* Category tabs */}
              <div>
                <span className={labelCls}>Κατηγορία</span>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => onPickCategory(c.key)}
                      className={`px-3 py-1.5 rounded-lg font-mono text-[11px] uppercase tracking-wider transition-all ${
                        category === c.key
                          ? "bg-[#0077B6] text-white"
                          : "bg-[#0A1628] text-[#4A6080] border border-white/8 hover:text-white"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Instrument */}
              <div>
                <span className={labelCls}>Instrument</span>
                <Select value={symbol} onValueChange={onPickSymbol}>
                  <SelectTrigger className="h-11 bg-[#0A1628] border-white/10 text-white font-mono text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0D1E35] border-white/10 text-white max-h-72">
                    {list.map((i) => (
                      <SelectItem key={i.symbol} value={i.symbol} className="font-mono text-xs">
                        {i.symbol} <span className="text-[#6E8AA8] ml-2">· {i.label}</span>
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM} className="font-mono text-xs">
                      Custom (χειροκίνητο)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom instrument fields */}
              {symbol === CUSTOM && (
                <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-[#0A1628] border border-white/8">
                  <div>
                    <span className={labelCls}>Contract size</span>
                    <input className={inputCls} value={customContract} onChange={(e) => setCustomContract(e.target.value)} inputMode="decimal" />
                  </div>
                  <div>
                    <span className={labelCls}>Pip size</span>
                    <input className={inputCls} value={customPip} onChange={(e) => setCustomPip(e.target.value)} inputMode="decimal" />
                  </div>
                  <div>
                    <span className={labelCls}>Quote ccy</span>
                    <input className={inputCls} value={customQuote} onChange={(e) => setCustomQuote(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Balance + currency */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <span className={labelCls}>Balance λογαριασμού</span>
                  <input className={inputCls} value={balance} onChange={(e) => setBalance(e.target.value)} inputMode="decimal" />
                </div>
                <div>
                  <span className={labelCls}>Νόμισμα</span>
                  <Select value={accountCurrency} onValueChange={(v) => setAccountCurrency(v as AccountCurrency)}>
                    <SelectTrigger className="h-[42px] bg-[#0A1628] border-white/10 text-white font-mono text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0D1E35] border-white/10 text-white">
                      <SelectItem value="USD" className="font-mono text-xs">USD ($)</SelectItem>
                      <SelectItem value="EUR" className="font-mono text-xs">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Risk */}
              <div>
                <span className={labelCls}>Risk</span>
                <div className="flex gap-1.5 mb-2">
                  <button
                    onClick={() => setRiskMode("percent")}
                    className={`px-3 py-1.5 rounded-lg font-mono text-[11px] uppercase tracking-wider transition-all ${
                      riskMode === "percent" ? "bg-[#0077B6] text-white" : "bg-[#0A1628] text-[#4A6080] border border-white/8 hover:text-white"
                    }`}
                  >
                    Ποσοστό %
                  </button>
                  <button
                    onClick={() => setRiskMode("amount")}
                    className={`px-3 py-1.5 rounded-lg font-mono text-[11px] uppercase tracking-wider transition-all ${
                      riskMode === "amount" ? "bg-[#0077B6] text-white" : "bg-[#0A1628] text-[#4A6080] border border-white/8 hover:text-white"
                    }`}
                  >
                    Ποσό
                  </button>
                </div>
                {riskMode === "percent" ? (
                  <div className="relative">
                    <input className={inputCls} value={riskPercent} onChange={(e) => setRiskPercent(e.target.value)} inputMode="decimal" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm text-[#6E8AA8]">%</span>
                  </div>
                ) : (
                  <input className={inputCls} value={riskAmount} onChange={(e) => setRiskAmount(e.target.value)} inputMode="decimal" />
                )}
              </div>

              {/* Entry + SL */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className={labelCls}>Entry price</span>
                  <input className={inputCls} value={entry} onChange={(e) => setEntry(e.target.value)} inputMode="decimal" />
                </div>
                <div>
                  <span className={labelCls}>Stop loss</span>
                  <input className={inputCls} value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} inputMode="decimal" />
                </div>
              </div>

              {/* Conversion — automatic for known instruments, manual only for Custom */}
              {needsConversion && !needsManualRate && (
                <div className="p-3 rounded-lg bg-[#0077B6]/8 border border-[#0077B6]/20">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-[#6E8AA8]">
                      <Info size={12} className="shrink-0 text-[#0094C6]" />
                      Ισοτιμία {quoteCurrency} → {accountCurrency} (auto)
                    </span>
                    <span className="font-mono text-sm font-semibold text-white">
                      {auto.rate > 0 ? auto.rate.toFixed(5) : "—"}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-[#6E8AA8] leading-relaxed mt-1.5">
                    {auto.approximate
                      ? `Υπολογίζεται αυτόματα από ενσωματωμένο πίνακα ισοτιμιών (κατά προσέγγιση). Το lot βγαίνει σε ${accountCurrency}.`
                      : `Υπολογίζεται αυτόματα από την τιμή του instrument. Το lot βγαίνει σε ${accountCurrency}.`}
                  </p>
                </div>
              )}

              {/* Manual rate fallback — only for fully custom instruments */}
              {needsManualRate && (
                <div className="p-3 rounded-lg bg-[#F4A261]/8 border border-[#F4A261]/20">
                  <span className={labelCls}>
                    Ισοτιμία {quoteCurrency} → {accountCurrency}
                  </span>
                  <input className={inputCls} value={conversionRate} onChange={(e) => setConversionRate(e.target.value)} inputMode="decimal" />
                  <p className="flex items-start gap-1.5 mt-2 font-mono text-[10px] text-[#F4A261] leading-relaxed">
                    <Info size={12} className="mt-0.5 shrink-0" />
                    Custom instrument σε {quoteCurrency} ενώ ο λογαριασμός είναι σε {accountCurrency}.
                    Βάλε πόσα {accountCurrency} αξίζει 1 {quoteCurrency}.
                  </p>
                </div>
              )}
            </div>

            {/* ===== RESULT PANEL ===== */}
            <div className="lg:col-span-2 space-y-4">
              {error ? (
                <div className="bg-[#E94F37]/8 border border-[#E94F37]/25 rounded-2xl p-5 flex items-start gap-3">
                  <AlertTriangle size={18} className="text-[#E94F37] mt-0.5 shrink-0" />
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#E94F37] mb-1">Σφάλμα</div>
                    <div className="font-mono text-xs text-white leading-relaxed">{error}</div>
                  </div>
                </div>
              ) : result ? (
                <>
                  {/* Headline lot size */}
                  <div className="bg-gradient-to-br from-[#0077B6]/20 to-[#023E8A]/10 border border-[#0077B6]/30 rounded-2xl p-5">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#6E8AA8] mb-1">
                      Προτεινόμενο μέγεθος
                    </div>
                    <div className="font-mono text-4xl font-bold text-white leading-none">
                      {result.lotSize.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-lg text-[#6E8AA8] ml-2">
                        {category === "indices" || category === "crypto" ? "contracts" : "lots"}
                      </span>
                    </div>
                    {result.lotSizeRaw !== result.lotSize && (
                      <div className="font-mono text-[10px] text-[#6E8AA8] mt-1.5">
                        ακριβές: {result.lotSizeRaw.toFixed(4)}
                      </div>
                    )}
                  </div>

                  {/* Metrics */}
                  <div className="bg-[#0D1E35]/80 border border-white/8 rounded-2xl p-5 space-y-3 backdrop-blur-sm">
                    <Row label="Money risked" value={fmtMoney(result.moneyRisked, accountCurrency)} accent="#E94F37" />
                    <Row label={`SL distance (${pipLabel})`} value={result.stopDistancePips.toLocaleString("en-US", { maximumFractionDigits: 2 })} />
                    <Row label="SL distance (price)" value={String(result.stopDistancePrice)} />
                    <Row label="Loss / 1 lot" value={fmtMoney(result.lossPerLot, accountCurrency)} />
                    <Row label="Units (base)" value={result.units.toLocaleString("en-US", { maximumFractionDigits: 4 })} />
                    <Row label="Notional value" value={fmtMoney(result.notional, accountCurrency)} accent="#00897B" />
                  </div>

                  {/* Warnings */}
                  {result.warnings.map((w, i) => (
                    <div key={i} className="bg-[#F4A261]/8 border border-[#F4A261]/20 rounded-xl p-3 flex items-start gap-2">
                      <AlertTriangle size={14} className="text-[#F4A261] mt-0.5 shrink-0" />
                      <span className="font-mono text-[11px] text-[#F4A261] leading-relaxed">{w}</span>
                    </div>
                  ))}

                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#4A6080] px-1">
                    <ArrowRight size={11} />
                    {instrument ? `${instrument.symbol} · ${instrument.label}` : "Custom instrument"}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-mono text-[11px] text-[#6E8AA8]">{label}</span>
      <span className="font-mono text-sm font-semibold" style={{ color: accent || "#FFFFFF" }}>
        {value}
      </span>
    </div>
  );
}
