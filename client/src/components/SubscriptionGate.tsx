import * as React from "react";
import type { ReactNode } from "react";
import { useEffect } from "react";
void React;
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
 * - Any logged-in user WITHOUT an active/trialing subscription — this includes
 *   `past_due`, `unpaid`, `canceled`, `incomplete` and `none` — is hard-redirected
 *   to `/pricing` and can reach NOTHING else in the app until they pay. The
 *   `/pricing` route itself lives OUTSIDE this gate (see App.tsx) so the locked
 *   user can always settle their payment or sign out.
 */
export function SubscriptionGate({ children }: { children: ReactNode }) {
  const { loading, hasAccess, isConfigured } = useSubscription();
  const [location, setLocation] = useLocation();

  // Fail open when billing is not configured yet so the owner can still build.
  const blocked = !loading && isConfigured && !hasAccess;
  // Guard against a redirect loop if this gate ever wraps the pricing route.
  const alreadyOnPricing = location === "/pricing";

  useEffect(() => {
    if (blocked && !alreadyOnPricing) {
      setLocation("/pricing");
    }
  }, [blocked, alreadyOnPricing, setLocation]);

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
