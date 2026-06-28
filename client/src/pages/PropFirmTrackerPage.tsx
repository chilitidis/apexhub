/**
 * PropFirmTrackerPage — Prop Firm Tracker.
 *
 * Helps a funded trader stay 100% within the rules of every prop-firm account
 * they trade. Tabs:
 *   - My Accounts: per-user list (DB-backed) of the accounts they trade, each
 *     expandable to its exact rule sheet + an AI risk briefing.
 *   - Rule Lookup: browse any firm/program rules + key trap.
 *   - Compare: side-by-side funded-stage comparison.
 *   - Risk Tools: drawdown + per-trade risk calculator.
 *   - Daily Check: pre-session compliance checklist (DB-backed).
 *   - Notes: free-form per-user notes (DB-backed).
 *
 * Shell mirrors TradingCoachPage (sidebar + Ocean Depth header). All copy goes
 * through the i18n system (EN/EL); the AI assistant replies in the active lang.
 */
import React, { useMemo, useState, useEffect, useCallback } from "react";
void React;
import { useLocation } from "wouter";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  Plus,
  Trash2,
  ChevronDown,
  Sparkles,
  Loader2,
  Send,
  ExternalLink,
  AlertTriangle,
  Building2,
  ListChecks,
  Calculator,
  GitCompareArrows,
  StickyNote,
  BookOpen,
  RotateCcw,
  X,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { AppSidebar, type ViewKey } from "@/components/AppSidebar";
import { useAccounts } from "@/hooks/useJournal";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  FIRMS,
  sizeLabelFor,
  type Firm,
  type Program,
  type StageRules,
  type Currency,
} from "@shared/propFirms";

type TabKey = "accounts" | "rules" | "compare" | "tools" | "checklist" | "notes";

// Stable checklist item ids; labels come from i18n at render time.
const CHECKLIST_ITEMS = [
  "ddKnown",
  "newsChecked",
  "lotSized",
  "weekendOk",
  "consistencyOk",
  "stopSet",
] as const;

const CHECKLIST_LABELS: Record<(typeof CHECKLIST_ITEMS)[number], { en: string; el: string }> = {
  ddKnown: {
    en: "I know my exact daily & max drawdown limits in cash",
    el: "Ξέρω τα ακριβή daily & max drawdown όριά μου σε μετρητά",
  },
  newsChecked: {
    en: "I checked the economic calendar for restricted news windows",
    el: "Έλεγξα το ημερολόγιο για restricted news windows",
  },
  lotSized: {
    en: "My lot size respects this account's leverage & risk cap",
    el: "Το lot size σέβεται τη μόχλευση & το όριο ρίσκου του account",
  },
  weekendOk: {
    en: "I confirmed the weekend-holding rule for this account",
    el: "Επιβεβαίωσα τον κανόνα weekend-holding για αυτό το account",
  },
  consistencyOk: {
    en: "I am within any consistency / best-day rule",
    el: "Είμαι εντός κάθε consistency / best-day κανόνα",
  },
  stopSet: {
    en: "A stop loss is set before entry",
    el: "Έχω βάλει stop loss πριν το entry",
  },
};

function rule(v: string | undefined, fallback: string): string {
  return v && v.trim().length > 0 ? v : fallback;
}

