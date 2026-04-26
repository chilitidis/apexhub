import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/**
 * Server-side DEMO_MODE: activated when the Manus OAuth env vars are not
 * configured (Railway / self-hosted), or explicitly via DEMO_MODE / VITE_DEMO_MODE.
 * In this mode every request is treated as the built-in demo user so journal
 * procedures continue to function without external auth.
 */
const SERVER_DEMO_MODE = (() => {
  const explicit = String(
    process.env.DEMO_MODE ?? process.env.VITE_DEMO_MODE ?? ""
  ).toLowerCase();
  if (explicit === "true" || explicit === "1") return true;
  if (explicit === "false" || explicit === "0") return false;
  // Auto-detect: missing OAuth env means we cannot perform real auth.
  return !process.env.OAUTH_SERVER_URL || !process.env.VITE_APP_ID;
})();

const DEMO_USER: User = {
  id: 1,
  openId: "demo-local-user",
  name: "Demo User",
  email: "demo@apexhub.local",
  loginMethod: "demo",
  role: "user",
  createdAt: new Date(0),
  updatedAt: new Date(0),
  lastSignedIn: new Date(0),
} as unknown as User;

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  if (SERVER_DEMO_MODE) {
    user = DEMO_USER;
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
