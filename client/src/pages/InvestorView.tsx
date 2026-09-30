import { Activity, Loader2, LockKeyhole, Scale, Target, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useRoute } from "wouter";

import { useLanguage } from "@/contexts/LanguageContext";
import { APEX_LOGO } from "@/lib/apexLogo";
import { fmtPct } from "@/lib/trading";
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
  const { t, lang } = useLanguage();
  // Embed mode (?embed=1): fixed, non-scrollable layout for PowerPoint/iframe embedding.
  const embed =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("embed");

  useEffect(() => {
    if (!embed) return;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }, [embed]);

  // Auto-fit: scale the whole layout down so it always fits the embed viewport
  // (PowerPoint add-in frames have no zoom controls of their own).
  const fitRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);

  const { data, isLoading, error } = trpc.investor.data.useQuery(
    { token },
    { enabled: token.length > 0, retry: false, refetchInterval: 60_000 },
  );

  const months = data?.months ?? [];

  useEffect(() => {
    if (!embed) return;
    const recompute = () => {
      setFit(1);
      requestAnimationFrame(() => {
        const el = fitRef.current;
        if (!el) return;
        const s2 = Math.min(1, window.innerHeight / el.scrollHeight);
        setFit(s2 < 0.995 ? s2 : 1);
      });
    };
    recompute();
    const t = setTimeout(recompute, 300);
    window.addEventListener("resize", recompute);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", recompute);
    };
  }, [embed, data]);

  const allTrades = (data?.trades ?? []) as InvestorTrade[];

  const trades = allTrades;

  const kpis = useMemo(() => {
    const wins = trades.filter((tr) => tr.pnl > 0);
    const losses = trades.filter((tr) => tr.pnl < 0);
    const grossWin = wins.reduce((s, tr) => s + tr.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, tr) => s + tr.pnl, 0));
    const netResult = months.reduce((s, m) => s + m.netResult, 0);
    return {
      netResult,
      // % follows the per-trade NET % convention (sum), same as the journal.
      returnPct: trades.reduce((s, tr) => s + (tr.netPct || 0), 0),
      winRate: trades.length > 0 ? wins.length / trades.length : 0,
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
      count: trades.length,
      wins: wins.length,
      losses: losses.length,
    };
  }, [trades, months]);

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

  // Overall-growth series: each month's % is the SUM of the per-trade NET %
  // for that month (journal convention), and the line is the running sum.
  const monthNetPct = new Map<string, number>();
  for (const tr of trades) {
    monthNetPct.set(tr.monthKey, (monthNetPct.get(tr.monthKey) || 0) + (tr.netPct || 0));
  }
  let cum = 0;
  const growthData = months.map((m) => {
    const bar = monthNetPct.get(m.monthKey) || 0;
    cum += bar;
    return { label: monthLabel(m.monthKey, lang), bar, cum };
  });
  const overallPct = cum;
  const avgMonthlyPct = months.length > 0 ? overallPct / months.length : 0;

  return (
    <div className="min-h-screen bg-[#070F1C] text-white font-['Space_Grotesk']">
      <div
        ref={fitRef}
        style={embed ? { transform: `scale(${fit})`, transformOrigin: "top left", width: `${(100 / fit).toFixed(4)}%` } : undefined}
        className={embed ? "max-w-none px-5 py-3" : "max-w-[1080px] mx-auto px-4 sm:px-6 py-10"}
      >
        {/* Header */}
        <div className={`flex flex-wrap items-center justify-between gap-3 ${embed ? "mb-4" : "mb-8"}`}>
          <div className="flex items-center gap-3 min-w-0">
            <img src={APEX_LOGO} alt="" className="w-9 h-9 rounded-md" />
            <div className="min-w-0">
              <div className="font-semibold text-lg truncate">
                {data.account.name}
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

        {/* KPI grid — four journal-style accent cards */}
        <div className={embed ? "grid grid-cols-4 gap-3 mb-3" : "grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8"}>
          <IKpi
            label="▲ Net Result"
            value={fmtPct(kpis.returnPct)}
            sub="Growth"
            accent={kpis.netResult >= 0 ? "#00897B" : "#E94F37"}
            icon={kpis.netResult >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            valueClass={kpis.netResult >= 0 ? "text-[#00897B]" : "text-[#E94F37]"}
          />
          <IKpi
            label={"◈ " + t("iv.winRate")}
            value={`${(kpis.winRate * 100).toFixed(1)}%`}
            sub={`${kpis.wins}W / ${kpis.losses}L`}
            accent="#F4A261"
            icon={<Target size={12} />}
          />
          <IKpi
            label={"◆ " + t("iv.profitFactor")}
            value={kpis.profitFactor === null ? "—" : kpis.profitFactor.toFixed(2)}
            sub="Gross win / gross loss"
            accent="#0077B6"
            icon={<Scale size={12} />}
          />
          <IKpi
            label={"■ " + t("iv.trades")}
            value={String(kpis.count)}
            sub="Executed · closed"
            accent="#5E60CE"
            icon={<Activity size={12} />}
          />
        </div>

        {/* Overall growth — journal-style line + monthly % bars */}
        {months.length > 0 && (
          <div className={`bg-[#0D1E35]/80 border border-white/8 rounded-2xl ${embed ? "p-3 mb-0" : "p-5 mb-8"}`}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#4A6080] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#0077B6]" />
                  Overall Growth — {months.length} of {months.length} months
                </div>
                <div className={`font-mono text-2xl font-semibold mt-1 ${overallPct >= 0 ? "text-[#00897B]" : "text-[#E94F37]"}`}>
                  {overallPct >= 0 ? "+" : ""}{overallPct.toFixed(2)}%
                </div>
              </div>
            </div>
            <div className={embed ? "h-32" : "h-44"}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ivGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0077B6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0077B6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "#4A6080", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#4A6080", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v.toFixed(0) + "%"} />
                  <Tooltip content={<PctTip />} />
                  <Area type="monotone" dataKey="cum" stroke="#0077B6" strokeWidth={2} fill="url(#ivGrad)" dot={{ r: 3, fill: "#0077B6" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className={embed ? "h-16 mt-2" : "h-28 mt-2"}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={growthData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "#4A6080", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#4A6080", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v.toFixed(0) + "%"} />
                  <Tooltip content={<PctTip />} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                  <Bar dataKey="bar" radius={[3, 3, 0, 0]}>
                    {growthData.map((g, i2) => (
                      <Cell key={i2} fill={g.bar >= 0 ? "#00897B" : "#E94F37"} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {!embed && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5 font-mono text-[10px] uppercase tracking-widest">
              <span className="text-[#4A6080]">AVG / MONTH · {months.length} months</span>
              <span className={avgMonthlyPct >= 0 ? "text-[#00897B]" : "text-[#E94F37]"}>
                {avgMonthlyPct >= 0 ? "+" : ""}{avgMonthlyPct.toFixed(2)}%
              </span>
            </div>
            )}
          </div>
        )}

        {/* Footer (hidden in embed mode) */}
        {!embed && (
          <div className="mt-8 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-[#4A6080]">
            ULTIMATE TRADING JOURNAL · ultimatradingjournal.com
          </div>
        )}
      </div>
    </div>
  );
}

function monthLabel(key: string, lang: "en" | "el"): string {
  const [y, mo] = key.split("-").map(Number);
  const d = new Date(y || 2026, (mo || 1) - 1, 1);
  const mon = d
    .toLocaleDateString(lang === "el" ? "el-GR" : "en-US", { month: "short" })
    .replace(".", "")
    .toUpperCase();
  return `${mon} '${String(y || 0).slice(2)}`;
}

const PctTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const v = Number(payload[0]?.value ?? 0);
  return (
    <div className="bg-[#0D1E35] border border-white/10 rounded-lg p-3 shadow-xl text-xs">
      <div className="text-[#4A6080] mb-1 font-mono uppercase tracking-wider">{label}</div>
      <div className="font-mono font-semibold" style={{ color: v >= 0 ? "#00897B" : "#E94F37" }}>
        {v >= 0 ? "+" : ""}{v.toFixed(2)}%
      </div>
    </div>
  );
};

function IKpi({
  label,
  value,
  sub,
  accent,
  icon,
  valueClass = "text-white",
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
  icon?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div
      className="relative bg-[#0D1E35]/80 border border-white/8 rounded-xl p-4 backdrop-blur-sm overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(135deg, ${accent}1f 0%, ${accent}08 38%, transparent 70%)`,
      }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl" style={{ background: accent }} />
      <div
        className="absolute -right-6 -top-6 w-20 h-20 rounded-full blur-2xl pointer-events-none"
        style={{ background: `${accent}22` }}
      />
      <div className="relative flex items-start justify-between mb-2">
        <div className="text-[#4A6080] font-mono text-[9px] uppercase tracking-[0.15em]">{label}</div>
        {icon && (
          <div
            className="flex items-center justify-center w-6 h-6 rounded-md"
            style={{ background: `${accent}1f`, color: accent }}
          >
            {icon}
          </div>
        )}
      </div>
      <div className={`relative font-mono text-xl font-semibold leading-tight ${valueClass}`}>{value}</div>
      {sub && <div className="relative font-mono text-[10px] text-[#4A6080] mt-1.5">{sub}</div>}
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
