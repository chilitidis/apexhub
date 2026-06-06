// Accounts picker — the landing experience immediately after login.
//
// Lists every trading account the user owns, lets them pick one (routes to
// /account/:id), create a new one, rename/delete existing ones, and tweak the
// starting balance. Any destructive operation goes through a confirm step.

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccounts, type TradingAccount } from "@/hooks/useJournal";
import {
  AlertTriangle,
  ChevronDown,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import AccountMonthlyHistory from "@/components/AccountMonthlyHistory";
import SyncMt5Modal from "@/components/SyncMt5Modal";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useClerk } from "@clerk/clerk-react";
import { toast } from "sonner";
import { AppSidebar, type ViewKey } from "@/components/AppSidebar";
import { mergeMt5TradesIntoMonths } from "@/lib/mt5Merge";
import { dataToSnapshotInput } from "@/hooks/useJournal";
import { Eye, EyeOff } from "lucide-react";

const ACCOUNT_TYPE_LABEL: Record<TradingAccount["accountType"], string> = {
  prop: "Prop Firm",
  live: "Personal Live",
  demo: "Demo",
  other: "Other",
};

const ACCOUNT_COLORS = [
  "#0077B6",
  "#00897B",
  "#F4A261",
  "#E94F37",
  "#5E60CE",
  "#9D4EDD",
  "#06B6D4",
  "#F59E0B",
];

interface EditorState {
  mode: "create" | "edit";
  account?: TradingAccount;
}

