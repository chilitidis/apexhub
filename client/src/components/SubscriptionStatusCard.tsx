import { useSubscription } from "@/hooks/useSubscription";
import { trpc } from "@/lib/trpc";
import { CreditCard, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

/**
 * Compact subscription status surfaced at the bottom of the sidebar.
 *
 * - Trialing → shows "X days left" + a Manage link (opens Stripe portal).
 * - Active → shows "Pro" + Manage link.
 * - Anything else → nothing (the gate already redirects to the paywall).
 *
 * Hidden entirely when Stripe is not configured so local dev stays clean.
 */
export function SubscriptionStatusCard({ collapsed }: { collapsed?: boolean }) {
  const { status, isTrialing, trialDaysLeft, isConfigured, loading } = useSubscription();

  const portal = trpc.subscription.createPortal.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => toast.error(err.message || "Could not open billing portal"),
  });

  if (loading || !isConfigured) return null;
  if (status !== "trialing" && status !== "active") return null;

  const openPortal = () => portal.mutate({ origin: window.location.origin });

  if (collapsed) {
    return (
      <button
        onClick={openPortal}
        title="Manage subscription"
        className="w-9 h-9 mx-auto rounded-md flex items-center justify-center text-[#7DD3FC] hover:bg-white/5"
      >
        {portal.isPending ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <CreditCard size={15} />
        )}
      </button>
    );
  }

  return (
    <div className="mx-3 mb-2 rounded-lg border border-[#0094C6]/25 bg-[#0094C6]/10 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Sparkles size={13} className="text-[#00B4D8] shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-wider text-[#7DD3FC] truncate">
            {isTrialing
              ? `Trial · ${trialDaysLeft ?? 0} day${trialDaysLeft === 1 ? "" : "s"} left`
              : "Pro · Active"}
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
        Manage
      </button>
    </div>
  );
}
