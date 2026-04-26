# APEXHUB Trading Journal

Personal trading journal & analytics dashboard. Live demo: https://apexhub.manus.space/

## Stack at a glance

- **Frontend:** React 19 + Vite + TypeScript + TailwindCSS 4 + shadcn/ui + Recharts + Framer Motion
- **Backend:** Node 22 + Express 4 + tRPC 11 + Drizzle ORM
- **Database:** MySQL 8 (or any MySQL-compatible: TiDB, PlanetScale, MariaDB 10.11+)
- **Auth:** Manus OAuth (swappable — see `SELF_HOSTING.md`)
- **Storage:** S3-compatible (Manus Forge by default — swappable)
- **LLM (screenshot scanner):** Manus Forge (swappable to OpenAI/Anthropic)

## Quick start

```bash
# 1. install deps
pnpm install

# 2. configure environment
cp ENV_TEMPLATE.txt .env
# edit .env — fill in DATABASE_URL + JWT_SECRET at minimum

# 3. push DB schema
pnpm db:push

# 4. start dev server
pnpm dev

# → open http://localhost:3000
```

## All available scripts

| Command | What it does |
|---|---|
| `pnpm install` | install all dependencies |
| `pnpm dev` | start dev server (Express + Vite HMR) on :3000 |
| `pnpm build` | production build → `dist/public/` (frontend) + `dist/index.js` (server) |
| `pnpm start` | run production build |
| `pnpm test` | run all 74 vitest cases |
| `pnpm db:push` | generate + apply Drizzle migration to the configured `DATABASE_URL` |
| `pnpm format` | prettier across the codebase |
| `pnpm check` | typecheck (`tsc --noEmit`) |

## Features

- **Multi-month dashboard** — KPI cards, equity curve, drawdown, P/L, win-rate, symbol breakdown
- **Per-trade entry** with 4-step wizard: ID, Prices/P&L, Charts, Notes (lessons + psychology + pre-checklist)
- **Screenshot scanner** — paste an MT5/TradingView screenshot, LLM vision extracts entry/exit/SL/TP/lots
- **Active trade banner** — pinned at top while a trade is open, shows live floating P/L
- **NEW MONTH** button — start a fresh month with a custom starting balance
- **IMPORT** button — drag/drop a `.xlsx` to bulk-load a month (round-trips notes too)
- **EXPORT** — write the active month to APEXHUB-format Excel (with notes in a 2nd sheet)
- **Monthly History sidebar** — chronological newest-first, with WR + return % per month
- **Period filter** — ALL / THIS MONTH / 30D / 60D / 90D / CUSTOM, applied across KPIs + charts + tables
- **Editable Current Balance** — drives all global KPIs

## Documentation

- **`SELF_HOSTING.md`** — full deployment guide (Vercel, Render, Docker, VPS) + how to swap auth/storage/LLM providers
- **`ENV_TEMPLATE.txt`** — every environment variable with description

## Tests

```bash
pnpm test
```

74 vitest cases passing — covers tRPC procedures, Excel export/import round-trip, KPI math, Greek month-key normalization (handles `ΜΑΪΟΣ` vs `ΜΑΙΟΣ`), period filter, formatters, screenshot extraction prompt building.

## License

Personal / internal use.
