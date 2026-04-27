// server/_core/clerkAuth.ts — authenticate a tRPC request against Clerk.
//
// Strategy:
//   1. The browser carries `__session` cookie (set by Clerk's React SDK) for
//      same-origin deployments, or a `Bearer <token>` in the `Authorization`
//      header for cross-origin / API clients.
//   2. We verify that token with `@clerk/backend` using CLERK_SECRET_KEY.
//   3. On success we upsert a `users` row keyed by `openId = clerk:<userId>`
//      and hydrate the returned row so tRPC procedures get an integer PK.
//
// Anything going wrong here returns null — the procedure layer decides
// whether the caller needs a valid user (protectedProcedure) or not.

import { createClerkClient, verifyToken } from "@clerk/backend";
import type { IncomingMessage } from "http";
import type { User } from "../../drizzle/schema";
import { getUserByOpenId, upsertUser } from "../db";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || "";
const CLERK_PUBLISHABLE_KEY = process.env.VITE_CLERK_PUBLISHABLE_KEY || "";

let _clerkClient: ReturnType<typeof createClerkClient> | null = null;

function getClerkClient() {
  if (!CLERK_SECRET_KEY) return null;
  if (!_clerkClient) {
    _clerkClient = createClerkClient({
      secretKey: CLERK_SECRET_KEY,
      publishableKey: CLERK_PUBLISHABLE_KEY || undefined,
    });
  }
  return _clerkClient;
}

export function clerkConfigured(): boolean {
  return Boolean(CLERK_SECRET_KEY && CLERK_PUBLISHABLE_KEY);
}

/**
 * Extract the raw Clerk session token from an incoming HTTP request.
 * Order of precedence:
 *   1. `Authorization: Bearer <token>` header (cross-origin clients)
 *   2. `__session` cookie (Clerk SDK default for same-origin apps)
 */
function extractToken(req: IncomingMessage): string | null {
  const auth = (req.headers["authorization"] ?? "") as string;
  if (auth.toLowerCase().startsWith("bearer ")) {
    const tok = auth.slice(7).trim();
    if (tok) return tok;
  }
  const cookieHeader = (req.headers["cookie"] ?? "") as string;
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(/;\s*/);
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (name === "__session") {
      return decodeURIComponent(part.slice(eq + 1)).trim() || null;
    }
  }
  return null;
}

/**
 * Verify a Clerk session token and return the backing users row.
 * Returns null when:
 *   - Clerk is not configured (no secret/publishable key)
 *   - No token was present on the request
 *   - The token is invalid / expired
 *   - DB is not reachable (upsertUser logs & swallows; we re-fetch)
 */
export async function authenticateClerkRequest(
  req: IncomingMessage
): Promise<User | null> {
  if (!clerkConfigured()) return null;

  const token = extractToken(req);
  if (!token) return null;

  let payload: Awaited<ReturnType<typeof verifyToken>>;
  try {
    payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
  } catch (err) {
    // Invalid / expired token. Do not throw — just anonymous.
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[clerkAuth] token verification failed:", msg);
    return null;
  }

  const clerkUserId = payload.sub;
  if (!clerkUserId) return null;

  // Enrich with Clerk profile data on first login so our row has name/email.
  let name: string | null = null;
  let email: string | null = null;
  try {
    const client = getClerkClient();
    if (client) {
      const u = await client.users.getUser(clerkUserId);
      name =
        [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
        u.username ||
        null;
      email = u.primaryEmailAddress?.emailAddress ?? null;
    }
  } catch (err) {
    // Profile lookup failures are not fatal — we'll still upsert minimal info.
    console.warn("[clerkAuth] profile fetch failed:", err);
  }

  const openId = `clerk:${clerkUserId}`;
  try {
    await upsertUser({
      openId,
      name,
      email,
      loginMethod: "clerk",
      lastSignedIn: new Date(),
    });
  } catch (err) {
    console.error("[clerkAuth] upsertUser failed:", err);
    return null;
  }

  const row = await getUserByOpenId(openId);
  return row ?? null;
}
