/**
 * Thin wrapper around the metaapi.cloud-sdk that:
 *
 * - Lazily constructs a single MetaApi instance per process (the SDK manages
 *   its own websocket pool internally).
 * - Exposes higher-level operations needed by the journal: ensure the broker
 *   account exists in MetaApi, deploy + wait for connection, fetch deals by
 *   time range, undeploy.
 *
 * The real SDK calls live behind `getApi()`; this lets the tRPC procedures
 * remain testable (we only invoke the SDK at runtime, never during module
 * load), and it lets the unit test for the mapper run in any environment
 * without a token.
 */

export interface ProvisionedAccount {
  id: string;
  state: string;
  /** RPC handle exposing getDealsByTimeRange + waitSynchronized + close. */
  connection: {
    connect(): Promise<void>;
    waitSynchronized(): Promise<void>;
    getDealsByTimeRange(start: Date, end: Date): Promise<unknown>;
    getHistoryOrdersByTimeRange(start: Date, end: Date): Promise<unknown>;
    close(): Promise<void>;
  };
  account: {
    deploy(): Promise<void>;
    waitConnected(): Promise<void>;
    undeploy(): Promise<void>;
  };
}

let cachedApi: unknown = null;

async function getApi(): Promise<any> {
  if (!process.env.METAAPI_TOKEN) {
    throw new Error("METAAPI_TOKEN environment variable is not configured");
  }
  if (cachedApi) return cachedApi;
  // Lazy import so the SDK websocket layer isn't pulled into the bundle until
  // we actually need it (and so unit tests don't accidentally connect).
  //
  // IMPORTANT: the package's default `import` field points to the *esm-web*
  // bundle which references `window` and crashes under Node. We must reach
  // into the explicit `./esm-node` (or fall back to `./node` CJS) export so
  // the websocket layer uses the Node implementations of crypto/buffer/idb.
  let mod: any;
  try {
    mod = await import("metaapi.cloud-sdk/esm-node");
  } catch {
    // Older SDK builds expose only the CJS-only `./node` entrypoint.
    mod = await import("metaapi.cloud-sdk/node");
  }
  const MetaApi = mod.default ?? mod.MetaApi ?? mod;
  cachedApi = new MetaApi(process.env.METAAPI_TOKEN);
  return cachedApi;
}

export interface EnsureAccountOptions {
  login: string;
  password: string;
  server: string;
  platform: "mt4" | "mt5";
  name?: string;
}

/**
 * Ensure a MetaApi account exists for the given (login, server) pair. If one
 * already exists in the user's MetaApi tenant we reuse it (cheap); otherwise
 * we create a fresh cloud account. Returns the MetaApi account UUID and the
 * account object so callers can deploy / fetch deals.
 */
export async function ensureMetaApiAccount(opts: EnsureAccountOptions): Promise<{ id: string; account: any }> {
  const api = await getApi();
  const accounts = await api.metatraderAccountApi.getAccountsWithInfiniteScrollPagination();
  let account = accounts.find(
    (a: any) => String(a.login) === String(opts.login) && typeof a.type === "string" && a.type.startsWith("cloud"),
  );
  if (!account) {
    account = await api.metatraderAccountApi.createAccount({
      name: opts.name ?? `APEXHUB ${opts.platform.toUpperCase()} ${opts.login}`,
      type: "cloud",
      login: opts.login,
      password: opts.password,
      server: opts.server,
      platform: opts.platform,
      magic: 1000,
    });
  }
  return { id: account.id, account };
}

/**
 * Deploy + wait for the broker connection to come online. Caller should
 * invoke this before getRPCConnection.
 */
export async function deployAndWait(account: any): Promise<void> {
  await account.deploy();
  await account.waitConnected();
}

export async function fetchDealsForRange(
  account: any,
  startTime: Date,
  endTime: Date,
): Promise<unknown[]> {
  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized();
  try {
    const deals = await connection.getDealsByTimeRange(startTime, endTime);
    // SDK returns either an array directly, or { deals: [...] } depending on
    // version; normalise both shapes.
    if (Array.isArray(deals)) return deals as unknown[];
    if (deals && typeof deals === "object" && Array.isArray((deals as any).deals)) {
      return (deals as any).deals as unknown[];
    }
    return [];
  } finally {
    try {
      await connection.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Lightweight token validation helper used by the secret test. Hits the
 * MetaApi *provisioning* REST endpoint (no SDK websocket), returns true on
 * 2xx, false otherwise. Network failures propagate so the caller can decide
 * whether to retry.
 */
export async function isTokenValid(token: string): Promise<boolean> {
  if (!token) return false;
  const resp = await fetch(
    "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts?limit=1",
    {
      headers: { "auth-token": token, "Accept": "application/json" },
    },
  );
  return resp.ok;
}
