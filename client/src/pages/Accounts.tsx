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
  LogOut,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useClerk } from "@clerk/clerk-react";
import { toast } from "sonner";

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

  return (
    <div className="min-h-screen bg-[#0A1628] text-white">
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
                onOpen={onOpen}
                onEdit={onEdit}
                onDelete={setDeleteTarget}
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
          onSubmit={async (payload) => {
            if (editor.mode === "create") {
              await createAccount(payload);
              toast.success("Account created");
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
  );
}

interface AccountCardProps {
  account: TradingAccount;
  canDelete: boolean;
  onOpen: (a: TradingAccount) => void;
  onEdit: (a: TradingAccount) => void;
  onDelete: (a: TradingAccount) => void;
}

function AccountCard({
  account,
  canDelete,
  onOpen,
  onEdit,
  onDelete,
}: AccountCardProps) {
  const color = account.color || "#0077B6";
  return (
    <div
      className="relative rounded-2xl border border-white/10 bg-[#0D1E35] overflow-hidden hover:border-white/20 transition-all cursor-pointer group min-h-[220px]"
      onClick={() => onOpen(account)}
    >
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: color }}
      />
      <div className="p-5 flex flex-col h-full">
        <div className="flex items-start justify-between">
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
            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => onEdit(account)}
              className="p-1.5 rounded-md text-[#4A6080] hover:text-white hover:bg-white/5"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
            {canDelete && (
              <button
                onClick={() => onDelete(account)}
                className="p-1.5 rounded-md text-[#4A6080] hover:text-[#E94F37] hover:bg-[#E94F37]/10"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-auto pt-6">
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
      </div>
    </div>
  );
}

function AccountEditor({
  state,
  onClose,
  onSubmit,
}: {
  state: EditorState;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    startingBalance: number;
    accountType: TradingAccount["accountType"];
    currency: string;
    color: string;
  }) => Promise<void>;
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

  const canSubmit = name.trim().length > 0 && !isNaN(Number(startingBalance));

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        startingBalance: Number(startingBalance) || 0,
        accountType,
        currency: currency.trim().toUpperCase() || "USD",
        color,
      });
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
