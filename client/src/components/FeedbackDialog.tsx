/**
 * FeedbackDialog — lets any signed-in user send a feature request / feedback.
 *
 * Pick a category, type the request, submit. The server persists it to the
 * `feedback` table and fires an owner notification. Kept intentionally simple
 * and on-brand (Ocean Depth dark navy) to match the dashboard.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Loader2, Send, MessageSquarePlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Category = "feature" | "improvement" | "bug" | "other";

interface FeedbackDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function FeedbackDialog({ open, onClose }: FeedbackDialogProps) {
  const { t } = useLanguage();
  const CATEGORIES: { value: Category; label: string; hint: string }[] = [
    { value: "feature", label: t("fb.featureLabel"), hint: t("fb.featureHint") },
    { value: "improvement", label: t("fb.improvementLabel"), hint: t("fb.improvementHint") },
    { value: "bug", label: t("fb.bugLabel"), hint: t("fb.bugHint") },
    { value: "other", label: t("fb.otherLabel"), hint: t("fb.otherHint") },
  ];
  const [category, setCategory] = useState<Category>("feature");
  const [message, setMessage] = useState("");

  const submit = trpc.feedback.submit.useMutation({
    onSuccess: () => {
      toast.success(t("fb.thanks"), {
        description: t("fb.thanksDesc"),
      });
      setMessage("");
      setCategory("feature");
      onClose();
    },
    onError: (err) => {
      toast.error(t("fb.notSent"), {
        description: err.message || t("fb.tryAgain"),
      });
    },
  });

  const trimmed = message.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 4;
  const canSubmit = trimmed.length >= 4 && !submit.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-[#121214] border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-['Inter']">
            <span className="w-8 h-8 rounded-lg bg-[#C9A24A]/15 border border-[#C9A24A]/30 flex items-center justify-center text-[#C9A24A]">
              <MessageSquarePlus size={16} />
            </span>
            {t("fb.title")}
          </DialogTitle>
          <DialogDescription className="text-[#B5B0A6]">
            {t("fb.intro")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Category picker */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#8E8A82] mb-2">
              {t("fb.category")}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    data-testid={`feedback-cat-${c.value}`}
                    onClick={() => setCategory(c.value)}
                    className={`text-left px-3 py-2 rounded-lg border transition-all ${
                      active
                        ? "border-[#C9A24A]/70 bg-[#C9A24A]/10"
                        : "border-white/10 bg-[#0A0A0B] hover:border-white/25"
                    }`}
                  >
                    <div className={`text-[12px] font-semibold ${active ? "text-white" : "text-[#B5B0A6]"}`}>
                      {c.label}
                    </div>
                    <div className="text-[10px] text-[#8E8A82] leading-tight mt-0.5">
                      {c.hint}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Message */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#8E8A82] mb-2">
              {t("fb.yourMessage")}
            </div>
            <textarea
              data-testid="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder={t("fb.placeholder")}
              className="w-full rounded-lg bg-[#0A0A0B] border border-white/10 focus:border-[#C9A24A]/60 focus:outline-none px-3 py-2.5 text-[13px] text-white placeholder:text-[#8E8A82] resize-none transition-colors"
            />
            <div className="flex items-center justify-between mt-1">
              <span className={`text-[10px] ${tooShort ? "text-[#E5484D]" : "text-[#8E8A82]"}`}>
                {tooShort ? t("fb.tooShort") : "\u00A0"}
              </span>
              <span className="font-mono text-[10px] text-[#8E8A82]">{trimmed.length}/4000</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-white/10 text-[11px] font-mono uppercase tracking-wider text-[#B5B0A6] hover:text-white hover:border-white/25 transition-all"
            >
              {t("fb.cancel")}
            </button>
            <button
              type="button"
              data-testid="feedback-submit"
              disabled={!canSubmit}
              onClick={() => submit.mutate({ category, message: trimmed })}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-[#C9A24A] to-[#A87B2A] hover:from-[#C9A24A] hover:to-[#C9A24A] text-[11px] font-mono font-semibold uppercase tracking-wider text-white shadow-lg shadow-[#C9A24A]/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submit.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              {t("fb.send")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
