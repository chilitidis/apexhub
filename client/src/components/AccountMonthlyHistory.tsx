/**
 * Inline monthly-history strip for an Accounts page card.
 *
 * Loads every saved monthly snapshot for a single account via
 * `trpc.journal.listSnapshots`, sorts newest-first, and renders a compact
 * row per month with: month label · # trades · win rate · net result · net %.
 *
 * Each row is a button that navigates the user to that account's journal
 * with a `?month=YYYY-MM` query so Home auto-loads the matching snapshot.
 *
 * Designed to fit inside the existing AccountCard without breaking its
 * fixed-height grid look — when collapsed the card stays unchanged; when
 * expanded the strip simply slides into the bottom of the card.
 */
import React, { useMemo } from "react";
void React;
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import type { MonthSnapshot } from "@/hooks/useJournal";
import { monthSortValue } from "@/lib/monthlyHistory";
import { fmtUSDnoSign, fmtPct } from "@/lib/trading";
import { CalendarDays, Loader2, Plus } from "lucide-react";

interface Props {
  accountId: number;
  /** Show inline (when accordion expanded). Defaults to true. */
  visible?: boolean;
  /** Optional currency for amount display. Defaults to "USD". */
  currency?: string;
}

interface Row {
  key: string;
  monthName: string;
  yearShort: string;
  yearFull: string;
  totalTrades: number;
  winRate: number;
  netResult: number;
  netPct: number;
  ending: number;
}

function rowFromSnapshot(s: {
  monthKey: string;
  monthName: string;
  yearFull: string;
  yearShort: string;
  totalTrades: number;
  winRate: number;
  netResult: number;
  returnPct: number;
  ending: number;
}): Row {
  return {
    key: s.monthKey,
    monthName: s.monthName,
    yearShort: s.yearShort,
    yearFull: s.yearFull,
    totalTrades: Number(s.totalTrades) || 0,
    winRate: Number(s.winRate) || 0,
    netResult: Number(s.netResult) || 0,
    netPct: Number(s.returnPct) || 0,
    ending: Number(s.ending) || 0,
  };
}

export default function AccountMonthlyHistory({ accountId, visible = true, currency = "USD" }: Props) {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const query = trpc.journal.listSnapshots.useQuery(
    { accountId },
    { enabled: visible && Number.isFinite(accountId) && accountId > 0, refetchOnWindowFocus: false },
  );

  const rows = useMemo<Row[]>(() => {
    if (!query.data) return [];
    return query.data
      .map((r) => rowFromSnapshot(r as Parameters<typeof rowFromSnapshot>[0]))
      .sort((a, b) =>
        monthSortValue({ key: b.key, month_name: b.monthName, year_full: b.yearFull }) -
        monthSortValue({ key: a.key, month_name: a.monthName, year_full: a.yearFull })
      );
  }, [query.data]);

  if (!visible) return null;

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 px-1 py-3 text-[#8E8A82] font-mono text-[11px]">
        <Loader2 size={12} className="animate-spin" />
        <span>{t("amh.loading")}</span>
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="px-1 py-3 text-[#E5484D] font-mono text-[11px]">
        {t("amh.loadError")}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div data-testid="account-monthly-history" className="mt-4 border-t border-white/8 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8A82]">
            Monthly History
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLocation(`/account/${accountId}?action=new-month`);
            }}
            data-testid="account-monthly-history-new"
            title={t("amh.newMonthTitle")}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#C9A24A]/15 border border-[#C9A24A]/40 hover:bg-[#C9A24A]/25 hover:border-[#C9A24A]/60 text-[#E6C873] hover:text-white font-mono text-[9px] uppercase tracking-widest transition-colors"
          >
            <Plus size={10} />
            New Month
          </button>
        </div>
        <div className="flex items-center gap-2 px-1 py-3 text-[#8E8A82] font-mono text-[11px]">
          <CalendarDays size={12} />
          <span>{t("amh.empty")}</span>
        </div>
      </div>
    );
  }

  const fmtMoney = (n: number) => {
    try {
      return n.toLocaleString("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      });
    } catch {
      return fmtUSDnoSign(n);
    }
  };

  const onOpenMonth = (rowKey: string) => {
    setLocation(`/account/${accountId}?month=${encodeURIComponent(rowKey)}`);
  };

  const onNewMonth = () => {
    setLocation(`/account/${accountId}?action=new-month`);
  };

  return (
    <div data-testid="account-monthly-history" className="mt-4 border-t border-white/8 pt-3 space-y-1.5">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8A82]">
          Monthly History
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-[#8E8A82]">{rows.length} {t("amh.monthsSuffix")}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNewMonth();
            }}
            data-testid="account-monthly-history-new"
            title={t("amh.newMonthTitle")}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#C9A24A]/15 border border-[#C9A24A]/40 hover:bg-[#C9A24A]/25 hover:border-[#C9A24A]/60 text-[#E6C873] hover:text-white font-mono text-[9px] uppercase tracking-widest transition-colors"
          >
            <Plus size={10} />
            New Month
          </button>
        </div>
      </div>

      <div className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
        {rows.map((r) => {
          const isUp = r.netResult >= 0;
          return (
            <button
              key={r.key}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenMonth(r.key);
              }}
              className="w-full flex items-center justify-between gap-3 px-2 py-1.5 rounded-md bg-[#0A0A0B] border border-white/5 hover:border-white/15 hover:bg-[#0A0A0B]/80 transition-colors text-left"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-['Inter'] font-semibold text-xs text-white truncate">
                  {r.monthName.slice(0, 3)} '{r.yearShort}
                </span>
                <span className="font-mono text-[9px] text-[#8E8A82] uppercase tracking-widest mt-0.5">
                  {r.totalTrades} trades · WR {r.winRate.toFixed(0)}%
                </span>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span
                  className={`font-mono font-semibold text-xs ${isUp ? "text-[#3FB68B]" : "text-[#E5484D]"}`}
                >
                  {isUp ? "+" : "-"}
                  {fmtMoney(Math.abs(r.netResult))}
                </span>
                <span
                  className={`font-mono text-[9px] mt-0.5 ${isUp ? "text-[#3FB68B]/80" : "text-[#E5484D]/80"}`}
                >
                  {fmtPct(r.netPct)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
