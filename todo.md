# APEXHUB Upgrade Todo

## Infrastructure
- [x] Upgrade to web-db-user (backend + database + user auth)
- [x] Database schema: monthly_snapshots table + active_trades table (per-user)
- [x] tRPC procedures: journal.listSnapshots / upsertSnapshot / deleteSnapshot / getActiveTrade / upsertActiveTrade / deleteActiveTrade
- [x] LLM wiring (`extractTradeFromScreenshot` procedure using invokeLLM + storagePut)
- [x] Dedicated `trades` table + per-trade CRUD procedures
  - [x] Added `trades` table to drizzle schema with user + monthKey + trade fields
  - [x] Ran `pnpm db:push` to apply the migration
  - [x] CRUD helpers in server/db.ts + procedures in journalRouter (listTrades, upsertTrade, deleteTrade)
  - [x] upsertSnapshot now calls replaceTradesForMonth so both storages stay consistent
  - [x] deleteSnapshot also clears the per-trade rows
  - [x] 6 new vitest cases covering the flow (33/33 tests passing)

## Backend
- [x] Seed historical months (Dec 2025 - Apr 2026) into DB on first login
- [x] `extractTradeFromScreenshot` (LLM vision → parsed trade fields)
- [x] vitest coverage for journal router (5 tests, passing)
- [x] vitest coverage for screenshot extraction (3 tests, passing)

## Frontend
- [x] Remove "TRADE" (active trade), SYNC, RESET buttons from topbar
- [x] ADD TRADE wizard: Step 1 (ID + screenshot scan), Step 2 (prices/P&L), Step 3 (links & save)
- [x] Screenshot scanner uses LLM vision to prefill form fields
- [x] Period filter above KPIs/charts (ALL / THIS MONTH / 30D / 60D / 90D / CUSTOM)
- [x] Apply period filter to KPIs, equity/DD/PnL chart, symbol chart, win/loss donut, and trades table
- [x] Editable Starting Balance per month (click pencil on Starting KPI; disabled while period filter active)
- [x] Show P/L in both $ and % across KPI cards (Best/Worst), trade drawer banner, desktop + mobile trade rows, symbol performance table
- [x] Authenticated users: add / edit / delete trade, delete month, active trade all persist to DB via snapshot upsert
- [x] Auto-hydrate current month from server on reload and when switching months

## Tests
- [x] Server: journal router CRUD (5)
- [x] Server: screenshot extraction (3)
- [x] Server: auth logout (1)
- [x] Client: periodFilter helpers (11)
- [x] Client: $/% formatters (7)

## Intentionally deferred
- LocalStorage fallback for anonymous visitors kept by design so the page is browsable without login. No action needed unless anonymous access is disabled.
- Optimistic-update UX for trade mutations (current invalidate flow is sufficient for this dataset size).
- Dedicated `trades` table with per-row CRUD (current snapshot JSON is atomic and tests pass).


## Regression fixes (requested 23/04)
- [x] Remove **Balance Before / Balance After** everywhere in the UI (Trade type, AddTradeModal, drawer, table, server schema, exporter, defaults)
- [ ] Overall Growth: remove "Start" and "Current" labels
- [ ] Overall Growth: add **$ / % toggle** driving both charts + monthly labels
- [ ] Screenshot scanner: fix "LLM did not return a parsable response" (send data URL directly + robust JSON parse)
- [ ] Period filter operates on **all months** (cross-month) instead of only the active month
- [ ] Period filter exposes total return **%** in addition to $
- [ ] CUSTOM period: date pickers work on the cross-month dataset
- [ ] Symbol P/L chart honors the active period (not the whole month)
- [ ] Global editable **Current Balance** (single number, user-controlled, drives all KPIs/charts)