export default function Accounts() {
  const { accounts, isLoading, createAccount, updateAccount, deleteAccount } =
    useAccounts();
  const [, setLocation] = useLocation();
  const { signOut } = useClerk();

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TradingAccount | null>(null);
  /**
   * When set, an inline SyncMt5Modal opens for that account and auto-runs
   * the sync — no navigation, no extra clicks. The modal closes itself when
   * the round-trip finishes; we then refetch the account's snapshots so the
   * card reflects the new monthly buckets.
   */
  const [inlineSyncAccountId, setInlineSyncAccountId] = useState<number | null>(null);
  const mt5List = trpc.mt5.list.useQuery();
  const upsertSnapshot = trpc.journal.upsertSnapshot.useMutation();
  const utils = trpc.useUtils();
  const accountIdsWithMt5 = useMemo(() => {
    const set = new Set<number>();
    for (const c of mt5List.data || []) {
      if (typeof c.accountId === "number") set.add(c.accountId);
    }
    return set;
  }, [mt5List.data]);

  const totalBalance = useMemo(
    () => accounts.reduce((sum, a) => sum + Number(a.startingBalance || 0), 0),
    [accounts],
  );

  function onCreate() {
    setEditor({ mode: "create" });
  }

  function onEdit(a: TradingAccount) {
    setEditor({ mode: "edit", account: a });
  }

  function onOpen(a: TradingAccount) {
    setLocation(`/account/${a.id}`);
  }

  // Sidebar selections — Dashboard and per-account routes are real URLs;
  // every other item is currently a Coming Soon placeholder.
  function onSidebarView(v: ViewKey) {
    if (v === "dashboard") {
      setLocation("/dashboard");
      return;
    }
    if (v === "accounts") {
      // already here
      return;
    }
    if (v === "calendar") {
      setLocation("/calendar");
      return;
    }
    if (v === "position-calc") {
      setLocation("/position-calculator");
      return;
    }
    if (
      v === "pattern-analysis" ||
      v === "pre-market" ||
      v === "market-news" ||
      v === "mindset-coach"
    ) {
      const id = accounts[0]?.id;
      if (!id) {
        pickAccountFirstToast();
        return;
      }
      setLocation(`/account/${id}?action=${v}`);
      return;
    }
    toast.info("\u03a3\u03cd\u03bd\u03c4\u03bf\u03bc\u03b1 \u03b4\u03b9\u03b1\u03b8\u03ad\u03c3\u03b9\u03bc\u03bf");
  }

  function pickAccountFirstToast() {
    toast.info("\u0395\u03c0\u03ad\u03bb\u03b5\u03be\u03b5 \u03ad\u03bd\u03b1\u03bd \u03bb\u03bf\u03b3\u03b1\u03c1\u03b9\u03b1\u03c3\u03bc\u03cc \u03c0\u03c1\u03ce\u03c4\u03b1");
  }

  return (
    <div className="min-h-screen bg-[#0A1628] text-white flex">
      <AppSidebar
        view={"accounts" as ViewKey}
        setView={onSidebarView}
        handlers={{
          onAddTrade: pickAccountFirstToast,
          onNewMonth: pickAccountFirstToast,
          onImport: pickAccountFirstToast,
          onSyncMt5: pickAccountFirstToast,
          onCheck: pickAccountFirstToast,
          onCash: pickAccountFirstToast,
          onCalc: pickAccountFirstToast,
          onExport: pickAccountFirstToast,
        }}
        accountsCount={accounts.length}
      />
      <div className="flex-1 lg:ml-[248px] min-h-screen bg-[#0A1628] text-white">
      {/* Top bar */}
      <div className="border-b border-white/8 bg-[#0D1E35]/80 backdrop-blur-sm">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663576082454/8kEKtsKWxF9JiwbjRbrvBM/utj-logo-badge-N5NDtvx9GcDyhxwM7gRvFA.webp"
              alt="Ultimate Trading Journal"
              className="w-10 h-10 rounded-lg object-contain"
            />
            <div>
              <div className="font-['Space_Grotesk'] font-bold text-lg tracking-tight">
                Ultimate Trading Journal
              </div>
              <div className="font-mono text-[10px] text-[#4A6080] uppercase tracking-widest">
                Pick an Account
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut()}
            className="border-white/10 bg-transparent hover:bg-white/5"
          >
            <LogOut size={14} className="mr-2" /> Sign out
          </Button>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="font-['Space_Grotesk'] font-bold text-3xl tracking-tight">
              Your Trading Accounts
            </h1>
            <p className="font-mono text-xs text-[#4A6080] mt-2 uppercase tracking-widest">
              Each account has its own independent journal, months, and stats.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {accounts.length > 0 && (
              <div className="px-3 py-2 rounded-lg border border-white/8 bg-[#0D1E35] font-mono text-xs">
                <span className="text-[#4A6080] uppercase tracking-widest mr-2">
                  Total capital
                </span>
                <span className="text-white font-semibold">
                  {totalBalance.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
            )}
            <Button
              onClick={onCreate}
              className="bg-[#0077B6] hover:bg-[#0077B6]/90"
            >
              <Plus size={16} className="mr-2" /> New account
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 text-center font-mono text-sm text-[#4A6080]">
            Loading…
          </div>
        ) : accounts.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-white/10 rounded-2xl">
            <Wallet className="mx-auto mb-4 text-[#4A6080]" size={40} />
            <div className="font-['Space_Grotesk'] text-xl font-semibold mb-2">
              No trading accounts yet
            </div>
            <div className="font-mono text-xs text-[#4A6080] uppercase tracking-widest mb-6">
              Create your first account to start journaling.
            </div>
            <Button
              onClick={onCreate}
              className="bg-[#0077B6] hover:bg-[#0077B6]/90"
            >
              <Plus size={16} className="mr-2" /> New account
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {accounts.map((a) => (
              <AccountCard
                key={a.id}
                account={a}
                canDelete={accounts.length > 1}
                hasMt5={accountIdsWithMt5.has(a.id)}
                onOpen={onOpen}
                onEdit={onEdit}
                onDelete={setDeleteTarget}
                onSync={(a) => setInlineSyncAccountId(a.id)}
              />
            ))}
            <button
              onClick={onCreate}
              className="rounded-2xl border border-dashed border-white/10 hover:border-[#0077B6]/60 hover:bg-[#0077B6]/5 transition-all p-6 flex flex-col items-center justify-center gap-3 text-[#4A6080] hover:text-white min-h-[220px]"
            >
              <Plus size={28} />
              <span className="font-mono text-xs uppercase tracking-widest">
                New account
              </span>
            </button>
          </div>
        )}
      </div>

      {editor && (
        <AccountEditor
          state={editor}
          onClose={() => setEditor(null)}
          onSubmit={async (payload, mt5) => {
            if (editor.mode === "create") {
              const created = await createAccount({
                name: payload.name,
                startingBalance: payload.startingBalance,
                accountType: payload.accountType,
                currency: payload.currency,
                color: payload.color,
              });
              toast.success("Account created");
              // Optional inline MT5 hookup. When the user filled the
              // connect-fields on the editor we save the connection right
              // away and route them into the account with auto-sync so the
              // very first dashboard render already shows MT5 trades.
              const newId = (created as { id?: number } | undefined)?.id;
              if (mt5 && newId) {
                try {
                  await utils.client.mt5.upsert.mutate({
                    accountId: newId,
                    name: mt5.name,
                    platform: mt5.platform,
                    server: mt5.server,
                    login: mt5.login,
                    password: mt5.password,
                  });
                  utils.mt5.list.invalidate();
                  setEditor(null);
                  setLocation(`/account/${newId}?action=mt5-autosync`);
                  return;
                } catch (err) {
                  const msg = err instanceof Error ? err.message : String(err);
                  toast.error(`MT5 connection απέτυχε: ${msg}`);
                  // Still take the user inside the new account — they can
                  // re-try the connect from the dashboard topbar.
                }
              }
              setEditor(null);
              if (newId) setLocation(`/account/${newId}`);
              return;
            } else if (editor.account) {
              await updateAccount({
                accountId: editor.account.id,
                ...payload,
              });
              toast.success("Account updated");
            }
            setEditor(null);
          }}
        />
      )}

      {/* Inline per-account MT5 sync modal — auto-starts and closes itself.
          Picks the account's existing connection, pulls the trades, splits
          them across monthly buckets via mergeMt5TradesIntoMonths, and persists
          each bucket through the same upsertSnapshot procedure /journal uses. */}
      {inlineSyncAccountId !== null && (() => {
        const target = accounts.find((a) => a.id === inlineSyncAccountId);
        if (!target) return null;
        return (
          <SyncMt5Modal
            accountId={target.id}
            autoStart
            onClose={() => setInlineSyncAccountId(null)}
            onTradesPulled={async ({ trades: synced }) => {
              if (!synced || synced.length === 0) {
                toast.info("Δεν βρέθηκαν νέα trades στο MT5 ιστορικό");
                return;
              }
              // Pull the latest snapshots inline so we merge against the
              // freshest server state (no stale window from the cache).
              const snapshots = await utils.journal.listSnapshots.fetch({ accountId: target.id });
              const monthlyHistory = (snapshots ?? []).map((s) => ({
                key: s.monthKey,
                month_name: s.monthName,
                year_full: s.yearFull,
                year_short: s.yearShort,
                starting: Number(s.starting) || 0,
                ending: Number(s.ending) || 0,
                net_result: Number(s.netResult) || 0,
                return_pct: Number(s.returnPct) || 0,
                total_trades: Number(s.totalTrades) || 0,
                wins: Number(s.wins) || 0,
                losses: Number(s.losses) || 0,
                win_rate: Number(s.winRate) || 0,
                max_drawdown_pct: Number(s.maxDrawdownPct) || 0,
                currency: ((s as { currency?: string }).currency === "EUR" ? "EUR" : "USD") as "USD" | "EUR",
                trades_json: s.tradesJson,
                adjustments_json: s.adjustmentsJson ?? "[]",
              }));
              const merged = mergeMt5TradesIntoMonths(synced, monthlyHistory, {
                currency: (target.currency === "EUR" ? "EUR" : "USD") as "USD" | "EUR",
                fallbackStarting: Number(target.startingBalance || 0),
              });
              let touched = 0;
              for (const data of merged) {
                try {
                  await upsertSnapshot.mutateAsync(dataToSnapshotInput(target.id, data));
                  touched += 1;
                } catch (err) {
                  const msg = err instanceof Error ? err.message : String(err);
                  toast.error(`Αποτυχία αποθήκευσης ${data.meta.month_name}: ${msg}`);
                }
              }
              utils.journal.listSnapshots.invalidate({ accountId: target.id });
              toast.success(`✓ Sync ολοκληρώθηκε · ${synced.length} trades σε ${touched} μήνες`);
            }}
          />
        );
      })()}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="bg-[#0D1E35] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#9CA3AF]">
              This permanently removes{" "}
              <span className="font-semibold text-white">
                {deleteTarget?.name}
              </span>{" "}
              and every month and trade inside it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-transparent hover:bg-white/5">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#E94F37] hover:bg-[#E94F37]/90"
              onClick={async () => {
                if (!deleteTarget) return;
                await deleteAccount(deleteTarget.id);
                toast.success("Account deleted");
                setDeleteTarget(null);
              }}
            >
              Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      </div>
    </div>
  );
}

