import * as React from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { trpc } from "@/lib/trpc";
import { CreditCard, Loader2, Sparkles, Crown } from "lucide-react";
void React;
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Compact subscription status surfaced at the bottom of the sidebar.
 *
 * Behaviour (per user request 06/06):
 * - The card is ALWAYS visible (as long as Stripe is configured) so the user
 *   can reach the plans at any time.
 * - When the user has an active/trialing subscription → "Manage" opens the
 *   Stripe Customer Portal (update card / cancel), and a secondary "Δες πλάνα"
 *   link opens the pricing page.
 * - When the user has NO active subscription → the button reads "Επίλεξε πλάνο"
 *   and navigates to /pricing, where they pick Monthly / 6-month / Annual and
 *   get sent to Stripe Checkout.
 *
 * Hidden only when Stripe is not configured so local dev stays clean.
 */
export function SubscriptionStatusCard({ collapsed }: { collapsed?: boolean }) {
  const { status, isTrialing, trialDaysLeft, isConfigured, loading } = useSubscription();
  const { t } = useLanguage();
  const [, navigate] = useLocation();

  const portal = trpc.subscription.createPortal.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => toast.error(err.message || t("sub.portalError")),
  });

  if (loading || !isConfigured) return null;

  const hasPlan = status === "trialing" || status === "active";

  const openPortal = () => portal.mutate({ origin: window.location.origin });
  const goPricing = () => navigate("/pricing");

  // Collapsed sidebar → single icon button.
  if (collapsed) {
    return (
      <button
        onClick={hasPlan ? openPortal : goPricing}
        title={hasPlan ? t("sub.manageTitle") : t("sub.pickPlanTitle")}
        className="w-9 h-9 mx-auto rounded-md flex items-center justify-center text-[#7DD3FC] hover:bg-white/5"
      >
        {portal.isPending ? (
          <Loader2 size={15} className="animate-spin" />
        ) : hasPlan ? (
          <CreditCard size={15} />
        ) : (
          <Crown size={15} />
        )}
      </button>
    );
  }

  // No active plan → upsell card that opens the plans page.
  if (!hasPlan) {
    return (
      <div className="mx-3 mb-2 rounded-lg border border-[#0094C6]/25 bg-[#0094C6]/10 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Crown size={13} className="text-[#F4A261] shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[#7DD3FC] truncate">
              {t("sub.upgradePro")}
            </div>
          </div>
        </div>
        <button
          onClick={goPricing}
          className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-br from-[#0094C6] to-[#005377] hover:from-[#00B4D8] hover:to-[#0094C6] py-1.5 text-[10px] font-mono uppercase tracking-wider text-white transition-colors"
        >
          <Crown size={11} /> {t("sub.pickPlan")}
        </button>
      </div>
    );
  }

  // Active / trialing → status + manage (portal) + secondary view-plans link.
  return (
    <div className="mx-3 mb-2 rounded-lg border border-[#0094C6]/25 bg-[#0094C6]/10 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Sparkles size={13} className="text-[#00B4D8] shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-wider text-[#7DD3FC] truncate">
            {isTrialing
              ? t("sub.trialLeft")
                  .replace("{n}", String(trialDaysLeft ?? 0))
                  .replace("{unit}", trialDaysLeft === 1 ? t("sub.dayUnit") : t("sub.daysUnit"))
              : t("sub.proActive")}
          </div>
        </div>
      </div>
      <button
        onClick={openPortal}
        disabled={portal.isPending}
        className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-md bg-white/5 hover:bg-white/10 py-1.5 text-[10px] font-mono uppercase tracking-wider text-white/80 hover:text-white transition-colors disabled:opacity-60"
      >
        {portal.isPending ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <CreditCard size={11} />
        )}
        {t("sub.manage")}
      </button>
      <button
        onClick={goPricing}
        className="mt-1.5 w-full text-center text-[9px] font-mono uppercase tracking-widest text-[#4A6080] hover:text-[#7DD3FC] transition-colors"
      >
        {t("sub.viewPlans")}
      </button>
    </div>
  );
}
