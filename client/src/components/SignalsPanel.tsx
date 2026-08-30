/**
 * SignalsPanel — "Team Signals" on the Position Calculator page.
 *
 * Shows the trade signals the owner posts in the private Telegram channel
 * (ingested by server/telegram.ts) and — the whole point — computes each
 * member's PERSONAL lot size from their saved risk % and their account
 * balance. Lots are always rounded DOWN (floorLot) so a member can never
 * risk more than their configured percentage.
 *
 * Member settings (risk % + which account feeds the balance) persist in
 * localStorage keyed by the user's openId. Balance comes from the picked
 * account's latest monthly-snapshot ending balance, with a manual override.
 */
import React, { useEffect, useMemo, useState } from "react";
void React;
import { Radio, TriangleAlert, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAccounts } from "@/hooks/useJournal";
import { useSubscription } from "@/hooks/useSubscription";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  findInstrument,
  resolveConversionRate,
  computePosition,
  floorLot,
  PositionCalcError,
  type AccountCurrency,
} from "@/lib/positionCalc";

const MANUAL = "__manual__";
const OTHER_BROKER = "__other__";

/**
 * Broker presets: per-symbol contract-size overrides vs the standard
 * catalogue (contract size 1 for index CFDs / crypto — the post-2022 MT5
 * standard; FTMO confirmed 1-per-lot since Sep 2022). An empty object means
 * the firm matches the standard specs. Adjust HERE when a member's MT5
 * "Specification" screen shows a different contract size.
 */
const BROKER_PRESETS: Record<string, Record<string, number>> = {
  FTMO: {},
  FundedNext: {},
  "Alpha Capital": {},
  "GOAT Funded": {},
  FundingPips: {},
  "Exclusive Markets": {},
  "Fortune Prime Global": {},
};
const BROKER_NAMES = Object.keys(BROKER_PRESETS);

const inputCls =
  "w-full bg-[#0A1628] border border-white/10 rounded-lg px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-[#0077B6] transition-colors";
const labelCls = "font-mono text-[10px] uppercase tracking-widest text-[#6E8AA8] mb-1 block";

function fmtMoney(n: number, cur: AccountCurrency): string {
  const sym = cur === "EUR" ? "€" : "$";
  return `${sym}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPrice(v: string | null): string {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  // Trim decimal(18,6) padding: 1.085000 → 1.085, 2380.000000 → 2380
  return String(n);
}

function timeAgo(d: Date | string, agoTemplate: string, nowLabel: string): string {
  const ts = d instanceof Date ? d.getTime() : new Date(d).getTime();
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return nowLabel;
  const span =
    s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`;
  return agoTemplate.replace("{t}", span);
}

function clampRisk(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.min(10, Math.max(0.1, v));
}

