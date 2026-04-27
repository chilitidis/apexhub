# APEXHUB Trading Journal — Self-Hosting Guide

This document walks you through running the project on your own hardware or deploying it to a cloud host.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TypeScript + TailwindCSS 4 + shadcn/ui + Framer Motion + Recharts |
| Backend | Node.js 22 + Express 4 + tRPC 11 + Drizzle ORM |
| Database | **MySQL 8** (or any MySQL-compatible service: TiDB, PlanetScale, MariaDB 10.11+) |
| Auth | **Clerk** (email + Google, multi-tenant) — Manus OAuth and DEMO_MODE remain as legacy fallbacks |
| File storage | Manus Forge S3 helper (swappable — see "Replacing Storage" below) |
| LLM (screenshot scanner) | Manus Forge LLM proxy (swappable to OpenAI / Anthropic) |
| Build tooling | pnpm + esbuild + drizzle-kit + vitest |

**The project does NOT use Supabase, Firebase or MongoDB.** It uses plain MySQL via Drizzle ORM.

---

## Prerequisites

- Node.js **22.x** (`node --version`)
- pnpm **9.x** (`npm install -g pnpm`)
- MySQL **8.x** running locally or a remote MySQL-compatible URL
- (Optional) Docker if you want a quick MySQL container

---

## 1 — Install dependencies

```bash
pnpm install
```

## 2 — Configure environment

Rename `ENV_TEMPLATE.txt` to `.env` (or `.env.local`) and fill in real values:

```bash
cp ENV_TEMPLATE.txt .env
nano .env   # or your favorite editor
```

Minimum required vars to **boot**:

```
DATABASE_URL=mysql://root:password@localhost:3306/apexhub
JWT_SECRET=$(openssl rand -base64 64)
```

For production multi-tenant login, configure Clerk (see next section). Manus OAuth and DEMO_MODE remain available only for the original sandbox and local dev.

### Clerk (recommended multi-tenant auth for Railway / Vercel / Docker / VPS)

APEXHUB ships with **Clerk** as the default auth provider. Every visitor signs up with email or Google, gets their own empty journal scoped to their own `users.id`, and never sees another user's trades.

