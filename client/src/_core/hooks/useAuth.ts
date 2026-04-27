import { CLERK_ENABLED, DEMO_MODE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  useAuth as useClerkAuth,
  useClerk,
  useUser as useClerkUser,
} from "@clerk/clerk-react";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

/**
 * Built-in user surfaced when the app runs in DEMO_MODE (no Manus OAuth env,
 * no Clerk). Matches the shape returned by `trpc.auth.me` so consumers don't
 * need to branch on demo vs real auth.
 */
const DEMO_USER = {
  id: 1,
  openId: "demo-local-user",
  name: "Demo User",
  email: "demo@apexhub.local",
  loginMethod: "demo",
  role: "user" as const,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  lastSignedIn: new Date(0),
};

type AuthUser = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();

  // --- Clerk-aware state --------------------------------------------------
  // When Clerk is active we use `trpc.auth.me` as the canonical source of
  // truth (it returns the MySQL users row keyed by Clerk userId). The Clerk
  // SDK hooks drive re-renders / loading states so we never flash content
  // before auth resolves.
  const clerkAuth = useClerkAuth();
  const clerkUser = useClerkUser();
  const { signOut } = useClerk();
  const clerkKnown = CLERK_ENABLED ? clerkAuth.isLoaded : true;
  const clerkSignedIn = CLERK_ENABLED ? clerkAuth.isSignedIn ?? false : false;

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    // In DEMO_MODE we never hit the backend for auth.
    // In Clerk mode we only query once Clerk confirms the user is signed in,
    // because an unsigned request would always return null and flash the UI
    // into a "signed-out" state.
    enabled: CLERK_ENABLED
      ? clerkAuth.isLoaded && Boolean(clerkAuth.isSignedIn)
      : !DEMO_MODE,
  });

  const legacyLogout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    if (CLERK_ENABLED) {
      try {
        await signOut({ redirectUrl: "/" });
      } finally {
        utils.auth.me.setData(undefined, null);
        await utils.auth.me.invalidate();
      }
      return;
    }
    if (DEMO_MODE) return;
    try {
      await legacyLogout.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [legacyLogout, signOut, utils]);

  const state = useMemo(() => {
    if (CLERK_ENABLED) {
      const loading =
        !clerkAuth.isLoaded ||
        (clerkSignedIn && (meQuery.isLoading || meQuery.isFetching));
      const user = (meQuery.data as AuthUser | null | undefined) ?? null;
      return {
        user,
        loading,
        error: meQuery.error ?? null,
        isAuthenticated: Boolean(user),
        clerkSignedIn,
        clerkUser: clerkUser.user ?? null,
      };
    }

    if (DEMO_MODE) {
      return {
        user: DEMO_USER,
        loading: false,
        error: null as Error | null,
        isAuthenticated: true,
        clerkSignedIn: false,
        clerkUser: null,
      };
    }

    try {
      localStorage.setItem(
        "manus-runtime-user-info",
        JSON.stringify(meQuery.data)
      );
    } catch {
      // ignore storage failures (private mode, etc.)
    }
    return {
      user: (meQuery.data as AuthUser | null | undefined) ?? null,
      loading: meQuery.isLoading || legacyLogout.isPending,
      error: meQuery.error ?? legacyLogout.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
      clerkSignedIn: false,
      clerkUser: null,
    };
  }, [
    clerkAuth.isLoaded,
    clerkSignedIn,
    clerkUser.user,
    meQuery.data,
    meQuery.error,
    meQuery.isFetching,
    meQuery.isLoading,
    legacyLogout.error,
    legacyLogout.isPending,
  ]);

  useEffect(() => {
    if (CLERK_ENABLED) return; // Clerk mode uses <SignedIn>/<SignedOut> guards.
    if (DEMO_MODE) return;
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || legacyLogout.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath;
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    legacyLogout.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  // While Clerk is still hydrating, return a conservative loading state so
  // protected UI doesn't render stale "authenticated" markers.
  if (CLERK_ENABLED && !clerkKnown) {
    return {
      user: null as AuthUser | null,
      loading: true,
      error: null as Error | null,
      isAuthenticated: false,
      clerkSignedIn: false,
      clerkUser: null,
      refresh: () => meQuery.refetch(),
      logout,
    };
  }

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
