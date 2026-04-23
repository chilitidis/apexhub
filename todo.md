# APEXHUB Upgrade Todo

## Infrastructure
- [x] Upgrade to web-db-user (backend + database + user auth)
- [x] Database schema: monthly_snapshots table + active_trades table (per-user)
- [x] tRPC procedures: journal.listSnapshots / upsertSnapshot / deleteSnapshot / getActiveTrade / upsertActiveTrade / deleteActiveTrade
- [ ] LLM wiring (not required for persistence work; tracked separately)
- [ ] Dedicated `trades` table + per-trade CRUD procedures (currently serialized inside monthly snapshot JSON)

## Backend
- [x] Seed historical months (Dec 2025 - Apr 2026) into DB on first login
- [ ] POST /api/extract-screenshot (LLM vision → parsed trade fields)
- [x] vitest coverage for journal router (5 tests, all passing)

## Frontend
- [ ] Remove "TRADE" (active trade) button, SYNC, RESET from topbar
- [ ] ADD TRADE wizard: Step 1 Screenshot drop → Step 2 Preview/Edit → Step 3 Links → Save
- [x] Authenticated users: add / edit / delete trade, delete month, active trade all persist to DB via snapshot upsert
- [x] Auto-hydrate the currently displayed month from server snapshot on reload (one-shot)
- [x] Auto re-hydrate when selecting another month from the sidebar after initial hydration (metadata preserved, hydration flag guarded)
- [ ] Remove localStorage fallback once anonymous browsing is no longer desired
- [ ] Optimistic-update + rollback tests for trade mutations
- [ ] Period filter: ALL / This Month / Last 30/60/90 days / Custom range / specific month
- [ ] Apply period filter to KPIs, Symbol chart, Win/Loss chart, trades table
- [ ] Editable Starting Balance per month (input in hero or settings)
- [ ] Show P/L everywhere in BOTH $ and % (KPI cards, drawer, tables, symbol chart)