// ---------------------------------------------------------------- RuleTable
function RuleTable({
  firm,
  program,
  phase,
}: {
  firm: Firm;
  program: Program;
  phase: "eval" | "funded";
}) {
  const { t } = useLanguage();
  const s: StageRules = phase === "funded" ? program.funded : program.eval;
  const na = t("pf.rules.notSpecified");

  const rows: { label: string; value: string }[] = [
    { label: t("pf.rules.leverage"), value: rule(s.lev, na) },
    { label: t("pf.rules.daily"), value: rule(s.daily, na) },
    { label: t("pf.rules.max"), value: rule(s.max, na) },
    { label: t("pf.rules.target"), value: rule(s.target, na) },
    { label: t("pf.rules.minDays"), value: rule(s.mindays, na) },
    { label: t("pf.rules.consistency"), value: rule(s.consistency, na) },
    { label: t("pf.rules.hold"), value: rule(s.hold, na) },
    { label: t("pf.rules.news"), value: rule(s.news, na) },
    { label: t("pf.rules.weekend"), value: rule(s.weekend, na) },
  ];
  if (phase === "funded") {
    rows.push({ label: t("pf.rules.split"), value: rule(s.split, na) });
    rows.push({ label: t("pf.rules.payout"), value: rule(s.payout, na) });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-start justify-between gap-3 py-2 border-b border-white/5"
          >
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#6E8AA8] shrink-0 pt-0.5">
              {r.label}
            </span>
            <span
              className="text-[12px] text-[#D6E2F0] text-right leading-snug"
              dangerouslySetInnerHTML={{ __html: r.value }}
            />
          </div>
        ))}
      </div>

      {/* Key trap */}
      {s.trap && (
        <div className="flex items-start gap-2.5 rounded-lg bg-[#E94F37]/10 border border-[#E94F37]/25 p-3">
          <AlertTriangle size={15} className="text-[#E94F37] shrink-0 mt-0.5" />
          <div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#E94F37] mb-1">
              {t("pf.rules.trap")}
            </div>
            <p
              className="text-[12px] text-[#F3C9C2] leading-snug"
              dangerouslySetInnerHTML={{ __html: s.trap }}
            />
          </div>
        </div>
      )}

      {/* Copy + allocation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg bg-[#0A1628] border border-white/8 p-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-[#6E8AA8] mb-1.5">
            {t("pf.rules.copyCross")}
          </div>
          <p
            className="text-[11px] text-[#A8B5C7] leading-snug"
            dangerouslySetInnerHTML={{ __html: firm.copy.cross }}
          />
        </div>
        <div className="rounded-lg bg-[#0A1628] border border-white/8 p-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-[#6E8AA8] mb-1.5">
            {t("pf.rules.copyOwn")}
          </div>
          <p
            className="text-[11px] text-[#A8B5C7] leading-snug"
            dangerouslySetInnerHTML={{ __html: firm.copy.own }}
          />
        </div>
      </div>

      <a
        href={firm.calLink}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[#7DD3FC] hover:text-white transition-colors"
      >
        <ExternalLink size={11} /> {t("pf.rules.official")}
      </a>
    </div>
  );
}

// ------------------------------------------------------------- AI assistant
function AiAssistant({
  firmName,
  programName,
  phase,
}: {
  firmName: string;
  programName: string;
  phase: "eval" | "funded";
}) {
  const { t, lang } = useLanguage();
  const [reply, setReply] = useState<string | null>(null);
  const [question, setQuestion] = useState("");

  const askMutation = trpc.propFirm.ask.useMutation({
    onSuccess: (data) => setReply(data.reply),
    onError: () => toast.error(t("pf.toast.saveFailed")),
  });

  const ask = () => {
    askMutation.mutate({
      firmName,
      programName,
      phase,
      question: question.trim() || undefined,
      lang,
    });
  };

  return (
    <div className="rounded-xl bg-gradient-to-br from-[#0D1E35] to-[#0A1628] border border-[#0077B6]/25 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={15} className="text-[#7DD3FC]" />
        <span className="font-['Space_Grotesk'] text-[13px] font-semibold text-white">
          {t("pf.ai.title")}
        </span>
      </div>
      <p className="text-[11px] text-[#8FA3BC] leading-snug">{t("pf.ai.desc")}</p>

      <div className="flex items-center gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !askMutation.isPending) ask();
          }}
          placeholder={t("pf.ai.placeholder")}
          className="flex-1 h-9 rounded-lg bg-[#0A1628] border border-white/10 px-3 text-[12px] text-white placeholder:text-[#4A6080] focus:outline-none focus:border-[#0077B6]/50"
        />
        <button
          onClick={ask}
          disabled={askMutation.isPending}
          className="h-9 px-3 rounded-lg bg-gradient-to-br from-[#0094C6] to-[#005377] text-white text-[12px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
        >
          {askMutation.isPending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Send size={13} />
          )}
          {t("pf.ai.ask")}
        </button>
      </div>

      {askMutation.isPending && (
        <div className="flex items-center gap-2 text-[11px] text-[#6E8AA8]">
          <Loader2 size={12} className="animate-spin" /> {t("pf.ai.thinking")}
        </div>
      )}

      {reply && !askMutation.isPending && (
        <div className="rounded-lg bg-[#0A1628] border border-white/8 p-3 text-[12.5px] text-[#D6E2F0] prose-pf">
          <Streamdown>{reply}</Streamdown>
        </div>
      )}

      <p className="text-[9.5px] text-[#4A6080] leading-snug flex items-start gap-1.5">
        <AlertTriangle size={10} className="shrink-0 mt-0.5" />
        {t("pf.ai.disclaimer")}
      </p>
    </div>
  );
}

// ---------------------------------------------------------- FirmProgramPicker
function FirmProgramPicker({
  firmName,
  programName,
  onFirm,
  onProgram,
}: {
  firmName: string;
  programName: string;
  onFirm: (v: string) => void;
  onProgram: (v: string) => void;
}) {
  const { t } = useLanguage();
  const firm = FIRMS.find((f) => f.name === firmName) ?? FIRMS[0];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="font-mono text-[9px] uppercase tracking-widest text-[#6E8AA8] block mb-1">
          {t("pf.accounts.firm")}
        </label>
        <select
          value={firmName}
          onChange={(e) => {
            onFirm(e.target.value);
            const f = FIRMS.find((x) => x.name === e.target.value);
            if (f) onProgram(f.programs[0].name);
          }}
          className="w-full h-9 rounded-lg bg-[#0A1628] border border-white/10 px-2 text-[12px] text-white focus:outline-none focus:border-[#0077B6]/50"
        >
          {FIRMS.map((f) => (
            <option key={f.name} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="font-mono text-[9px] uppercase tracking-widest text-[#6E8AA8] block mb-1">
          {t("pf.accounts.program")}
        </label>
        <select
          value={programName}
          onChange={(e) => onProgram(e.target.value)}
          className="w-full h-9 rounded-lg bg-[#0A1628] border border-white/10 px-2 text-[12px] text-white focus:outline-none focus:border-[#0077B6]/50"
        >
          {firm.programs.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- AccountCard
type AccountRow = {
  id: number;
  firmName: string;
  programName: string;
  sizeUsd: number;
  phase: "eval" | "funded";
  label: string;
};

function AccountCard({
  account,
  onRemove,
}: {
  account: AccountRow;
  onRemove: (id: number) => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const firm = FIRMS.find((f) => f.name === account.firmName);
  const program =
    firm?.programs.find((p) => p.name === account.programName) ?? firm?.programs[0];
  const sizeLabel = `$${(account.sizeUsd / 1000).toFixed(account.sizeUsd % 1000 ? 1 : 0)}K`;

  return (
    <div className="rounded-xl bg-[#0D1E35]/70 border border-white/8 overflow-hidden">
      <div className="flex items-center gap-3 p-3.5">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            account.phase === "funded"
              ? "bg-[#00897B]/20 text-[#34D399]"
              : "bg-[#0077B6]/20 text-[#7DD3FC]"
          }`}
        >
          <Building2 size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-['Space_Grotesk'] text-[14px] font-semibold text-white">
              {account.firmName}
            </span>
            <span className="font-mono text-[10px] text-[#6E8AA8]">{sizeLabel}</span>
            <span
              className={`font-mono text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded ${
                account.phase === "funded"
                  ? "bg-[#00897B]/20 text-[#34D399]"
                  : "bg-[#0077B6]/20 text-[#7DD3FC]"
              }`}
            >
              {account.phase === "funded" ? t("pf.phase.funded") : t("pf.phase.eval")}
            </span>
          </div>
          <div className="font-mono text-[10px] text-[#4A6080] truncate">
            {account.programName}
            {account.label ? ` · ${account.label}` : ""}
          </div>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="h-8 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#A8B5C7] text-[11px] font-medium flex items-center gap-1"
        >
          {t("pf.accounts.viewRules")}
          <ChevronDown
            size={13}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        <button
          onClick={() => onRemove(account.id)}
          className="w-8 h-8 rounded-lg text-[#4A6080] hover:text-[#E94F37] hover:bg-[#E94F37]/10 flex items-center justify-center"
          title={t("pf.accounts.delete")}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <AnimatePresence>
        {open && firm && program && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t border-white/8 overflow-hidden"
          >
            <div className="p-3.5 space-y-4">
              <RuleTable firm={firm} program={program} phase={account.phase} />
              <AiAssistant
                firmName={account.firmName}
                programName={account.programName}
                phase={account.phase}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ----------------------------------------------------------------- Main page
export default function PropFirmTrackerPage() {
  const { t, lang } = useLanguage();
  const [, setLocation] = useLocation();
  const { accounts } = useAccounts();
  const [view] = useState<ViewKey>("prop-firm");
  const [tab, setTab] = useState<TabKey>("accounts");

  const utils = trpc.useUtils();
  const accountsQuery = trpc.propFirm.listAccounts.useQuery();
  const stateQuery = trpc.propFirm.getState.useQuery();

  const pfAccounts = (accountsQuery.data ?? []) as AccountRow[];

  // ---- add-account form ----
  const [showForm, setShowForm] = useState(false);
  const [fFirm, setFFirm] = useState(FIRMS[0].name);
  const [fProgram, setFProgram] = useState(FIRMS[0].programs[0].name);
  const [fPhase, setFPhase] = useState<"eval" | "funded">("eval");
  const [fLabel, setFLabel] = useState("");
  const selectedFirm = FIRMS.find((f) => f.name === fFirm) ?? FIRMS[0];
  const selectedProgram =
    selectedFirm.programs.find((p) => p.name === fProgram) ?? selectedFirm.programs[0];
  const [fSize, setFSize] = useState<number>(selectedProgram.sizes[0]?.usd ?? 100000);

  useEffect(() => {
    // keep size valid when program changes
    const sizes = selectedProgram.sizes.map((s) => s.usd);
    if (!sizes.includes(fSize)) setFSize(sizes[0] ?? 100000);
  }, [fProgram, fFirm]); // eslint-disable-line react-hooks/exhaustive-deps

  const addMutation = trpc.propFirm.addAccount.useMutation({
    onSuccess: () => {
      utils.propFirm.listAccounts.invalidate();
      toast.success(t("pf.toast.added"));
      setShowForm(false);
      setFLabel("");
    },
    onError: () => toast.error(t("pf.toast.saveFailed")),
  });
  const removeMutation = trpc.propFirm.removeAccount.useMutation({
    onSuccess: () => {
      utils.propFirm.listAccounts.invalidate();
      toast.success(t("pf.toast.removed"));
    },
    onError: () => toast.error(t("pf.toast.saveFailed")),
  });

  function submitAccount() {
    addMutation.mutate({
      firmName: fFirm,
      programName: fProgram,
      sizeUsd: fSize,
      phase: fPhase,
      label: fLabel.trim() || undefined,
    });
  }
  function removeAccount(id: number) {
    if (!window.confirm(t("pf.accounts.deleteConfirm"))) return;
    removeMutation.mutate({ id });
  }

  // ---- sidebar shell wiring ----
  function onSetView(v: ViewKey) {
    if (v === "prop-firm") return;
    if (v === "dashboard") return setLocation("/dashboard");
    if (v === "accounts") return setLocation("/accounts");
    if (v === "calendar") return setLocation("/calendar");
    if (v === "position-calc") return setLocation("/position-calculator");
    if (v === "trading-coach") return setLocation("/trading-coach");
    if (
      v === "pattern-analysis" ||
      v === "pre-market" ||
      v === "market-news" ||
      v === "mindset-coach"
    )
      return openAction(v);
    toast.info("Coming soon");
  }
  function openAction(action: string) {
    const id = accounts[0]?.id;
    if (!id) return setLocation("/accounts");
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

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "accounts", label: t("pf.tab.accounts"), icon: <Building2 size={14} /> },
    { key: "rules", label: t("pf.tab.rules"), icon: <BookOpen size={14} /> },
    { key: "compare", label: t("pf.tab.compare"), icon: <GitCompareArrows size={14} /> },
    { key: "tools", label: t("pf.tab.tools"), icon: <Calculator size={14} /> },
    { key: "checklist", label: t("pf.tab.checklist"), icon: <ListChecks size={14} /> },
    { key: "notes", label: t("pf.tab.notes"), icon: <StickyNote size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-[#0A1628] flex">
      <AppSidebar
        view={view}
        setView={onSetView}
        handlers={sidebarHandlers}
        accountsCount={accounts.length}
      />
      <div className="flex-1 lg:ml-[248px]">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0077B6] to-[#023E8A] flex items-center justify-center">
              <ShieldAlert size={22} className="text-white" />
            </div>
            <div>
              <h1 className="font-['Space_Grotesk'] text-2xl font-semibold text-white leading-tight">
                {t("pf.title")}
              </h1>
              <p className="font-mono text-[11px] text-[#6E8AA8] uppercase tracking-wider">
                {t("pf.subtitle")}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 p-1 rounded-xl bg-[#0D1E35]/60 border border-white/8 w-full overflow-x-auto">
            {TABS.map((tb) => (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={`flex items-center gap-2 px-3.5 h-9 rounded-lg font-['Space_Grotesk'] text-[12.5px] font-semibold whitespace-nowrap transition-all ${
                  tab === tb.key
                    ? "bg-gradient-to-br from-[#0094C6] to-[#005377] text-white shadow-md shadow-[#0094C6]/20"
                    : "text-[#6E8AA8] hover:text-white"
                }`}
              >
                {tb.icon} {tb.label}
              </button>
            ))}
          </div>

          {/* ===== My Accounts ===== */}
          {tab === "accounts" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-['Space_Grotesk'] text-[15px] font-semibold text-white">
                  {t("pf.accounts.heading")}
                </h2>
                {pfAccounts.length > 0 && (
                  <button
                    onClick={() => setShowForm((v) => !v)}
                    className="h-9 px-3 rounded-lg bg-gradient-to-br from-[#0094C6] to-[#005377] text-white text-[12px] font-semibold flex items-center gap-1.5"
                  >
                    <Plus size={14} /> {t("pf.accounts.add")}
                  </button>
                )}
              </div>

              <AnimatePresence>
                {showForm && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="rounded-xl bg-[#0D1E35]/70 border border-white/10 overflow-hidden"
                  >
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-['Space_Grotesk'] text-[13px] font-semibold text-white">
                          {t("pf.accounts.add")}
                        </span>
                        <button
                          onClick={() => setShowForm(false)}
                          className="text-[#4A6080] hover:text-white"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <FirmProgramPicker
                        firmName={fFirm}
                        programName={fProgram}
                        onFirm={setFFirm}
                        onProgram={setFProgram}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="font-mono text-[9px] uppercase tracking-widest text-[#6E8AA8] block mb-1">
                            {t("pf.accounts.size")}
                          </label>
                          <select
                            value={fSize}
                            onChange={(e) => setFSize(Number(e.target.value))}
                            className="w-full h-9 rounded-lg bg-[#0A1628] border border-white/10 px-2 text-[12px] text-white focus:outline-none focus:border-[#0077B6]/50"
                          >
                            {selectedProgram.sizes.map((s) => (
                              <option key={s.usd} value={s.usd}>
                                {sizeLabelFor(selectedFirm, s, "USD" as Currency)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="font-mono text-[9px] uppercase tracking-widest text-[#6E8AA8] block mb-1">
                            {t("pf.accounts.phase")}
                          </label>
                          <select
                            value={fPhase}
                            onChange={(e) =>
                              setFPhase(e.target.value as "eval" | "funded")
                            }
                            className="w-full h-9 rounded-lg bg-[#0A1628] border border-white/10 px-2 text-[12px] text-white focus:outline-none focus:border-[#0077B6]/50"
                          >
                            <option value="eval">{t("pf.phase.eval")}</option>
                            <option value="funded">{t("pf.phase.funded")}</option>
                          </select>
                        </div>
                        <div>
                          <label className="font-mono text-[9px] uppercase tracking-widest text-[#6E8AA8] block mb-1">
                            {t("pf.accounts.label")}
                          </label>
                          <input
                            value={fLabel}
                            onChange={(e) => setFLabel(e.target.value)}
                            placeholder={t("pf.accounts.labelPh")}
                            className="w-full h-9 rounded-lg bg-[#0A1628] border border-white/10 px-3 text-[12px] text-white placeholder:text-[#4A6080] focus:outline-none focus:border-[#0077B6]/50"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => setShowForm(false)}
                          className="h-9 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-[#A8B5C7] text-[12px] font-medium"
                        >
                          {t("pf.accounts.cancel")}
                        </button>
                        <button
                          onClick={submitAccount}
                          disabled={addMutation.isPending}
                          className="h-9 px-4 rounded-lg bg-gradient-to-br from-[#0094C6] to-[#005377] text-white text-[12px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {addMutation.isPending && (
                            <Loader2 size={13} className="animate-spin" />
                          )}
                          {t("pf.accounts.save")}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {accountsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-[#6E8AA8] text-[12px] py-8 justify-center">
                  <Loader2 size={14} className="animate-spin" /> ...
                </div>
              ) : pfAccounts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/12 p-8 text-center space-y-4">
                  <ShieldAlert size={28} className="text-[#4A6080] mx-auto" />
                  <p className="text-[13px] text-[#8FA3BC] max-w-md mx-auto leading-relaxed">
                    {t("pf.accounts.empty")}
                  </p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="h-9 px-4 rounded-lg bg-gradient-to-br from-[#0094C6] to-[#005377] text-white text-[12px] font-semibold inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} /> {t("pf.accounts.addFirst")}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {pfAccounts.map((a) => (
                    <AccountCard key={a.id} account={a} onRemove={removeAccount} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== Rule Lookup ===== */}
          {tab === "rules" && <RuleLookupTab />}

          {/* ===== Compare ===== */}
          {tab === "compare" && <CompareTab />}

          {/* ===== Risk Tools ===== */}
          {tab === "tools" && <RiskToolsTab />}

          {/* ===== Daily Check ===== */}
          {tab === "checklist" && (
            <ChecklistTab
              initial={stateQuery.data?.checks ?? ""}
              onSaved={() => utils.propFirm.getState.invalidate()}
            />
          )}

          {/* ===== Notes ===== */}
          {tab === "notes" && (
            <NotesTab
              initial={stateQuery.data?.notes ?? ""}
              onSaved={() => utils.propFirm.getState.invalidate()}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ Rule Lookup tab
function RuleLookupTab() {
  const { t } = useLanguage();
  const [firmName, setFirmName] = useState(FIRMS[0].name);
  const [programName, setProgramName] = useState(FIRMS[0].programs[0].name);
  const [phase, setPhase] = useState<"eval" | "funded">("eval");
  const firm = FIRMS.find((f) => f.name === firmName) ?? FIRMS[0];
  const program =
    firm.programs.find((p) => p.name === programName) ?? firm.programs[0];

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-[#8FA3BC]">{t("pf.rules.pick")}</p>
      <div className="rounded-xl bg-[#0D1E35]/70 border border-white/10 p-4 space-y-4">
        <FirmProgramPicker
          firmName={firmName}
          programName={programName}
          onFirm={setFirmName}
          onProgram={setProgramName}
        />
        <div className="flex gap-1.5 p-1 rounded-lg bg-[#0A1628] border border-white/8 w-fit">
          <button
            onClick={() => setPhase("eval")}
            className={`px-3 h-8 rounded-md text-[12px] font-semibold ${
              phase === "eval"
                ? "bg-[#0077B6]/30 text-white"
                : "text-[#6E8AA8] hover:text-white"
            }`}
          >
            {t("pf.rules.evalTitle")}
          </button>
          <button
            onClick={() => setPhase("funded")}
            className={`px-3 h-8 rounded-md text-[12px] font-semibold ${
              phase === "funded"
                ? "bg-[#00897B]/30 text-white"
                : "text-[#6E8AA8] hover:text-white"
            }`}
          >
            {t("pf.rules.fundedTitle")}
          </button>
        </div>
        <RuleTable firm={firm} program={program} phase={phase} />
      </div>
    </div>
  );
}

// --------------------------------------------------------------- Compare tab
function CompareTab() {
  const { t } = useLanguage();
  const [picked, setPicked] = useState<string[]>([
    FIRMS[0].name,
    FIRMS[1].name,
  ]);
  const toggle = (name: string) => {
    setPicked((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : prev.length >= 3
          ? prev
          : [...prev, name],
    );
  };
  const firms = FIRMS.filter((f) => picked.includes(f.name));
  const metrics: { key: keyof Firm["summary"]; label: string }[] = [
    { key: "lev", label: t("pf.rules.leverage") },
    { key: "daily", label: t("pf.rules.daily") },
    { key: "max", label: t("pf.rules.max") },
    { key: "target", label: t("pf.rules.target") },
    { key: "split", label: t("pf.rules.split") },
    { key: "mindays", label: t("pf.rules.minDays") },
    { key: "news", label: t("pf.rules.news") },
    { key: "weekend", label: t("pf.rules.weekend") },
  ];

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-[#8FA3BC]">{t("pf.compare.pick")}</p>
      <div className="flex flex-wrap gap-2">
        {FIRMS.map((f) => (
          <button
            key={f.name}
            onClick={() => toggle(f.name)}
            className={`px-3 h-8 rounded-lg text-[11px] font-medium border transition-all ${
              picked.includes(f.name)
                ? "bg-[#0077B6]/25 border-[#0077B6]/50 text-white"
                : "bg-[#0A1628] border-white/10 text-[#8FA3BC] hover:text-white"
            }`}
          >
            {f.name}
          </button>
        ))}
      </div>
      <div className="rounded-xl bg-[#0D1E35]/70 border border-white/10 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left font-mono text-[9px] uppercase tracking-widest text-[#6E8AA8] p-3">
                {t("pf.compare.metric")}
              </th>
              {firms.map((f) => (
                <th
                  key={f.name}
                  className="text-left font-['Space_Grotesk'] text-[12px] font-semibold text-white p-3"
                >
                  {f.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.key} className="border-b border-white/5">
                <td className="font-mono text-[10px] uppercase tracking-wider text-[#6E8AA8] p-3 align-top">
                  {m.label}
                </td>
                {firms.map((f) => (
                  <td key={f.name} className="text-[#D6E2F0] p-3 align-top">
                    {f.summary[m.key] || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ Risk Tools tab
function RiskToolsTab() {
  const { t } = useLanguage();
  const [balance, setBalance] = useState(100000);
  const [dailyPct, setDailyPct] = useState(5);
  const [maxPct, setMaxPct] = useState(10);
  const [riskPct, setRiskPct] = useState(50);

  const dailyLimit = useMemo(() => (balance * dailyPct) / 100, [balance, dailyPct]);
  const maxFloor = useMemo(() => balance - (balance * maxPct) / 100, [balance, maxPct]);
  const tradeRisk = useMemo(() => (dailyLimit * riskPct) / 100, [dailyLimit, riskPct]);
  const fmt = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  const field = (
    label: string,
    value: number,
    setter: (n: number) => void,
    step = 1,
  ) => (
    <div>
      <label className="font-mono text-[9px] uppercase tracking-widest text-[#6E8AA8] block mb-1">
        {label}
      </label>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => setter(Number(e.target.value) || 0)}
        className="w-full h-9 rounded-lg bg-[#0A1628] border border-white/10 px-3 text-[13px] text-white focus:outline-none focus:border-[#0077B6]/50"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[#0D1E35]/70 border border-white/10 p-4 space-y-4">
        <div>
          <h2 className="font-['Space_Grotesk'] text-[15px] font-semibold text-white">
            {t("pf.tools.ddTitle")}
          </h2>
          <p className="text-[11px] text-[#8FA3BC]">{t("pf.tools.ddDesc")}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {field(t("pf.tools.balance"), balance, setBalance, 1000)}
          {field(t("pf.tools.dailyPct"), dailyPct, setDailyPct, 0.5)}
          {field(t("pf.tools.maxPct"), maxPct, setMaxPct, 0.5)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg bg-[#E94F37]/10 border border-[#E94F37]/25 p-3.5">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#E94F37] mb-1">
              {t("pf.tools.dailyLimit")}
            </div>
            <div className="font-mono text-xl font-semibold text-white">
              -${fmt(dailyLimit)}
            </div>
          </div>
          <div className="rounded-lg bg-[#F4A261]/10 border border-[#F4A261]/25 p-3.5">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#F4A261] mb-1">
              {t("pf.tools.maxLimit")}
            </div>
            <div className="font-mono text-xl font-semibold text-white">
              ${fmt(maxFloor)}
            </div>
          </div>
        </div>
        <div className="pt-2 border-t border-white/8 space-y-3">
          <h3 className="font-['Space_Grotesk'] text-[13px] font-semibold text-white">
            {t("pf.tools.riskTitle")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            {field(t("pf.tools.riskPct"), riskPct, setRiskPct, 5)}
            <div className="rounded-lg bg-[#00897B]/10 border border-[#00897B]/25 p-3.5">
              <div className="font-mono text-[9px] uppercase tracking-widest text-[#34D399] mb-1">
                {t("pf.tools.riskAmount")}
              </div>
              <div className="font-mono text-xl font-semibold text-white">
                ${fmt(tradeRisk)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- Checklist tab
function ChecklistTab({
  initial,
  onSaved,
}: {
  initial: string;
  onSaved: () => void;
}) {
  const { t, lang } = useLanguage();
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setChecked(initial ? JSON.parse(initial) : {});
    } catch {
      setChecked({});
    }
  }, [initial]);

  const saveMutation = trpc.propFirm.saveState.useMutation({
    onSuccess: onSaved,
    onError: () => toast.error(t("pf.toast.saveFailed")),
  });
  const persist = useCallback(
    (next: Record<string, boolean>) => {
      saveMutation.mutate({ checks: JSON.stringify(next) });
    },
    [saveMutation],
  );

  const toggle = (id: string) => {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    persist(next);
  };
  const reset = () => {
    setChecked({});
    persist({});
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[#0D1E35]/70 border border-white/10 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-['Space_Grotesk'] text-[15px] font-semibold text-white">
              {t("pf.checklist.heading")}
            </h2>
            <p className="text-[11px] text-[#8FA3BC]">{t("pf.checklist.desc")}</p>
          </div>
          <button
            onClick={reset}
            className="h-8 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#A8B5C7] text-[11px] font-medium flex items-center gap-1.5"
          >
            <RotateCcw size={12} /> {t("pf.checklist.reset")}
          </button>
        </div>
        <div className="space-y-2">
          {CHECKLIST_ITEMS.map((id) => (
            <button
              key={id}
              onClick={() => toggle(id)}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-[#0A1628] border border-white/8 hover:border-white/15 text-left"
            >
              <span
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                  checked[id]
                    ? "bg-[#00897B] border-[#00897B]"
                    : "border-white/20"
                }`}
              >
                {checked[id] && <ListChecks size={12} className="text-white" />}
              </span>
              <span
                className={`text-[12.5px] ${
                  checked[id] ? "text-[#6E8AA8] line-through" : "text-[#D6E2F0]"
                }`}
              >
                {CHECKLIST_LABELS[id][lang]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Notes tab
function NotesTab({
  initial,
  onSaved,
}: {
  initial: string;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValue(initial ?? "");
  }, [initial]);

  const saveMutation = trpc.propFirm.saveState.useMutation({
    onSuccess: () => {
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 1500);
    },
    onError: () => toast.error(t("pf.toast.saveFailed")),
  });

  // Debounced autosave
  useEffect(() => {
    if (value === initial) return;
    const id = setTimeout(() => {
      saveMutation.mutate({ notes: value });
    }, 800);
    return () => clearTimeout(id);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[#0D1E35]/70 border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-['Space_Grotesk'] text-[15px] font-semibold text-white">
            {t("pf.notes.heading")}
          </h2>
          {saved && (
            <span className="font-mono text-[10px] text-[#34D399]">
              {t("pf.notes.saved")}
            </span>
          )}
        </div>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("pf.notes.ph")}
          rows={12}
          className="w-full rounded-lg bg-[#0A1628] border border-white/10 p-3 text-[13px] text-white placeholder:text-[#4A6080] focus:outline-none focus:border-[#0077B6]/50 resize-y leading-relaxed"
        />
      </div>
    </div>
  );
}

export { RuleTable, AiAssistant, CHECKLIST_ITEMS, CHECKLIST_LABELS, rule };
export type { TabKey };
