import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Subscription state for the current user. Drives the paywall gate and the
 * trial banner. Returns a normalized object that is safe to read before the
 * query resolves (loading=true, hasAccess=false).
 */
export function useSubscription() {
  const { isAuthenticated } = useAuth();

  const query = trpc.subscription.status.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: true,
    // Re-check periodically so a freshly-completed checkout unlocks the app
    // without a manual refresh.
    refetchInterval: 15_000,
    retry: false,
  });

  const data = query.data;
  const status = data?.status ?? "none";
  const hasAccess = Boolean(data?.hasAccess);
  const trialEnd = data?.trialEnd ? new Date(data.trialEnd) : null;
  const currentPeriodEnd = data?.currentPeriodEnd ? new Date(data.currentPeriodEnd) : null;

  // Days remaining in the trial (rounded up, never negative).
  let trialDaysLeft: number | null = null;
  if (status === "trialing" && trialEnd) {
    const ms = trialEnd.getTime() - Date.now();
    trialDaysLeft = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  return {
    loading: query.isLoading,
    status,
    hasAccess,
    isTrialing: status === "trialing",
    trialEnd,
    trialDaysLeft,
    currentPeriodEnd,
    cancelAtPeriodEnd: Boolean(data?.cancelAtPeriodEnd),
    isConfigured: Boolean(data?.isConfigured),
    isAdmin: Boolean(data?.isAdmin),
    refetch: query.refetch,
  };
}
