/**
 * InvestorLinkDialog — manage the MT5-investor-password-style live read-only
 * link for the current account. Shows the active secret URL (if any), lets
 * the owner copy it, rotate it (old link dies instantly) or revoke it.
 * On-brand Ocean Depth dark navy, mirroring FeedbackDialog's structure.
 */
import { Check, Copy, KeyRound, Loader2, RefreshCw, ShieldOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";

interface InvestorLinkDialogProps {
  open: boolean;
  onClose: () => void;
  accountId: number | null;
}

export default function InvestorLinkDialog({ open, onClose, accountId }: InvestorLinkDialogProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const utils = trpc.useUtils();

  const enabled = open && accountId !== null && accountId > 0;
  const query = trpc.investor.get.useQuery(
    { accountId: accountId ?? 0 },
    { enabled },
  );

  const create = trpc.investor.create.useMutation({
    onSuccess: () => {
      toast.success(t("iv.created"));
      void utils.investor.get.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const revoke = trpc.investor.revoke.useMutation({
    onSuccess: () => {
      toast.success(t("iv.revoked"));
      void utils.investor.get.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const token = query.data?.token ?? null;
  const url = token ? `${window.location.origin}/i/${token}` : null;
  const busy = create.isPending || revoke.isPending;

  const copyLink = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t("iv.copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-[#0D1E35] border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-['Space_Grotesk']">
            <span className="w-8 h-8 rounded-lg bg-[#2A9D8F]/15 border border-[#2A9D8F]/30 flex items-center justify-center text-[#2A9D8F]">
              <KeyRound size={16} />
            </span>
            {t("iv.dialogTitle")}
          </DialogTitle>
          <DialogDescription className="text-[#A8B5C7]">
            {t("iv.dialogIntro")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Current link */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#4A6080] mb-2">
              {t("iv.activeLink")}
            </div>
            {query.isLoading ? (
              <div className="flex items-center gap-2 text-[#4A6080] text-[12px] py-2">
                <Loader2 size={14} className="animate-spin" /> …
              </div>
            ) : url ? (
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={url}
                  data-testid="investor-link-url"
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 rounded-lg bg-[#070F1C] border border-white/10 px-3 py-2.5 font-mono text-[11px] text-[#A8B5C7] focus:outline-none focus:border-[#2A9D8F]/60"
                />
                <button
                  type="button"
                  onClick={copyLink}
                  data-testid="investor-link-copy"
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#070F1C] border border-white/10 text-[11px] font-mono uppercase tracking-wider text-white/80 hover:border-[#2A9D8F]/60 hover:text-[#2A9D8F] transition-all"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />} {t("iv.copy")}
                </button>
              </div>
            ) : (
              <div className="text-[12px] text-[#4A6080] py-1">{t("iv.noLink")}</div>
            )}
            {url && (
              <div className="mt-1.5 font-mono text-[10px] text-[#4A6080]">
                {query.data?.views ?? 0} {t("iv.views")}
              </div>
            )}
          </div>

          {/* Rotate hint */}
          {url && (
            <div className="text-[11px] text-[#F4A261] leading-snug">
              {t("iv.rotateHint")}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            {url && (
              <button
                type="button"
                disabled={busy}
                onClick={() => accountId && revoke.mutate({ accountId })}
                data-testid="investor-link-revoke"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E94F37]/40 bg-[#E94F37]/10 text-[11px] font-mono uppercase tracking-wider text-[#E94F37] hover:bg-[#E94F37]/20 transition-all disabled:opacity-50"
              >
                {revoke.isPending ? <Loader2 size={12} className="animate-spin" /> : <ShieldOff size={12} />}
                {t("iv.revokeLink")}
              </button>
            )}
            <button
              type="button"
              disabled={busy || !enabled}
              onClick={() => accountId && create.mutate({ accountId })}
              data-testid="investor-link-create"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#2A9D8F]/50 bg-[#2A9D8F]/15 text-[11px] font-mono uppercase tracking-wider text-[#2A9D8F] hover:bg-[#2A9D8F]/25 transition-all disabled:opacity-50"
            >
              {create.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {url ? t("iv.rotateLink") : t("iv.createLink")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
