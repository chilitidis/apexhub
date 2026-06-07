import type { ReactNode } from "react";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useSubscription } from "@/hooks/useSubscription";

/**
 * Gates the authenticated app behind an active or trialing subscription.
 *
 * Behaviour:
 * - While the status query is loading we show a lightweight splash so we never
 *   flash either the app or the paywall before we know the truth.
 * - If Stripe is not configured at all (e.g. local dev before keys land), we
 *   fail OPEN so development isn't blocked.
 * - Admins (the owner) are never gated — the backend reports `hasAccess=true`
 *   for them via the `isAdmin` flag.
 * - Any logged-in user WITHOUT an active/trialing subscription is hard-redirected
 *   to `/pricing` on every entry. This guarantees that legacy users who signed
 *   up before billing existed must start the 7-day trial (which requires a card)
 *   before they can reach the dashboard or any tool.
 */
export function SubscriptionGate({ children }: { children: ReactNode }) {
  const { loading, hasAccess, isConfigured } = useSubscription();
  const [, setLocation] = useLocation();

  // Fail open when billing is not configured yet so the owner can still build.
  const blocked = !loading && isConfigured && !hasAccess;

  useEffect(() => {
    if (blocked) {
      setLocation("/pricing");
    }
  }, [blocked, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070F1C] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#0094C6]" size={28} />
      </div>
    );
  }

  // While the redirect to /pricing is in flight, render a splash instead of the
  // gated content so it never flashes.
  if (blocked) {
    return (
      <div className="min-h-screen bg-[#070F1C] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#0094C6]" size={28} />
      </div>
    );
  }

  return <>{children}</>;
}