1. Create a free project at [dashboard.clerk.com](https://dashboard.clerk.com) and enable **Email** + **Google** as sign-in methods.
2. Copy the two keys from *API Keys*:
   - `VITE_CLERK_PUBLISHABLE_KEY` = `pk_test_…` or `pk_live_…`
   - `CLERK_SECRET_KEY` = `sk_test_…` or `sk_live_…`
3. Add them to your deployment's environment variables (Railway → Variables, Vercel → Settings → Environment, Docker → `docker run --env`, etc).
4. Leave `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL` empty — Clerk takes precedence automatically.
5. Deploy. On first boot, `server/_core/bootstrap.ts` runs the Drizzle migrations and creates the `users`, `monthly_snapshots`, `active_trades`, and `trades` tables. Every time a visitor signs in, `server/_core/clerkAuth.ts` verifies the Clerk JWT and upserts a `users` row keyed by `openId = clerk:<clerkUserId>`, providing the internal integer PK for `ctx.user.id`.

The frontend shows a dedicated `Landing.tsx` with email/Google sign-up modals to any signed-out visitor, and the full dashboard to signed-in users. Clerk's `<UserButton>` in the topbar handles account management and sign-out.

### DEMO_MODE — legacy single-tenant shortcut

When BOTH Clerk AND Manus OAuth are unset, the app falls back to **DEMO_MODE**: a single built-in user (`id: 1`, `openId: "demo-local-user"`) owns all data. This is useful for local development, internal demos, or deploying a personal-only instance. It is automatically disabled whenever Clerk is configured. To force it on while Manus OAuth is still set, use `VITE_DEMO_MODE=true` + `DEMO_MODE=true`.

**Railway checklist (Clerk mode):**

1. Provision a MySQL plugin in Railway and copy its `DATABASE_URL` into the service's Variables.
2. Set `JWT_SECRET` (any 64+ char string).
3. Set `VITE_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` from the Clerk dashboard.
4. Leave `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL` empty.
5. Deploy. The first boot auto-migrates the schema; every visitor signs up on the landing page and gets a private journal.


For the screenshot scanner & file uploads to work you need the Forge keys — see "Replacing LLM" / "Replacing Storage".

## 3 — Spin up MySQL (Docker option)

```bash
docker run --name apexhub-mysql \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=apexhub \
  -p 3306:3306 \
  -d mysql:8
```

## 4 — Push the schema

```bash
pnpm db:push
```

This runs `drizzle-kit generate && drizzle-kit migrate` and creates the tables defined in `drizzle/schema.ts`:

- `users`
- `monthly_snapshots` (one row per user × month, JSON payload)
- `trades` (one row per individual trade)
- `active_trades` (one row per user)

## 5 — Start dev server

```bash
pnpm dev
```

This boots:
- Express + tRPC API on `http://localhost:3000/api/*`
- Vite dev server (HMR) for the React frontend on the same port (proxied)

Visit `http://localhost:3000` in your browser.

## 6 — Build for production

```bash
pnpm build
```

Outputs:
- `dist/public/` — static frontend bundle
- `dist/index.js`  — bundled Express + tRPC server (single file, ESM)

## 7 — Run production build

```bash
NODE_ENV=production node dist/index.js
```

Server listens on `process.env.PORT || 3000`.

## 8 — Run tests

```bash
pnpm test
```

74 vitest cases cover: tRPC procedures, Excel export/import round-trip, KPI math, Greek month-key normalization, period filter, formatters.

---

## Deployment options

### A — Vercel (recommended for frontend-only mode)

Vercel hosts the **frontend** beautifully but is **not** a great fit for the long-running Express server out of the box. You have two options:

1. **Two-app split:** push the `client/` folder to Vercel as a static SPA, and host the Express server (`dist/index.js`) on Railway / Render / Fly.io / your own VPS. Set `VITE_API_BASE_URL` in Vercel pointing at the API host.
2. **Convert tRPC routes to Vercel Serverless Functions:** move `server/routers.ts` into `api/trpc/[...trpc].ts` and adapt the express handler to `@vercel/node`. Non-trivial — plan ~2 hours of refactor work.

For Vercel:
```bash
npm i -g vercel
vercel link
vercel env add DATABASE_URL
vercel env add JWT_SECRET
# ... add all vars from ENV_TEMPLATE.txt
vercel --prod
```

### B — Render / Railway / Fly.io (recommended for the all-in-one server)

These hosts run the bundled Express server natively. Workflow:

1. Connect your GitHub repo
2. Build command: `pnpm install && pnpm build`
3. Start command: `node dist/index.js`
4. Add all vars from `ENV_TEMPLATE.txt` as service env vars
5. Add a managed MySQL add-on (Railway, PlanetScale, Aiven, Neon, etc.)

### C — Docker

Create `Dockerfile`:
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

Build & run:
```bash
docker build -t apexhub .
docker run -p 3000:3000 --env-file .env apexhub
```

### D — Bare metal / VPS

```bash
# install Node 22 + pnpm
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pnpm pm2

# clone, install, build
git clone <your-repo> apexhub && cd apexhub
pnpm install
pnpm build

# run with pm2
pm2 start dist/index.js --name apexhub
pm2 save
pm2 startup
```

Put nginx in front for SSL termination + static caching.

---

## Replacing Auth

The bundled OAuth flow lives entirely in `server/_core/oauth.ts` and `client/src/_core/hooks/useAuth.ts`. To swap in your own provider:

1. Replace `server/_core/oauth.ts` with your callback handler (Auth0, Clerk, NextAuth, custom JWT, …). The only contract: set the `app_session_id` cookie containing a JWT payload that decodes to `{ openId: string, name: string, ... }`.
2. Adjust `getLoginUrl()` in `client/src/const.ts` to point at your provider's authorize URL.
3. Optionally drop the OAuth env vars from `.env`.

The rest of the app uses `ctx.user` from tRPC context which is populated by reading the cookie — that part stays unchanged.

## Replacing Storage

`server/storage.ts` exports `storagePut(key, bytes, contentType)` returning `{ key, url }`. To swap from Manus Forge to:

- **AWS S3 / MinIO:** install `@aws-sdk/client-s3`, replace the body of `storagePut` with `PutObjectCommand`. Front the bucket with CloudFront or a presigned-URL middleware.
- **Supabase Storage:** install `@supabase/supabase-js`, use `supabase.storage.from('apexhub').upload(key, bytes)`.
- **Vercel Blob:** install `@vercel/blob`, use `put(key, bytes, { access: 'public' })`.

Update the `/manus-storage/*` proxy in `server/_core/storageProxy.ts` if your URLs need signing.

## Replacing LLM (screenshot scanner)

`server/_core/llm.ts` exports `invokeLLM({ messages, response_format, ... })` returning OpenAI-compatible chat completions. To use OpenAI directly:

```ts
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export async function invokeLLM(args) {
  return openai.chat.completions.create({ model: "gpt-4o-mini", ...args });
}
```

Add `OPENAI_API_KEY` to your `.env` and remove the Forge vars.

---

## Project layout

```
client/
  public/            # favicon, robots.txt
  src/
    components/      # UI components (AddTradeModal, ImportExcelModal, NewMonthModal, ...)
    pages/           # Home (the dashboard), NotFound
    hooks/           # useJournal — central data hook
    lib/             # trading.ts, exportExcel.ts, importExcel.ts, monthlyHistory.ts, ...
    contexts/        # ThemeContext
    _core/           # framework plumbing (auth hook, etc.)
    App.tsx          # routes
    main.tsx         # tRPC + QueryClient bootstrap
    index.css        # Tailwind layer + theme tokens
drizzle/
  schema.ts          # all DB tables (users, monthly_snapshots, trades, active_trades)
  migrations/        # generated SQL (created by `pnpm db:push`)
server/
  _core/             # framework plumbing (oauth, context, vite bridge, llm, ...)
  db.ts              # Drizzle query helpers
  routers.ts         # tRPC procedures (journal.* + auth.* + system.*)
  storage.ts         # S3 helpers
  *.test.ts          # vitest server tests
shared/
  const.ts           # shared constants (UNAUTHED_ERR_MSG, ...)
  types.ts           # shared types
ENV_TEMPLATE.txt     # env var documentation
README.md            # quick-start
SELF_HOSTING.md      # this file
package.json
pnpm-lock.yaml
vite.config.ts
drizzle.config.ts
vitest.config.ts
tsconfig.json
tailwind.config.js  (via Tailwind 4 inline @theme in index.css)
```

---

## Common issues

- **"Cannot find module 'mysql2'"** — run `pnpm install` again
- **"DATABASE_URL is empty"** — your `.env` is not being read. Check filename (`.env`, not `.env.txt`) and that you're running from the project root
- **Login redirects to `manus.im`** — you haven't replaced OAuth yet (see "Replacing Auth")
- **Screenshot scanner returns 401** — Forge keys missing; either set them or swap LLM (see "Replacing LLM")
- **Greek month names appear as `?????`** — your MySQL collation is not utf8mb4. Run `ALTER DATABASE apexhub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`

---

## License

Personal / internal use. Do not redistribute without permission.
