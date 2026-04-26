// server/_core/bootstrap.ts — runtime DB bootstrap for self-hosted / Railway.
//
// Responsibilities:
//   1. If DATABASE_URL is set, run any pending Drizzle migrations so the
//      `users`, `monthly_snapshots`, `active_trades`, and `trades` tables
//      always exist before the first request.
//   2. Ensure a demo user row exists with id=1 / openId="demo-local-user"
//      so that protected journal procedures running under DEMO_MODE have a
//      valid foreign-key target.
//
// Both steps are idempotent and best-effort: failures are logged but never
// crash the server (we still serve the SPA so the user can read the error).

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import * as path from "path";
import { fileURLToPath } from "url";
import * as mysql from "mysql2/promise";
import { users } from "../../drizzle/schema";

const DEMO_OPEN_ID = "demo-local-user";

function isExplicitDemoMode(): boolean {
  const explicit = String(
    process.env.DEMO_MODE ?? process.env.VITE_DEMO_MODE ?? ""
  ).toLowerCase();
  if (explicit === "true" || explicit === "1") return true;
  if (explicit === "false" || explicit === "0") return false;
  return !process.env.OAUTH_SERVER_URL || !process.env.VITE_APP_ID;
}

/**
 * Run pending Drizzle migrations against the configured DATABASE_URL.
 * Safe to call on every boot; no-ops when DATABASE_URL is empty.
 */
export async function runMigrations(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn(
      "[bootstrap] DATABASE_URL not set — skipping migrations. " +
        "Set DATABASE_URL on your host (e.g. Railway) so saves are persisted."
    );
    return;
  }

  // Resolve the migrations folder relative to this file regardless of whether
  // we're running from `dist/` (production) or the TS source (dev).
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "../../drizzle"), // dev: server/_core -> drizzle
    path.resolve(here, "../drizzle"), // prod (dist/): dist -> drizzle
    path.resolve(process.cwd(), "drizzle"), // last-resort fallback
  ];

  let connection: mysql.Connection | null = null;
  try {
    connection = await mysql.createConnection(url);
    const db = drizzle(connection);
    let migrated = false;
    for (const migrationsFolder of candidates) {
      try {
        await migrate(db, { migrationsFolder });
        console.log("[bootstrap] migrations applied from", migrationsFolder);
        migrated = true;
        break;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Drizzle throws when the folder doesn't exist — try the next candidate.
        if (
          msg.includes("ENOENT") ||
          msg.includes("Can't find meta/_journal.json")
        ) {
          continue;
        }
        throw err;
      }
    }
    if (!migrated) {
      console.warn("[bootstrap] no drizzle migrations folder found");
    }
  } catch (err) {
    console.error(
      "[bootstrap] FAILED to apply migrations:",
      err,
      "— writes will fail until the DB schema exists."
    );
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Make sure a demo user row exists. We force `id = 1` so the FK target is
 * stable across deployments and matches the frontend's hard-coded demo user
 * id. If a different user with id=1 already exists (e.g. a real OAuth user),
 * we leave the table alone and just upsert by openId so we don't clobber it.
 */
export async function ensureDemoUser(): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  let connection: mysql.Connection | null = null;
  try {
    connection = await mysql.createConnection(process.env.DATABASE_URL);
    const db = drizzle(connection);

    // Check whether the demo openId is already present.
    const existing = await db.execute(
      sql`select id from users where openId = ${DEMO_OPEN_ID} limit 1`
    );
    const rows = (existing as unknown as Array<Array<{ id: number }>>)[0] ?? [];
    if (rows.length > 0) {
      // Already there — nothing to do.
      return;
    }

    // Try to insert at id=1 if the row is empty. If id=1 is taken by a real
    // user, fall back to a regular insert (the openId unique constraint still
    // protects us from duplicates).
    const idOne = await db.execute(sql`select id from users where id = 1 limit 1`);
    const idOneRows = (idOne as unknown as Array<Array<{ id: number }>>)[0] ?? [];
    if (idOneRows.length === 0) {
      await db.execute(sql`
        insert into users (id, openId, name, email, loginMethod, role)
        values (1, ${DEMO_OPEN_ID}, 'Demo User', 'demo@apexhub.local', 'demo', 'user')
      `);
    } else {
      await db.insert(users).values({
        openId: DEMO_OPEN_ID,
        name: "Demo User",
        email: "demo@apexhub.local",
        loginMethod: "demo",
        role: "user",
      });
    }

    console.log(
      "[bootstrap] demo user ensured (openId=demo-local-user). DEMO_MODE saves will persist."
    );
  } catch (err) {
    console.error(
      "[bootstrap] FAILED to ensure demo user:",
      err,
      "— DEMO_MODE writes may fail until users.id=1 exists."
    );
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Run all bootstrap steps. Always best-effort; never throws.
 */
export async function runBootstrap(): Promise<void> {
  await runMigrations();
  if (isExplicitDemoMode()) {
    await ensureDemoUser();
  }
}