interface AccountCardProps {
  account: TradingAccount;
  canDelete: boolean;
  hasMt5: boolean;
  onOpen: (a: TradingAccount) => void;
  onEdit: (a: TradingAccount) => void;
  onDelete: (a: TradingAccount) => void;
  onSync: (a: TradingAccount) => void;
}

function AccountCard({
  account,
  canDelete,
  hasMt5,
  onOpen,
  onEdit,
  onDelete,
  onSync,
}: AccountCardProps) {
  const color = account.color || "#0077B6";
  const [historyOpen, setHistoryOpen] = useState(false);
  return (
    <div
      className="relative rounded-2xl border border-white/10 bg-[#0D1E35] overflow-hidden hover:border-white/20 transition-all group min-h-[220px]"
    >
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: color }}
      />
      <div className="p-5 flex flex-col h-full">
        <div
          className="flex items-start justify-between cursor-pointer"
          onClick={() => onOpen(account)}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: `${color}22`, color }}
            >
              <TrendingUp size={20} />
            </div>
            <div>
              <div className="font-['Space_Grotesk'] font-semibold text-base tracking-tight">
                {account.name}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#4A6080] mt-0.5">
                {ACCOUNT_TYPE_LABEL[account.accountType]} · {account.currency}
              </div>
            </div>
          </div>
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {hasMt5 && (
              <button
                onClick={() => onSync(account)}
                className="p-1.5 rounded-md text-[#7DD3FC] hover:text-white hover:bg-[#0077B6]/20"
                title="Sync MT5 trades into this account"
                data-testid={`sync-mt5-${account.id}`}
              >
                <RefreshCw size={14} />
              </button>
            )}
            <button
              onClick={() => onEdit(account)}
              className="p-1.5 rounded-md text-[#4A6080] hover:text-white hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
            {canDelete && (
              <button
                onClick={() => onDelete(account)}
                className="p-1.5 rounded-md text-[#4A6080] hover:text-[#E94F37] hover:bg-[#E94F37]/10 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        <div
          className="mt-auto pt-6 cursor-pointer"
          onClick={() => onOpen(account)}
        >
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#4A6080]">
            Starting balance
          </div>
          <div className="font-['Space_Grotesk'] font-bold text-2xl mt-1">
            {Number(account.startingBalance || 0).toLocaleString("en-US", {
              style: "currency",
              currency: account.currency || "USD",
              maximumFractionDigits: 0,
            })}
          </div>
        </div>

        {/* Monthly history accordion */}
        <div
          className="mt-4 pt-3 border-t border-white/8"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            aria-expanded={historyOpen}
            data-testid={`toggle-history-${account.id}`}
            className="w-full flex items-center justify-between text-left text-[#4A6080] hover:text-white transition-colors"
          >
            <span className="font-mono text-[10px] uppercase tracking-widest">
              {historyOpen ? "Hide monthly history" : "Show monthly history"}
            </span>
            <ChevronDown
              size={14}
              className={`transition-transform ${historyOpen ? "rotate-180" : ""}`}
            />
          </button>

          {historyOpen && (
            <AccountMonthlyHistory
              accountId={account.id}
              currency={account.currency || "USD"}
              visible={historyOpen}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface Mt5Inline {
  platform: "mt4" | "mt5";
  server: string;
  login: string;
  password: string;
  name: string;
}

function AccountEditor({
  state,
  onClose,
  onSubmit,
}: {
  state: EditorState;
  onClose: () => void;
  onSubmit: (
    payload: {
      name: string;
      startingBalance: number;
      accountType: TradingAccount["accountType"];
      currency: string;
      color: string;
    },
    /** Optional inline MT5 connection. Only present on create. */
    mt5?: Mt5Inline,
  ) => Promise<void>;
}) {
  const initial = state.account;
  const [name, setName] = useState(initial?.name ?? "");
  const [startingBalance, setStartingBalance] = useState(
    String(initial?.startingBalance ?? 0),
  );
  const [accountType, setAccountType] = useState<TradingAccount["accountType"]>(
    initial?.accountType ?? "live",
  );
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [color, setColor] = useState(initial?.color ?? ACCOUNT_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  // Inline MT5 connect (create-only). All optional — the user can still
  // hit Create with these blank to make a manual journal-only account.
  const [showMt5, setShowMt5] = useState(false);
  const [mt5Platform, setMt5Platform] = useState<"mt4" | "mt5">("mt5");
  const [mt5Server, setMt5Server] = useState("");
  const [mt5Login, setMt5Login] = useState("");
  const [mt5Password, setMt5Password] = useState("");
  const [mt5ShowPwd, setMt5ShowPwd] = useState(false);

  const canSubmit = name.trim().length > 0 && !isNaN(Number(startingBalance));
  const mt5Filled =
    mt5Server.trim().length > 0 && mt5Login.trim().length > 0 && mt5Password.length > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        startingBalance: Number(startingBalance) || 0,
        accountType,
        currency: currency.trim().toUpperCase() || "USD",
        color,
      };
      const mt5: Mt5Inline | undefined = state.mode === "create" && showMt5 && mt5Filled
        ? {
            platform: mt5Platform,
            server: mt5Server.trim(),
            login: mt5Login.trim(),
            password: mt5Password,
            name: `${mt5Platform.toUpperCase()} ${mt5Login.trim()}@${mt5Server.trim()}`,
          }
        : undefined;
      await onSubmit(payload, mt5);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#0D1E35] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="font-['Space_Grotesk']">
            {state.mode === "create" ? "New account" : "Edit account"}
          </DialogTitle>
          <DialogDescription className="text-[#4A6080]">
            Each account is an independent journal with its own trades, months,
            and stats.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-xs uppercase tracking-widest text-[#4A6080]">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Prop 100k Challenge"
              className="bg-[#0A1628] border-white/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="startingBalance" className="text-xs uppercase tracking-widest text-[#4A6080]">
                Starting balance
              </Label>
              <Input
                id="startingBalance"
                type="number"
                value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)}
                className="bg-[#0A1628] border-white/10"
              />
            </div>
            <div>
              <Label htmlFor="currency" className="text-xs uppercase tracking-widest text-[#4A6080]">
                Currency
              </Label>
              <Input
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={8}
                className="bg-[#0A1628] border-white/10 uppercase"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-widest text-[#4A6080]">
              Type
            </Label>
            <Select
              value={accountType}
              onValueChange={(v) =>
                setAccountType(v as TradingAccount["accountType"])
              }
            >
              <SelectTrigger className="bg-[#0A1628] border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0D1E35] border-white/10 text-white">
                <SelectItem value="live">Personal Live</SelectItem>
                <SelectItem value="prop">Prop Firm</SelectItem>
                <SelectItem value="demo">Demo</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {state.mode === "create" && (
            <div className="rounded-lg border border-white/10 bg-[#0A1628] p-3">
              <button
                type="button"
                onClick={() => setShowMt5((v) => !v)}
                data-testid="toggle-mt5-connect"
                className="w-full flex items-center justify-between text-left"
              >
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#7DD3FC]">
                    Connect MT5 / MT4 (optional)
                  </div>
                  <div className="font-mono text-[9px] text-[#4A6080] mt-0.5">
                    Auto-sync trades από το MetaTrader στο ιστορικό αυτού του λογαριασμού.
                  </div>
                </div>
                <ChevronDown
                  size={14}
                  className={`text-[#4A6080] transition-transform ${showMt5 ? "rotate-180" : ""}`}
                />
              </button>
              {showMt5 && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs uppercase tracking-widest text-[#4A6080]">
                        Platform
                      </Label>
                      <Select
                        value={mt5Platform}
                        onValueChange={(v) => setMt5Platform(v as "mt4" | "mt5")}
                      >
                        <SelectTrigger className="bg-[#0D1E35] border-white/10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0D1E35] border-white/10 text-white">
                          <SelectItem value="mt5">MetaTrader 5</SelectItem>
                          <SelectItem value="mt4">MetaTrader 4</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="mt5Server" className="text-xs uppercase tracking-widest text-[#4A6080]">
                        Server
                      </Label>
                      <Input
                        id="mt5Server"
                        value={mt5Server}
                        onChange={(e) => setMt5Server(e.target.value)}
                        placeholder="e.g. ICMarkets-Live22"
                        className="bg-[#0D1E35] border-white/10"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="mt5Login" className="text-xs uppercase tracking-widest text-[#4A6080]">
                        Login
                      </Label>
                      <Input
                        id="mt5Login"
                        value={mt5Login}
                        onChange={(e) => setMt5Login(e.target.value)}
                        className="bg-[#0D1E35] border-white/10"
                      />
                    </div>
                    <div>
                      <Label htmlFor="mt5Password" className="text-xs uppercase tracking-widest text-[#4A6080]">
                        Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="mt5Password"
                          type={mt5ShowPwd ? "text" : "password"}
                          value={mt5Password}
                          onChange={(e) => setMt5Password(e.target.value)}
                          className="bg-[#0D1E35] border-white/10 pr-9"
                        />
                        <button
                          type="button"
                          onClick={() => setMt5ShowPwd((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4A6080] hover:text-white"
                          aria-label={mt5ShowPwd ? "Hide password" : "Show password"}
                        >
                          {mt5ShowPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-[#E94F37]/10 border border-[#E94F37]/35">
                    <AlertTriangle size={14} className="text-[#E94F37] mt-0.5 shrink-0" />
                    <div className="font-mono text-[10px] text-[#FFB4A6] leading-relaxed">
                      <strong className="text-[#E94F37]">Σημαντικό:</strong> Μην συνδέεις λογαριασμούς{" "}
                      <strong className="text-white">prop firm (funded accounts)</strong> — πολλές εταιρείες
                      απαγορεύουν εξωτερική σύνδεση/EA/bridge και ρισκάρεις{" "}
                      <strong className="text-white">breach</strong> του funded λογαριασμού. Σύνδεσε μόνο
                      personal / live / demo.
                    </div>
                  </div>
                  <div className="font-mono text-[9px] text-[#4A6080]">
                    Συνιστώνται read-only / investor passwords. Μετά το Create γίνεται auto-sync.
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <Label className="text-xs uppercase tracking-widest text-[#4A6080]">
              Color
            </Label>
            <div className="flex items-center gap-2 flex-wrap">
              {ACCOUNT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === c ? "border-white scale-110" : "border-white/10"
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-white/10 bg-transparent"
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="bg-[#0077B6] hover:bg-[#0077B6]/90"
          >
            {submitting ? "Saving…" : state.mode === "create" ? "Create" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
