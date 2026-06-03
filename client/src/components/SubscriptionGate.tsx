import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import Paywall from "@/pages/Paywall";

/**
 * Gates the authenticated app behind an active or trialing subscription.
 *
 * - While the status query is loading we show a lightweight splash so we never
 *   flash either the app or the paywall before we know the truth.
 * - If Stripe is not configured at all (e.g. local dev before keys land), we
 *   fail OPEN so development isn't blocked. The Paywall still surfaces a
 *   warning when `plan.configured` is false.
 * - Otherwise: hasAccess → render the app; no access → render the Paywall.
 */
export function SubscriptionGate({ children }: { children: ReactNode }) {
  const { loading, hasAccess, isConfigured } = useSubscription();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070F1C] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#0094C6]" size={28} />
      </div>
    );
  }

  // Fail open when billing is not set up yet so the owner can still build/test.
  if (!isConfigured) return <>{children}</>;

  if (!hasAccess) return <Paywall />;

  return <>{children}</>;
}
