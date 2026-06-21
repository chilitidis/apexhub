/**
 * AdminFeedbackPanel — admin-only list of submitted feedback / feature
 * requests. Lets the owner read each request and triage it by changing its
 * status (new → planned → done / dismissed). Backed by the admin-gated
 * `feedback.list` / `feedback.updateStatus` procedures.
 */
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, MessageSquare, Inbox } from "lucide-react";

type FeedbackStatus = "new" | "planned" | "done" | "dismissed";

function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminFeedbackPanel({ enabled }: { enabled: boolean }) {
  const { t } = useLanguage();
  const STATUS_OPTIONS: { value: FeedbackStatus; label: string; color: string; bg: string }[] = [
    { value: "new", label: t("adm.stNew"), color: "#4CA8E0", bg: "rgba(0,119,182,0.18)" },
    { value: "planned", label: t("adm.stPlanned"), color: "#F4A261", bg: "rgba(244,162,97,0.16)" },
    { value: "done", label: t("adm.stDone"), color: "#00C896", bg: "rgba(0,137,123,0.16)" },
    { value: "dismissed", label: t("adm.stDismissed"), color: "#6E8AA8", bg: "rgba(110,138,168,0.14)" },
  ];
  const CATEGORY_LABEL: Record<string, string> = {
    feature: t("fb.featureLabel"),
    improvement: t("fb.improvementLabel"),
    bug: t("fb.bugLabel"),
    other: t("fb.otherLabel"),
  };
  const utils = trpc.useUtils();
  const query = trpc.feedback.list.useQuery(undefined, {
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const updateStatus = trpc.feedback.updateStatus.useMutation({
    onSuccess: () => {
      utils.feedback.list.invalidate();
    },
    onError: (err) => {
      toast.error(t("adm.notUpdated"), { description: err.message });
    },
  });

  const rows = query.data ?? [];

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-[#6E8AA8]">
        <Loader2 size={18} className="animate-spin" />
        <span className="font-mono text-xs uppercase tracking-widest">{t("adm.loadingFeedback")}</span>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2 text-center px-6">
        <MessageSquare size={28} className="text-[#E94F37]" />
        <div className="font-['Space_Grotesk'] text-white font-semibold">{t("adm.loadFailed")}</div>
        <div className="font-mono text-[11px] text-[#6E8AA8]">
          {query.error?.message ?? t("adm.adminsOnly")}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2 text-center px-6">
        <Inbox size={28} className="text-[#6E8AA8]" />
        <div className="font-['Space_Grotesk'] text-white font-semibold">{t("adm.noMessages")}</div>
        <div className="font-mono text-[11px] text-[#6E8AA8]">
          {t("adm.noMessagesHint")}
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/5" data-testid="admin-feedback-list">
      {rows.map((row) => {
        const meta =
          STATUS_OPTIONS.find((s) => s.value === row.status) ?? STATUS_OPTIONS[0];
        return (
          <div key={row.id} className="px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    className="font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{ color: meta.color, background: meta.bg }}
                  >
                    {CATEGORY_LABEL[row.category] ?? row.category}
                  </span>
                  <span className="font-mono text-[10px] text-[#6E8AA8]">
                    {fmtDateTime(row.createdAt)}
                  </span>
                </div>
                <p className="text-[13px] text-white whitespace-pre-wrap break-words leading-relaxed">
                  {row.message}
                </p>
                <div className="mt-1.5 font-mono text-[10px] text-[#6E8AA8]">
                  {row.userName?.trim() || "—"}
                  {row.userEmail ? ` · ${row.userEmail}` : ""}
                </div>
              </div>

              {/* Status changer */}
              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                {STATUS_OPTIONS.map((opt) => {
                  const on = row.status === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      data-testid={`feedback-status-${row.id}-${opt.value}`}
                      disabled={updateStatus.isPending || on}
                      onClick={() => updateStatus.mutate({ id: row.id, status: opt.value })}
                      className={`font-mono text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full border transition-colors disabled:cursor-default ${
                        on
                          ? "border-transparent"
                          : "border-white/10 text-[#A8B5C7] hover:border-white/30"
                      }`}
                      style={on ? { background: opt.bg, color: opt.color, borderColor: "transparent" } : undefined}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