export default function SignalsPanel() {
  const { t } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const { accounts } = useAccounts();
  const { isAdmin } = useSubscription();

  const openId = user?.openId ?? "anon";
  const riskKey = `utj_signal_risk_${openId}`;
  const accountKey = `utj_signal_account_${openId}`;

  // ---- member settings (persisted) ----
  const [riskPct, setRiskPct] = useState<string>("1");
  const [accountSel, setAccountSel] = useState<string>(MANUAL);
  const [manualBalance, setManualBalance] = useState<string>("");
  const [manualCur, setManualCur] = useState<AccountCurrency>("USD");
  const [csOverrides, setCsOverrides] = useState<Record<string, string>>({});
  const [brokerSel, setBrokerSel] = useState<string>("FTMO");
  const [loadedFor, setLoadedFor] = useState<string>("");

  useEffect(() => {
    if (loadedFor === openId) return;
    setLoadedFor(openId);
    try {
      const r = localStorage.getItem(riskKey);
      if (r) setRiskPct(r);
      const a = localStorage.getItem(accountKey);
      if (a) setAccountSel(a);
      const c = localStorage.getItem(`utj_signal_cur_${openId}`);
      if (c === "EUR" || c === "USD") setManualCur(c);
      const cs = localStorage.getItem(`utj_signal_cs_${openId}`);
      if (cs) setCsOverrides(JSON.parse(cs) as Record<string, string>);
      const b = localStorage.getItem(`utj_signal_broker_${openId}`);
      if (b && (b === OTHER_BROKER || BROKER_NAMES.includes(b))) setBrokerSel(b);
    } catch {
      // localStorage unavailable — defaults are fine
    }
  }, [openId, loadedFor, riskKey, accountKey]);

  function saveRisk(v: string) {
    setRiskPct(v);
    try {
      localStorage.setItem(riskKey, v);
    } catch {
      /* ignore */
    }
  }
  function saveManualCur(v: AccountCurrency) {
    setManualCur(v);
    try {
      localStorage.setItem(`utj_signal_cur_${openId}`, v);
    } catch {
      /* ignore */
    }
  }
  function saveBroker(v: string) {
    setBrokerSel(v);
    try {
      localStorage.setItem(`utj_signal_broker_${openId}`, v);
    } catch {
      /* ignore */
    }
  }
  function saveCs(symbol: string, v: string) {
    setCsOverrides((m) => {
      const next = { ...m, [symbol]: v };
      try {
        localStorage.setItem(`utj_signal_cs_${openId}`, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }
  function saveAccount(v: string) {
    setAccountSel(v);
    try {
      localStorage.setItem(accountKey, v);
    } catch {
      /* ignore */
    }
  }

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.archivedAt), [accounts]);
  const pickedAccount = useMemo(
    () => activeAccounts.find((a) => String(a.id) === accountSel) ?? null,
    [activeAccounts, accountSel],
  );

  // ---- data ----
  const signalsQuery = trpc.signals.list.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });
  const fxQuery = trpc.signals.fxRates.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 6 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const liveUsdPerUnit = fxQuery.data?.usdPerUnit ?? null;

  // Balance = latest monthly-snapshot ending of the picked account (same
  // snapshots the Accounts/TradingCoach pages read), overridable manually.
  const snapshotsQuery = trpc.journal.listSnapshots.useQuery(
    pickedAccount ? { accountId: pickedAccount.id } : (undefined as never),
    { enabled: Boolean(pickedAccount), refetchOnWindowFocus: false, retry: false },
  );
  const snapshotBalance = useMemo(() => {
    const rows = snapshotsQuery.data;
    if (!rows || rows.length === 0) return pickedAccount?.startingBalance ?? 0;
    const latest = [...rows].sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1))[0];
    const ending = Number(latest.ending);
    return Number.isFinite(ending) && ending > 0
      ? ending
      : (pickedAccount?.startingBalance ?? 0);
  }, [snapshotsQuery.data, pickedAccount]);

  const balance = manualBalance.trim() !== "" ? Number(manualBalance) : pickedAccount ? snapshotBalance : NaN;
  const currency: AccountCurrency = pickedAccount ? (pickedAccount.currency === "EUR" ? "EUR" : "USD") : manualCur;
  const risk = clampRisk(Number(riskPct));

  // Per-signal "current price" overrides for MARKET entries (we refuse to
  // guess a price — accuracy first).
  const [priceNow, setPriceNow] = useState<Record<number, string>>({});

  // ---- admin mini-form ----
  const [showForm, setShowForm] = useState(false);
  const [fSymbol, setFSymbol] = useState("");
  const [fDirection, setFDirection] = useState<"BUY" | "SELL">("BUY");
  const [fEntry, setFEntry] = useState("");
  const [fSl, setFSl] = useState("");
  const [fTp1, setFTp1] = useState("");
  const [fTp2, setFTp2] = useState("");
  const [fTp3, setFTp3] = useState("");
  const utils = trpc.useUtils();
  const createMutation = trpc.signals.create.useMutation({
    onSuccess: () => {
      toast.success(t("ts.posted"));
      setShowForm(false);
      setFSymbol(""); setFEntry(""); setFSl(""); setFTp1(""); setFTp2(""); setFTp3("");
      utils.signals.list.invalidate();
    },
    onError: (e) => toast.error(`${t("ts.postFailed")}: ${e.message}`),
  });
  const closeMutation = trpc.signals.close.useMutation({
    onSuccess: () => {
      toast.success(t("ts.closedToast"));
      utils.signals.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function submitForm() {
    const num = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(",", ".")));
    const sl = num(fSl);
    if (!fSymbol.trim() || sl === undefined || !Number.isFinite(sl) || sl <= 0) {
      toast.error(t("ts.postFailed"));
      return;
    }
    createMutation.mutate({
      symbol: fSymbol.trim(),
      direction: fDirection,
      entry: num(fEntry) ?? null,
      sl,
      tp1: num(fTp1) ?? null,
      tp2: num(fTp2) ?? null,
      tp3: num(fTp3) ?? null,
    });
  }

  const signals = signalsQuery.data ?? [];

  return (
    <div className="bg-[#0D1E35]/80 border border-white/8 rounded-2xl p-5 backdrop-blur-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#00897B] to-[#023E8A] flex items-center justify-center">
            <Radio size={18} className="text-white" />
          </div>
          <div>
            <h2 className="font-['Space_Grotesk'] text-lg font-semibold text-white leading-tight">
              {t("ts.title")}
            </h2>
            <p className="font-mono text-[10px] text-[#6E8AA8] uppercase tracking-wider">{t("ts.subtitle")}</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[11px] uppercase tracking-wider bg-[#0077B6]/15 border border-[#0077B6]/40 text-[#48CAE4] hover:bg-[#0077B6]/25 transition-colors"
          >
            {showForm ? <X size={13} /> : <Plus size={13} />} {t("ts.newSignal")}
          </button>
        )}
      </div>

      {/* Admin mini-form */}
      {isAdmin && showForm && (
        <div className="p-3 rounded-xl bg-[#0A1628] border border-[#0077B6]/30 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <span className={labelCls}>{t("ts.symbol")}</span>
            <input className={inputCls} value={fSymbol} onChange={(e) => setFSymbol(e.target.value)} placeholder="EURUSD" />
          </div>
          <div>
            <span className={labelCls}>{t("ts.direction")}</span>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => setFDirection("BUY")}
                className={`px-2 py-2 rounded-lg font-mono text-[11px] font-bold border transition-all ${
                  fDirection === "BUY"
                    ? "bg-[#00897B]/15 border-[#00897B] text-[#00897B]"
                    : "bg-white/5 border-white/10 text-[#6E8AA8]"
                }`}
              >
                BUY
              </button>
              <button
                onClick={() => setFDirection("SELL")}
                className={`px-2 py-2 rounded-lg font-mono text-[11px] font-bold border transition-all ${
                  fDirection === "SELL"
                    ? "bg-[#E94F37]/15 border-[#E94F37] text-[#E94F37]"
                    : "bg-white/5 border-white/10 text-[#6E8AA8]"
                }`}
              >
                SELL
              </button>
            </div>
          </div>
          <div>
            <span className={labelCls}>{t("ts.entryOptional")}</span>
            <input className={inputCls} value={fEntry} onChange={(e) => setFEntry(e.target.value)} inputMode="decimal" placeholder="market" />
          </div>
          <div>
            <span className={labelCls}>SL</span>
            <input className={inputCls} value={fSl} onChange={(e) => setFSl(e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <span className={labelCls}>TP1</span>
            <input className={inputCls} value={fTp1} onChange={(e) => setFTp1(e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <span className={labelCls}>TP2</span>
            <input className={inputCls} value={fTp2} onChange={(e) => setFTp2(e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <span className={labelCls}>TP3</span>
            <input className={inputCls} value={fTp3} onChange={(e) => setFTp3(e.target.value)} inputMode="decimal" />
          </div>
          <div className="flex items-end">
            <button
              onClick={submitForm}
              disabled={createMutation.isPending}
              className="w-full px-3 py-2 rounded-lg font-mono text-[11px] uppercase tracking-wider bg-[#0077B6] text-white hover:bg-[#0089CE] disabled:opacity-50 transition-colors"
            >
              {t("ts.post")}
            </button>
          </div>
        </div>
      )}

      {/* Member settings row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 rounded-xl bg-[#0A1628] border border-white/8">
        <div>
          <span className={labelCls}>{t("ts.risk")}</span>
          <input
            className={inputCls}
            value={riskPct}
            onChange={(e) => saveRisk(e.target.value)}
            onBlur={() => saveRisk(String(clampRisk(Number(riskPct))))}
            inputMode="decimal"
          />
        </div>
        <div>
          <span className={labelCls}>{t("ts.account")}</span>
          <Select value={accountSel} onValueChange={saveAccount}>
            <SelectTrigger className="h-[38px] bg-[#0A1628] border-white/10 text-white font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0D1E35] border-white/10 text-white">
              {activeAccounts.map((a) => (
                <SelectItem key={a.id} value={String(a.id)} className="font-mono text-xs">
                  {a.name} · {a.currency}
                </SelectItem>
              ))}
              <SelectItem value={MANUAL} className="font-mono text-xs">
                {t("ts.accountManual")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <span className={labelCls}>{t("ts.broker")}</span>
          <Select value={brokerSel} onValueChange={saveBroker}>
            <SelectTrigger className="h-[38px] bg-[#0A1628] border-white/10 text-white font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0D1E35] border-white/10 text-white">
              {BROKER_NAMES.map((b) => (
                <SelectItem key={b} value={b} className="font-mono text-xs">
                  {b}
                </SelectItem>
              ))}
              <SelectItem value={OTHER_BROKER} className="font-mono text-xs">
                {t("ts.brokerOther")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <span className={labelCls}>
            {t("ts.balance")} ({currency})
            {!pickedAccount && (
              <span className="ml-2 inline-flex gap-1 align-middle">
                {(["USD", "EUR"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => saveManualCur(c)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-all ${
                      manualCur === c
                        ? "bg-[#0077B6]/20 border-[#0077B6] text-[#48CAE4]"
                        : "bg-white/5 border-white/10 text-[#6E8AA8]"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </span>
            )}
          </span>
          <input
            className={inputCls}
            value={manualBalance}
            onChange={(e) => setManualBalance(e.target.value)}
            placeholder={
              pickedAccount && Number.isFinite(snapshotBalance) && snapshotBalance > 0
                ? String(snapshotBalance)
                : "10000"
            }
            inputMode="decimal"
          />
        </div>
        <div className="flex items-end pb-1">
          <p className="font-mono text-[10px] text-[#4A6080] leading-snug">
            {Number.isFinite(balance) && balance > 0
              ? `${fmtMoney(balance, currency)} · ${risk}%  →  ${fmtMoney(balance * (risk / 100), currency)}`
              : t("ts.setBalance")}
          </p>
        </div>
      </div>

      {/* Signal cards */}
      {signalsQuery.isLoading ? (
        <p className="font-mono text-xs text-[#6E8AA8] py-4 text-center">…</p>
      ) : signals.length === 0 ? (
        <p className="font-mono text-xs text-[#6E8AA8] py-4 text-center">{t("ts.empty")}</p>
      ) : (
        <div className="space-y-3">
          {signals.map((s) => {
            const inst = findInstrument(s.symbol);
            const needsCs = inst ? inst.category === "indices" || inst.category === "crypto" || inst.category === "energy" : false;
            const csRaw = inst ? (csOverrides[s.symbol] ?? "") : "";
            const csNum = Number(csRaw.replace(",", "."));
            const brokerPreset = needsCs ? BROKER_PRESETS[brokerSel]?.[s.symbol] : undefined;
            const contractSize = inst
              ? (needsCs && brokerSel === OTHER_BROKER && csRaw.trim() !== "" && Number.isFinite(csNum) && csNum > 0
                  ? csNum
                  : (brokerPreset ?? inst.contractSize))
              : 0;
            const isActive = s.status === "active";
            const isBuy = s.direction === "BUY";
            const entryNum = s.entry !== null ? Number(s.entry) : Number(priceNow[s.id] ?? "");
            const slNum = Number(s.sl);
            const hasEntry = Number.isFinite(entryNum) && entryNum > 0;

            let lot: number | null = null;
            let risked: number | null = null;
            let usedStatic = false;
            let pips: string | null = null;
            if (inst && hasEntry) {
              const dist = Math.abs(entryNum - slNum) / inst.pipSize;
              pips = `${dist.toLocaleString("en-US", { maximumFractionDigits: 1 })} ${inst.pipLabel}`;
              if (Number.isFinite(balance) && balance > 0) {
                try {
                  const conv = resolveConversionRate({
                    baseCurrency: inst.baseCurrency,
                    quoteCurrency: inst.quoteCurrency,
                    account: currency,
                    entry: entryNum,
                    liveUsdPerUnit,
                  });
                  const r = computePosition({
                    balance,
                    accountCurrency: currency,
                    riskMode: "percent",
                    riskPercent: risk,
                    riskAmount: 0,
                    entry: entryNum,
                    stopLoss: slNum,
                    contractSize,
                    quoteCurrency: inst.quoteCurrency,
                    pipSize: inst.pipSize,
                    conversionRate: conv.rate,
                    usedStaticRate: conv.usedStaticRate,
                  });
                  // NEVER round a lot up.
                  lot = floorLot(r.lotSizeRaw, 2);
                  risked = r.moneyRisked;
                  usedStatic = r.usedStaticRate;
                } catch (e) {
                  void e; // e.g. SL == entry — leave lot null
                }
              }
            }

            return (
              <div
                key={s.id}
                className={`p-4 rounded-xl border transition-all ${
                  isActive ? "bg-[#0A1628] border-white/10" : "bg-[#0A1628]/50 border-white/5 opacity-55"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  {/* left: symbol / direction / prices */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold tracking-wider ${
                          isBuy ? "bg-[#00897B]/15 text-[#00897B]" : "bg-[#E94F37]/15 text-[#E94F37]"
                        }`}
                      >
                        {isBuy ? "▲ BUY" : "▼ SELL"}
                      </span>
                      <span className="font-['Space_Grotesk'] text-base font-semibold text-white">{s.symbol}</span>
                      {!isActive && (
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-wider bg-white/10 text-[#6E8AA8]">
                          {s.status === "closed" ? t("ts.closed") : t("ts.cancelled")}
                        </span>
                      )}
                      <span className="font-mono text-[10px] text-[#4A6080]">
                        {timeAgo(s.postedAt, t("ts.ago"), t("ts.justNow"))}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 flex-wrap font-mono text-xs">
                      <span className="text-[#6E8AA8]">
                        {t("ts.entry")}:{" "}
                        <span className="text-white">{s.entry !== null ? fmtPrice(s.entry) : t("ts.market")}</span>
                      </span>
                      <span className="text-[#6E8AA8]">
                        SL: <span className="text-[#E94F37]">{fmtPrice(s.sl)}</span>
                        {pips && <span className="text-[#4A6080]"> ({pips})</span>}
                      </span>
                      {[s.tp1, s.tp2, s.tp3].map((tp, i) =>
                        tp !== null ? (
                          <span key={i} className="text-[#6E8AA8]">
                            TP{i + 1}: <span className="text-[#00897B]">{fmtPrice(tp)}</span>
                          </span>
                        ) : null,
                      )}
                    </div>
                    {/* Broker-specific contract size (indices / crypto only) */}
                    {inst && needsCs && brokerSel === OTHER_BROKER && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] text-[#6E8AA8]">{t("ts.csLabel")}:</span>
                        <input
                          className="w-20 bg-[#0D1E35] border border-white/10 rounded px-2 py-1 font-mono text-xs text-white focus:outline-none focus:border-[#0077B6]"
                          value={csRaw !== "" ? csRaw : String(inst.contractSize)}
                          onChange={(e) => saveCs(s.symbol, e.target.value)}
                          inputMode="decimal"
                        />
                        <span className="font-mono text-[9px] text-[#4A6080]">{t("ts.csHint")}</span>
                      </div>
                    )}
                    {/* Market entry with no price yet → ask for current price */}
                    {inst && s.entry === null && isActive && !hasEntry && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="font-mono text-[10px] text-[#F4A261]">{t("ts.needPrice")}</span>
                        <input
                          className="w-28 bg-[#0D1E35] border border-white/10 rounded px-2 py-1 font-mono text-xs text-white focus:outline-none focus:border-[#0077B6]"
                          placeholder={t("ts.priceNow")}
                          value={priceNow[s.id] ?? ""}
                          onChange={(e) => setPriceNow((m) => ({ ...m, [s.id]: e.target.value }))}
                          inputMode="decimal"
                        />
                      </div>
                    )}
                    {inst && s.entry === null && isActive && hasEntry && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="font-mono text-[10px] text-[#6E8AA8]">{t("ts.priceNow")}:</span>
                        <input
                          className="w-28 bg-[#0D1E35] border border-white/10 rounded px-2 py-1 font-mono text-xs text-white focus:outline-none focus:border-[#0077B6]"
                          value={priceNow[s.id] ?? ""}
                          onChange={(e) => setPriceNow((m) => ({ ...m, [s.id]: e.target.value }))}
                          inputMode="decimal"
                        />
                      </div>
                    )}
                  </div>

                  {/* right: THE lot */}
                  <div className="text-right shrink-0">
                    {!inst ? (
                      <p className="font-mono text-[11px] text-[#F4A261]">{t("ts.unsupported")}</p>
                    ) : lot !== null ? (
                      <>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-[#6E8AA8]">
                          {t("ts.yourLot")}
                        </p>
                        <p className="font-['Space_Grotesk'] text-3xl font-bold text-[#48CAE4] leading-tight">
                          {lot.toFixed(2)}
                        </p>
                        {risked !== null && (
                          <p className="font-mono text-[10px] text-[#6E8AA8]">
                            {t("ts.risked")} {fmtMoney(risked, currency)}
                          </p>
                        )}
                        {usedStatic && (
                          <p className="font-mono text-[10px] text-[#F4A261] flex items-center gap-1 justify-end">
                            <TriangleAlert size={10} /> {t("ts.estimatedRate")}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="font-mono text-[10px] text-[#4A6080] max-w-[140px]">
                        {Number.isFinite(balance) && balance > 0 ? "—" : t("ts.setBalance")}
                      </p>
                    )}
                    {isAdmin && isActive && (
                      <button
                        onClick={() => closeMutation.mutate({ id: s.id, status: "closed" })}
                        className="mt-1.5 px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-wider bg-white/5 border border-white/10 text-[#6E8AA8] hover:text-white transition-colors"
                      >
                        {t("ts.closeAction")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
