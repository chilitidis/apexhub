import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { useMemo } from "react";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { CLERK_ENABLED, CLERK_PUBLISHABLE_KEY, DEMO_MODE, getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  // In demo / self-hosted mode there is no Manus OAuth portal to redirect to.
  // When Clerk is active the sign-in UI is part of the app itself, so we also
  // don't need a hard redirect here — the <SignedIn>/<SignedOut> guards handle
  // routing automatically.
  if (DEMO_MODE || CLERK_ENABLED) return;
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

/**
 * Build a tRPC client that forwards the current Clerk session token via the
 * `Authorization: Bearer ...` header. We memoize against the auth snapshot so
 * a fresh token is used after sign-in/out without tearing down React Query.
 */
function AppWithTrpc() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const trpcClient = useMemo(() => {
    return trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
          async headers() {
            if (!CLERK_ENABLED || !isSignedIn) return {};
            try {
              const token = await getToken();
              return token ? { Authorization: `Bearer ${token}` } : {};
            } catch {
              return {};
            }
          },
          fetch(input, init) {
            return globalThis.fetch(input, {
              ...(init ?? {}),
              credentials: "include",
            });
          },
        }),
      ],
    });
    // Re-create the client when auth state flips so the next request carries
    // (or drops) the bearer token immediately.
  }, [getToken, isSignedIn]);

  // Avoid rendering the app before Clerk knows the auth state — it prevents
  // a flash of "signed out" while the SDK hydrates from the browser cookie.
  if (CLERK_ENABLED && !isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A1628] text-[#4A6080] text-xs font-mono uppercase tracking-widest">
        Authenticating...
      </div>
    );
  }

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

function Root() {
  if (CLERK_ENABLED && CLERK_PUBLISHABLE_KEY) {
    return (
      <ClerkProvider
        publishableKey={CLERK_PUBLISHABLE_KEY}
        afterSignOutUrl="/"
      >
        <AppWithTrpc />
      </ClerkProvider>
    );
  }
  // Clerk disabled → render directly (legacy demo/Manus paths).
  return <AppWithTrpc />;
}

createRoot(document.getElementById("root")!).render(<Root />);
