import { Loader2, Share2 } from "lucide-react";
import { useRoute } from "wouter";

import { trpc } from "@/lib/trpc";
import { fmtPct, fmtUSD } from "@/lib/trading";

/**
 * Public share view — rendered at `/s/:token`. Anyone (signed-in or not)
 * can load this URL and see the snapshot that the trader created via the
 * Share Card dialog.
 *
 * Round-3 redesign mirrors the in-app Share Card:
 *   - % hero (no $ figure)
 *   - No starting / ending balance
 *   - Richer KPI grid (win rate, profit factor, avg R, max drawdown,
 *     best / worst trade)
 *   - Full trade table (every trade in the snapshot)
 */
export default function ShareView() {
  const [, params] = useRoute<{ token: string }>("/s/:token");
  const token = params?.token || "";
  const { data, isLoading, error } = trpc.share.view.useQuery(
    { token },
    { enabled: token.length > 0, retry: false },
  );

  if (!token) {
    return <NotFoundState />;
  }
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070F1C] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#6E8AA8]" />
      </div>
    );
  }
  if (error || !data) {
    return <NotFoundState />;
  }

  const { payload } = data;
  const accent = payload.accountColor || "#0094C6";
  const isPos = payload.returnPct >= 0;

  const profitFactorText =
    typeof payload.profitFactor !== "number" ||
    !Number.isFinite(payload.profitFactor) ||
    payload.profitFactor === 0
      ? "—"
      : payload.profitFactor.toFixed(2);

  const avgR = typeof payload.avgR === "number" ? payload.avgR : 0;
  const maxDrawdownPct =
    typeof payload.maxDrawdownPct === "number" ? payload.maxDrawdownPct : 0;

  return (
    <div className="min-h-screen bg-[#070F1C] text-white font-['Space_Grotesk']">
      <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-10">
        {/* Top nav */}
        <div className="flex items-center justify-between mb-8">
          <a
            href="/"
            className="flex items-center gap-2 text-[#6E8AA8] hover:text-white transition"
          >
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663576082454/8kEKtsKWxF9JiwbjRbrvBM/utj-logo-badge-N5NDtvx9GcDyhxwM7gRvFA.webp"
              alt=""
              className="w-8 h-8 rounded-md"
            />
            <div>
              <div className="font-semibold text-sm text-white">
                ULTIMATE TRADING JOURNAL
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#6E8AA8]">
                ultimatradingjournal.com
              </div>
            </div>
          </a>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#6E8AA8] flex items-center gap-2">
            <Share2 size={12} /> Shared snapshot · {data.views} views
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl border border-white/10 overflow-hidden shadow-2xl"
          style={{
            background:
              "linear-gradient(145deg, #0A1628 0%, #0D1E35 60%, #061020 100%)",
          }}
        >
          <div className="p-6 sm:p-10">
            {/* Account chip */}
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
              style={{
                background: `${accent}1E`,
                border: `1px solid ${accent}55`,
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: accent }}
              />
              <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-white font-semibold">
                {payload.accountName}
              </span>
              {payload.accountType && (
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#6E8AA8] border-l border-white/10 pl-2 ml-1">
                  {payload.accountType}
                </span>
              )}
            </div>

            {/* Hero — % only, no $ */}
            <div className="mb-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#6E8AA8] mb-2">
                {payload.monthLabel || "Snapshot"} · Net return
              </div>
              <div
                className="font-mono text-[56px] sm:text-[96px] font-bold leading-none tracking-tight"
                style={{ color: isPos ? "#00897B" : "#E94F37" }}
              >
                {fmtPct(payload.returnPct)}
              </div>
              <div className="mt-2 font-mono text-xs sm:text-sm text-[#6E8AA8]">
                {payload.totalTrades} trades · {payload.wins}W ·{" "}
                {payload.losses}L
              </div>
            </div>

            {/* KPI grid — richer, no Starting/Ending */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
              <PublicKpi
                label="Win rate"
                value={`${(payload.winRate * 100).toFixed(0)}%`}
              />
              <PublicKpi label="Profit factor" value={profitFactorText} />
              <PublicKpi label="Avg R" value={avgR.toFixed(2)} />
              <PublicKpi
                label="Max drawdown"
                value={fmtPct(-Math.abs(maxDrawdownPct))}
                accent="#E94F37"
              />
              <PublicKpi
                label="Best trade"
                value={fmtUSD(payload.bestTradeUsd ?? 0)}
                sub={payload.bestSymbol || ""}
                accent="#00897B"
              />
              <PublicKpi
                label="Worst trade"
                value={fmtUSD(payload.worstTradeUsd ?? 0)}
                sub={payload.worstSymbol || ""}
                accent="#E94F37"
              />
            </div>

            {/* Full trade table */}
            {payload.trades.length > 0 && (
              <div className="border-t border-white/8 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#6E8AA8]">
                    All trades
                  </div>
                  <div className="font-mono text-[10px] text-[#4A6080]">
                    {payload.trades.length} total
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <div
                    className="grid gap-2 px-3 py-2 border-b border-white/5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#4A6080] min-w-[520px]"
                    style={{
                      gridTemplateColumns: "40px 1.4fr 0.7fr 0.9fr 1fr",
                    }}
                  >
                    <span>#</span>
                    <span>Symbol</span>
                    <span>Side</span>
                    <span className="text-right">Net %</span>
                    <span className="text-right">Net $</span>
                  </div>
                  <div className="flex flex-col mt-1 min-w-[520px]">
                    {payload.trades.map((t, i) => (
                      <div
                        key={i}
                        className="grid gap-2 px-3 py-1.5 items-center rounded"
                        style={{
                          gridTemplateColumns: "40px 1.4fr 0.7fr 0.9fr 1fr",
                          background:
                            i % 2 === 0
                              ? "rgba(255,255,255,0.025)"
                              : "transparent",
                        }}
                      >
                        <span className="font-mono text-[10px] text-[#4A6080]">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="font-mono text-[12px] font-semibold text-white">
                          {t.symbol}
                        </span>
                        <span
                          className={`font-mono text-[9px] px-1.5 py-0.5 rounded w-fit ${
                            t.direction === "BUY"
                              ? "bg-[#00897B]/20 text-[#00897B]"
                              : "bg-[#E94F37]/20 text-[#E94F37]"
                          }`}
                        >
                          {t.direction}
                        </span>
                        <span
                          className={`font-mono text-[12px] font-semibold text-right ${
                            t.pnl >= 0 ? "text-[#00897B]" : "text-[#E94F37]"
                          }`}
                        >
                          {fmtPct(t.netPct ?? 0)}
                        </span>
                        <span
                          className={`font-mono text-[12px] font-semibold text-right ${
                            t.pnl >= 0 ? "text-[#00897B]" : "text-[#E94F37]"
                          }`}
                        >
                          {fmtUSD(t.pnl)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-br from-[#0094C6] to-[#005377] rounded-lg font-mono text-[11px] font-semibold uppercase tracking-widest text-white shadow hover:opacity-90 transition"
          >
            Build your own journal →
          </a>
          <div className="mt-4 font-mono text-[10px] uppercase tracking-widest text-[#4A6080]">
            Snapshot created {new Date(data.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}

function PublicKpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-white/[0.025] border border-white/6 rounded-xl px-4 py-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#6E8AA8] mb-1">
        {label}
      </div>
      <div
        className="font-mono text-xl font-semibold"
        style={{ color: accent || "#fff" }}
      >
        {value}
      </div>
      {sub && (
        <div className="font-mono text-[10px] text-[#6E8AA8] mt-1">{sub}</div>
      )}
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="min-h-screen bg-[#070F1C] flex items-center justify-center text-white">
      <div className="text-center">
        <div className="font-['Bebas_Neue'] text-5xl tracking-wide mb-3">
          Share not found
        </div>
        <div className="font-mono text-sm text-[#6E8AA8] mb-6">
          This snapshot may have been deleted or the link is invalid.
        </div>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-br from-[#0094C6] to-[#005377] rounded-lg font-mono text-[11px] font-semibold uppercase tracking-widest text-white shadow hover:opacity-90 transition"
        >
          Go home
        </a>
      </div>
    </div>
  );
}
