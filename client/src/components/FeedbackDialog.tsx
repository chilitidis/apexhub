/**
 * FeedbackDialog — lets any signed-in user send a feature request / feedback.
 *
 * Pick a category, type the request, submit. The server persists it to the
 * `feedback` table and fires an owner notification. Kept intentionally simple
 * and on-brand (Ocean Depth dark navy) to match the dashboard.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
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

const CATEGORIES: { value: Category; label: string; hint: string }[] = [
  { value: "feature", label: "Νέα λειτουργία", hint: "Κάτι που θα ήθελες να προστεθεί" },
  { value: "improvement", label: "Βελτίωση", hint: "Κάτι που υπάρχει αλλά θες να αλλάξει" },
  { value: "bug", label: "Πρόβλημα / Bug", hint: "Κάτι που δεν δουλεύει σωστά" },
  { value: "other", label: "Άλλο", hint: "Οτιδήποτε άλλο θέλεις να μας πεις" },
];

interface FeedbackDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function FeedbackDialog({ open, onClose }: FeedbackDialogProps) {
  const [category, setCategory] = useState<Category>("feature");
  const [message, setMessage] = useState("");

  const submit = trpc.feedback.submit.useMutation({
    onSuccess: () => {
      toast.success("Ευχαριστούμε! Το μήνυμά σου στάλθηκε.", {
        description: "Θα το δούμε και θα επανέλθουμε αν χρειαστεί.",
      });
      setMessage("");
      setCategory("feature");
      onClose();
    },
    onError: (err) => {
      toast.error("Δεν στάλθηκε το μήνυμα", {
        description: err.message || "Προσπάθησε ξανά σε λίγο.",
      });
    },
  });

  const trimmed = message.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 4;
  const canSubmit = trimmed.length >= 4 && !submit.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-[#0D1E35] border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-['Space_Grotesk']">
            <span className="w-8 h-8 rounded-lg bg-[#0094C6]/15 border border-[#0094C6]/30 flex items-center justify-center text-[#0094C6]">
              <MessageSquarePlus size={16} />
            </span>
            Feedback / Πρόταση
          </DialogTitle>
          <DialogDescription className="text-[#A8B5C7]">
            Πες μας τι θα ήθελες να προσθέσουμε ή να αλλάξουμε στο Ultimate Trading Journal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Category picker */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#4A6080] mb-2">
              Κατηγορία
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
                        ? "border-[#0094C6]/70 bg-[#0094C6]/10"
                        : "border-white/10 bg-[#070F1C] hover:border-white/25"
                    }`}
                  >
                    <div className={`text-[12px] font-semibold ${active ? "text-white" : "text-[#A8B5C7]"}`}>
                      {c.label}
                    </div>
                    <div className="text-[10px] text-[#4A6080] leading-tight mt-0.5">
                      {c.hint}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Message */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#4A6080] mb-2">
              Το μήνυμά σου
            </div>
            <textarea
              data-testid="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder="π.χ. Θα ήθελα να μπορώ να συγκρίνω δύο μήνες δίπλα-δίπλα…"
              className="w-full rounded-lg bg-[#070F1C] border border-white/10 focus:border-[#0094C6]/60 focus:outline-none px-3 py-2.5 text-[13px] text-white placeholder:text-[#4A6080] resize-none transition-colors"
            />
            <div className="flex items-center justify-between mt-1">
              <span className={`text-[10px] ${tooShort ? "text-[#E94F37]" : "text-[#4A6080]"}`}>
                {tooShort ? "Γράψε λίγο περισσότερα (τουλάχιστον 4 χαρακτήρες)" : "\u00A0"}
              </span>
              <span className="font-mono text-[10px] text-[#4A6080]">{trimmed.length}/4000</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-white/10 text-[11px] font-mono uppercase tracking-wider text-[#A8B5C7] hover:text-white hover:border-white/25 transition-all"
            >
              Άκυρο
            </button>
            <button
              type="button"
              data-testid="feedback-submit"
              disabled={!canSubmit}
              onClick={() => submit.mutate({ category, message: trimmed })}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-[#0094C6] to-[#005377] hover:from-[#00B4D8] hover:to-[#0094C6] text-[11px] font-mono font-semibold uppercase tracking-wider text-white shadow-lg shadow-[#0094C6]/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submit.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Αποστολή
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
