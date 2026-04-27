import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { authenticateClerkRequest, clerkConfigured } from "./clerkAuth";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/**
 * Auth precedence for every tRPC request:
 *   1. If Clerk is configured (CLERK_SECRET_KEY + VITE_CLERK_PUBLISHABLE_KEY),
 *      verify the Clerk session token and return the backing `users` row.
 *      This is the path used in production / Railway for real multi-tenant
 *      sign-up with email & Google.
 *   2. Otherwise, fall back to Manus OAuth (legacy sandbox deployments).
 *
 * Anonymous users get `user: null`; protectedProcedure refuses them.
 *
 * Important: we deliberately REMOVED the previous DEMO_USER auto-login. With
 * Clerk active, every visitor must sign in and receives their own empty
 * journal scoped to their own `users.id`.
 */
export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  if (clerkConfigured()) {
    user = await authenticateClerkRequest(opts.req);
  } else {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
