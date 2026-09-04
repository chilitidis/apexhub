import { Eye, Loader2, LockKeyhole } from "lucide-react";
import { useMemo, useState } from "react";
import { useRoute } from "wouter";

import { useLanguage } from "@/contexts/LanguageContext";
import { fmtPct, fmtR, fmtUSD } from "@/lib/trading";
import { trpc } from "@/lib/trpc";

/**
 * Public investor view — rendered at `/i/:token`.
 *
 * MT5-investor-password-style LIVE read-only dashboard for a single trading
 * account. Anyone holding the secret link sees stats, months and trades with
 * zero write ability; the owner can rotate/revoke the token at any time, at
 * which point this page collapses into a clean "link no longer active" state.
 *
 * Data auto-refreshes every 60s so an open tab tracks the journal live.
 */

type InvestorTrade = {
  monthKey: string;
  symbol: string;
  direction: "BUY" | "SELL";
  pnl: number;
  netPct: number;
  rMultiple: number | null;
  lot: number;
  closedAt: string;
};

export default function InvestorView() {
  const [, params] = useRoute<{ token: string }>("/i/:token");
  const token = params?.token || "";
  const { t } = useLanguage();
  const [period, setPeriod] = useState<string>("all");

  const { data, isLoading, error } = trpc.investor.data.useQuery(
    { token },
    { enabled: token.length > 0, retry: false, refetchInterval: 60_000 },
  );

  const months = data?.months ?? [];
  const allTrades = (data?.trades ?? []) as InvestorTrade[];

  const trades = useMemo(
    () => (period === "all" ? allTrades : allTrades.filter((tr) => tr.monthKey === period)),
    [allTrades, period],
  );

  const kpis = useMemo(() => {
    const wins = trades.filter((tr) => tr.pnl > 0);
    const losses = trades.filter((tr) => tr.pnl < 0);
    const grossWin = wins.reduce((s, tr) => s + tr.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, tr) => s + tr.pnl, 0));
    const scopedMonths = period === "all" ? months : months.filter((m) => m.monthKey === period);
    const netResult = scopedMonths.reduce((s, m) => s + m.netResult, 0);
    const starting = scopedMonths.length > 0 ? scopedMonths[0].starting : 0;
    return {
      netResult,
      returnPct: starting > 0 ? netResult / starting : 0,
      winRate: trades.length > 0 ? wins.length / trades.length : 0,
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
      count: trades.length,
      best: trades.length > 0 ? Math.max(...trades.map((tr) => tr.pnl)) : null,
      worst: trades.length > 0 ? Math.min(...trades.map((tr) => tr.pnl)) : null,
    };
  }, [trades, months, period]);

  if (!token || error || (!isLoading && !data)) {
    return <InactiveState />;
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070F1C]">
        <Loader2 size={24} className="animate-spin text-[#4A6080]" />
      </div>
    );
  }

  const currency = data.account.currency === "EUR" ? ("EUR" as const) : ("USD" as const);
  const maxAbsNet = Math.max(1, ...months.map((m) => Math.abs(m.netResult)));

  return (
    <div className="min-h-screen bg-[#070F1C] text-white font-['Space_Grotesk']">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/favicon-v3.png" alt="" className="w-9 h-9 rounded-md" />
            <div className="min-w-0">
              <div className="font-semibold text-lg truncate">
                {data.account.name}
                <span className="ml-2 font-mono text-[10px] text-[#4A6080] uppercase tracking-widest">
                  {currency}
                </span>
              </div>
              <div className="font-mono text-[9px] text-[#4A6080] uppercase tracking-[0.2em] flex items-center gap-1.5">
                <LockKeyhole size={10} /> {t("iv.readOnly")} · {t("iv.updatesAuto")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2A9D8F]/10 border border-[#2A9D8F]/40">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#2A9D8F] opacity-75 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-[#2A9D8F]" />
            </span>
            <span className="font-mono text-[10px] font-semibold tracking-[0.2em] text-[#2A9D8F]">
              {t("iv.live")}
            </span>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex flex-wrap gap-2 mb-6">
          <PeriodChip active={period === "all"} label={t("iv.overall")} onClick={() => setPeriod("all")} />
          {months.map((m) => (
            <PeriodChip
              key={m.monthKey}
              active={period === m.monthKey}
              label={m.monthKey}
              onClick={() => setPeriod(m.monthKey)}
            />
          ))}
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
          <Kpi
            label={t("iv.netResult")}
            value={fmtUSD(kpis.netResult, currency)}
            tone={kpis.netResult >= 0 ? "pos" : "neg"}
          />
          <Kpi
            label={t("iv.returnPct")}
            value={fmtPct(kpis.returnPct)}
            tone={kpis.returnPct >= 0 ? "pos" : "neg"}
          />
          <Kpi label={t("iv.winRate")} value={`${(kpis.winRate * 100).toFixed(1)}%`} />
          <Kpi label={t("iv.profitFactor")} value={kpis.profitFactor === null ? "—" : kpis.profitFactor.toFixed(2)} />
          <Kpi label={t("iv.trades")} value={String(kpis.count)} />
          <Kpi
            label={t("iv.bestTrade")}
            value={kpis.best === null ? "—" : fmtUSD(kpis.best, currency)}
            tone={kpis.best !== null && kpis.best >= 0 ? "pos" : "neg"}
          />
          <Kpi
            label={t("iv.worstTrade")}
            value={kpis.worst === null ? "—" : fmtUSD(kpis.worst, currency)}
            tone={kpis.worst !== null && kpis.worst >= 0 ? "pos" : "neg"}
          />
        </div>

        {/* Monthly growth bars */}
        {months.length > 0 && (
          <div className="bg-[#0A1628] border border-white/8 rounded-2xl p-5 mb-8">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#4A6080] mb-4">
              {t("iv.monthlyGrowth")}
            </div>
            <div className="space-y-2.5">
              {months.map((m) => {
                const pos = m.netResult >= 0;
                const width = Math.max(2, (Math.abs(m.netResult) / maxAbsNet) * 100);
                return (
                  <div key={m.monthKey} className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-[#4A6080] w-16 shrink-0">
                      {m.monthKey}
                    </span>
                    <div className="flex-1 h-3 rounded bg-[#0D1E35] overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${width}%`,
                          background: pos ? "#2A9D8F" : "#E94F37",
                        }}
                      />
                    </div>
                    <span
                      className={`font-mono text-[11px] w-28 text-right shrink-0 ${pos ? "text-[#2A9D8F]" : "text-[#E94F37]"}`}
                    >
                      {fmtUSD(m.netResult, currency)}
                      <span className="text-[#4A6080] ml-1">({fmtPct(m.returnPct)})</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Trades table */}
        <div className="bg-[#0A1628] border border-white/8 rounded-2xl p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#4A6080] mb-4 flex items-center gap-2">
            <Eye size={12} /> {t("iv.tradeHistory")}
          </div>
          {trades.length === 0 ? (
            <div className="text-[13px] text-[#4A6080] py-6 text-center">{t("iv.noTrades")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#4A6080] border-b border-white/8">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Symbol</th>
                    <th className="py-2 pr-3">Dir</th>
                    <th className="py-2 pr-3">Lot</th>
                    <th className="py-2 pr-3">P/L</th>
                    <th className="py-2 pr-3">Net %</th>
                    <th className="py-2 pr-3">R</th>
                    <th className="py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {trades
                    .slice()
                    .reverse()
                    .map((tr, i) => (
                      <tr key={`${tr.monthKey}-${i}`} className="border-b border-white/5 last:border-0">
                        <td className="py-2 pr-3 font-mono text-[10px] text-[#4A6080]">
                          {trades.length - i}
                        </td>
                        <td className="py-2 pr-3 font-semibold text-[12px]">{tr.symbol}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={`font-mono text-[9px] px-1.5 py-0.5 rounded ${
                              tr.direction === "BUY"
                                ? "bg-[#2A9D8F]/15 text-[#2A9D8F]"
                                : "bg-[#E94F37]/15 text-[#E94F37]"
                            }`}
                          >
                            {tr.direction}
                          </span>
                        </td>
                        <td className="py-2 pr-3 font-mono text-[11px] text-[#A8B5C7]">
                          {tr.lot.toFixed(2)}
                        </td>
                        <td
                          className={`py-2 pr-3 font-mono text-[11px] ${
                            tr.pnl >= 0 ? "text-[#2A9D8F]" : "text-[#E94F37]"
                          }`}
                        >
                          {fmtUSD(tr.pnl, currency)}
                        </td>
                        <td className="py-2 pr-3 font-mono text-[11px] text-[#A8B5C7]">
                          {tr.netPct !== 0 ? fmtPct(tr.netPct) : "—"}
                        </td>
                        <td className="py-2 pr-3 font-mono text-[11px] text-[#A8B5C7]">
                          {fmtR(tr.rMultiple)}
                        </td>
                        <td className="py-2 font-mono text-[10px] text-[#4A6080]">
                          {tr.closedAt || tr.monthKey}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-[#4A6080]">
          ULTIMATE TRADING JOURNAL · ultimatradingjournal.com
        </div>
      </div>
    </div>
  );
}

function PeriodChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg border font-mono text-[10px] uppercase tracking-wider transition-all ${
        active
          ? "border-[#0094C6]/70 bg-[#0094C6]/10 text-white"
          : "border-white/10 bg-[#0D1E35] text-[#A8B5C7] hover:border-white/25"
      }`}
    >
      {label}
    </button>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  const color =
    tone === "pos" ? "text-[#2A9D8F]" : tone === "neg" ? "text-[#E94F37]" : "text-white";
  return (
    <div className="bg-[#0D1E35] border border-white/8 rounded-xl p-4">
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#4A6080] mb-1.5">
        {label}
      </div>
      <div className={`font-semibold text-lg ${color}`}>{value}</div>
    </div>
  );
}

function InactiveState() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070F1C] px-4">
      <div className="max-w-md w-full bg-[#0A1628] border border-white/8 rounded-2xl p-8 text-center">
        <div className="mx-auto w-12 h-12 rounded-xl bg-[#E94F37]/10 border border-[#E94F37]/30 flex items-center justify-center text-[#E94F37] mb-4">
          <LockKeyhole size={20} />
        </div>
        <div className="font-['Space_Grotesk'] font-semibold text-white text-lg mb-1.5">
          {t("iv.inactiveTitle")}
        </div>
        <div className="text-[13px] text-[#A8B5C7]">{t("iv.inactiveDesc")}</div>
        <a
          href="/"
          className="inline-block mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-[#4A6080] hover:text-white transition"
        >
          ultimatradingjournal.com
        </a>
      </div>
    </div>
  );
}
