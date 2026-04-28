import { Loader2, Share2 } from "lucide-react";
import { useRoute } from "wouter";

import { trpc } from "@/lib/trpc";
import { fmtPct, fmtUSD } from "@/lib/trading";

/**
 * Public share view — rendered at `/s/:token`.
 *
 * Round-4 additions:
 *   - Theme-aware: the payload now carries `theme: "light" | "dark"`, so
 *     the public page renders in the same palette the trader used when
 *     they hit Share. Falls back to dark for legacy snapshots.
 *   - Big Bebas-Neue month label on the hero fills the old empty right-
 *     hand gap next to the % figure.
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

  // Resolve palette early so the loading/404 states also honour the active
  // theme of the app shell (defaults to dark when we don't know yet).
  const theme: "light" | "dark" = data?.payload?.theme ?? "dark";
  const palette = getPalette(theme);

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: palette.pageBg }}
      >
        <Loader2 size={24} className="animate-spin" style={{ color: palette.muted }} />
      </div>
    );
  }
  if (error || !data) {
    return <NotFoundState />;
  }

  const { payload } = data;
  const accent = payload.accountColor || palette.accent;
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

  // Derive hero month / year pieces from the stored monthLabel (e.g.
  // "ΑΠΡΙΛΙΟΣ '26" -> month="ΑΠΡΙΛΙΟΣ", year="'26").
  const { monthHero, yearShort } = splitMonthLabel(payload.monthLabel);

  return (
    <div
      className="min-h-screen font-['Space_Grotesk']"
      style={{ background: palette.pageBg, color: palette.fg }}
    >
      <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-10">
        {/* Top nav */}
        <div className="flex items-center justify-between mb-8">
          <a
            href="/"
            className="flex items-center gap-2 transition"
            style={{ color: palette.muted }}
          >
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663576082454/8kEKtsKWxF9JiwbjRbrvBM/utj-logo-badge-N5NDtvx9GcDyhxwM7gRvFA.webp"
              alt=""
              className="w-8 h-8 rounded-md"
            />
            <div>
              <div
                className="font-semibold text-sm"
                style={{ color: palette.fg }}
              >
                ULTIMATE TRADING JOURNAL
              </div>
              <div
                className="font-mono text-[9px] uppercase tracking-[0.2em]"
                style={{ color: palette.muted }}
              >
                ultimatradingjournal.com
              </div>
            </div>
          </a>
          <div
            className="font-mono text-[10px] uppercase tracking-widest flex items-center gap-2"
            style={{ color: palette.muted }}
          >
            <Share2 size={12} /> Shared snapshot · {data.views} views
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl overflow-hidden shadow-2xl"
          style={{
            background: palette.cardGradient,
            border: `1px solid ${palette.border}`,
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
              <span
                className="font-mono text-[11px] uppercase tracking-[0.15em] font-semibold"
                style={{ color: palette.fg }}
              >
                {payload.accountName}
              </span>
              {payload.accountType && (
                <span
                  className="font-mono text-[9px] uppercase tracking-[0.18em] pl-2 ml-1"
                  style={{
                    color: palette.muted,
                    borderLeft: `1px solid ${palette.border}`,
                  }}
                >
                  {payload.accountType}
                </span>
              )}
            </div>

            {/* Hero row — % (left) + big Bebas month label (right) */}
            <div className="grid grid-cols-1 md:grid-cols-[1.1fr,1fr] gap-6 items-end mb-8">
              <div>
                <div
                  className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2"
                  style={{ color: palette.muted }}
                >
                  {payload.monthLabel || "Snapshot"} · Net return
                </div>
                <div
                  className="font-mono text-[56px] sm:text-[96px] font-bold leading-none tracking-tight"
                  style={{ color: isPos ? palette.profit : palette.loss }}
                >
                  {fmtPct(payload.returnPct)}
                </div>
                <div
                  className="mt-2 font-mono text-xs sm:text-sm"
                  style={{ color: palette.muted }}
                >
                  {payload.totalTrades} trades · {payload.wins}W ·{" "}
                  {payload.losses}L
                </div>
              </div>

              {monthHero && (
                <div className="text-right">
                  <div
                    className="font-mono text-[10px] uppercase tracking-[0.24em] mb-2"
                    style={{ color: palette.muted }}
                  >
                    Snapshot
                  </div>
                  <div
                    className="font-['Bebas_Neue']"
                    style={{
                      fontSize: "clamp(56px, 10vw, 104px)",
                      letterSpacing: "0.02em",
                      lineHeight: 0.9,
                      color: palette.fg,
                    }}
                  >
                    {monthHero}
                  </div>
                  {yearShort && (
                    <div
                      className="font-['Bebas_Neue']"
                      style={{
                        fontSize: "clamp(32px, 5.5vw, 56px)",
                        letterSpacing: "0.05em",
                        lineHeight: 1,
                        color: accent,
                        marginTop: 4,
                      }}
                    >
                      {yearShort}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* KPI grid — richer, no Starting/Ending */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
              <PublicKpi
                palette={palette}
                label="Win rate"
                value={`${(payload.winRate * 100).toFixed(0)}%`}
              />
              <PublicKpi
                palette={palette}
                label="Profit factor"
                value={profitFactorText}
              />
              <PublicKpi
                palette={palette}
                label="Avg R"
                value={avgR.toFixed(2)}
              />
              <PublicKpi
                palette={palette}
                label="Max drawdown"
                value={fmtPct(-Math.abs(maxDrawdownPct))}
                accent={palette.loss}
              />
              <PublicKpi
                palette={palette}
                label="Best trade"
                value={fmtUSD(payload.bestTradeUsd ?? 0)}
                sub={payload.bestSymbol || ""}
                accent={palette.profit}
              />
              <PublicKpi
                palette={palette}
                label="Worst trade"
                value={fmtUSD(payload.worstTradeUsd ?? 0)}
                sub={payload.worstSymbol || ""}
                accent={palette.loss}
              />
            </div>

            {/* Full trade table */}
            {payload.trades.length > 0 && (
              <div
                className="pt-6"
                style={{ borderTop: `1px solid ${palette.border}` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="font-mono text-[10px] uppercase tracking-[0.18em]"
                    style={{ color: palette.muted }}
                  >
                    All trades
                  </div>
                  <div
                    className="font-mono text-[10px]"
                    style={{ color: palette.mutedFaded }}
                  >
                    {payload.trades.length} total
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <div
                    className="grid gap-2 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] min-w-[520px]"
                    style={{
                      gridTemplateColumns: "40px 1.4fr 0.7fr 0.9fr 1fr",
                      color: palette.mutedFaded,
                      borderBottom: `1px solid ${palette.borderFaded}`,
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
                            i % 2 === 0 ? palette.rowZebra : "transparent",
                        }}
                      >
                        <span
                          className="font-mono text-[10px]"
                          style={{ color: palette.mutedFaded }}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span
                          className="font-mono text-[12px] font-semibold"
                          style={{ color: palette.fg }}
                        >
                          {t.symbol}
                        </span>
                        <span
                          className="font-mono text-[9px] px-1.5 py-0.5 rounded w-fit font-semibold"
                          style={{
                            background:
                              t.direction === "BUY"
                                ? `${palette.profit}2E`
                                : `${palette.loss}2E`,
                            color:
                              t.direction === "BUY"
                                ? palette.profit
                                : palette.loss,
                          }}
                        >
                          {t.direction}
                        </span>
                        <span
                          className="font-mono text-[12px] font-semibold text-right"
                          style={{
                            color:
                              t.pnl >= 0 ? palette.profit : palette.loss,
                          }}
                        >
                          {fmtPct(t.netPct ?? 0)}
                        </span>
                        <span
                          className="font-mono text-[12px] font-semibold text-right"
                          style={{
                            color:
                              t.pnl >= 0 ? palette.profit : palette.loss,
                          }}
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
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg font-mono text-[11px] font-semibold uppercase tracking-widest text-white shadow hover:opacity-90 transition"
            style={{
              background:
                "linear-gradient(145deg, #0094C6 0%, #005377 100%)",
            }}
          >
            Build your own journal →
          </a>
          <div
            className="mt-4 font-mono text-[10px] uppercase tracking-widest"
            style={{ color: palette.mutedFaded }}
          >
            Snapshot created {new Date(data.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PublicPalette {
  pageBg: string;
  cardGradient: string;
  fg: string;
  muted: string;
  mutedFaded: string;
  border: string;
  borderFaded: string;
  rowZebra: string;
  profit: string;
  loss: string;
  accent: string;
}

function getPalette(theme: "light" | "dark"): PublicPalette {
  if (theme === "light") {
    return {
      pageBg: "#F5EEDC",
      cardGradient:
        "linear-gradient(145deg, #FDFAF1 0%, #F5EEDC 60%, #ECE3CC 100%)",
      fg: "#1A2436",
      muted: "#5B6B82",
      mutedFaded: "#94A3B8",
      border: "rgba(26,36,54,0.12)",
      borderFaded: "rgba(26,36,54,0.08)",
      rowZebra: "rgba(26,36,54,0.035)",
      profit: "#0F766E",
      loss: "#C2410C",
      accent: "#0077B6",
    };
  }
  return {
    pageBg: "#070F1C",
    cardGradient:
      "linear-gradient(145deg, #0A1628 0%, #0D1E35 60%, #061020 100%)",
    fg: "#FFFFFF",
    muted: "#6E8AA8",
    mutedFaded: "#4A6080",
    border: "rgba(255,255,255,0.10)",
    borderFaded: "rgba(255,255,255,0.06)",
    rowZebra: "rgba(255,255,255,0.025)",
    profit: "#00897B",
    loss: "#E94F37",
    accent: "#0094C6",
  };
}

/**
 * Splits a monthLabel like `"ΑΠΡΙΛΙΟΣ '26"` into a bold Bebas month + a
 * small year tag. Works with either curly or straight apostrophes.
 */
function splitMonthLabel(label?: string): {
  monthHero: string;
  yearShort: string;
} {
  if (!label) return { monthHero: "", yearShort: "" };
  const m = label.match(/^(.*?)[\s]*[’'](\d{2,4})$/);
  if (m) {
    return {
      monthHero: m[1].trim().toUpperCase(),
      yearShort: `’${m[2]}`,
    };
  }
  return { monthHero: label.toUpperCase(), yearShort: "" };
}

function PublicKpi({
  label,
  value,
  sub,
  accent,
  palette,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  palette: PublicPalette;
}) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{
        background: palette.rowZebra,
        border: `1px solid ${palette.borderFaded}`,
      }}
    >
      <div
        className="font-mono text-[9px] uppercase tracking-[0.2em] mb-1"
        style={{ color: palette.muted }}
      >
        {label}
      </div>
      <div
        className="font-mono text-xl font-semibold"
        style={{ color: accent || palette.fg }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="font-mono text-[10px] mt-1"
          style={{ color: palette.muted }}
        >
          {sub}
        </div>
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
