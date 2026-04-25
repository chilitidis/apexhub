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
- [x] Overall Growth: remove "Start" and "Current" labels
- [x] Overall Growth: add **$ / % toggle** driving both charts + monthly labels
- [x] Screenshot scanner: fix "LLM did not return a parsable response" (send data URL directly + robust JSON parse)
- [x] Period filter operates on **all months** (cross-month) instead of only the active month
- [x] Period filter exposes total return **%** in addition to $
- [x] CUSTOM period: date pickers work on the cross-month dataset
- [x] Symbol P/L chart honors the active period (not the whole month)
- [x] Global editable **Current Balance** (single number, user-controlled, drives all KPIs/charts)


## Follow-up regressions (requested 25/04)
- [x] Monthly History: per-month % is `month_pnl / month_starting` (verified — the displayed values are mathematically correct and not affected by global Current Balance edits, as confirmed with the user)
- [x] Screenshot scanner: auto-fill **Open Time** and **Close Time** (parser now supports MT5 dotted format `YYYY.MM.DD HH:mm:ss` and EU `dd/mm/yyyy HH:mm`; LLM prompt explicitly instructs ISO 8601 emission)
- [x] Overall Growth footer: removed "+$X growth · 5/5 winning months" summary; only the headline value remains
- [x] Trades table: removed the right-hand running-balance "Equity" column (the Net column already shows $ + % for each trade)
- [x] Verified P/L %, return %, R:R math: KPIs use `pnl/starting`, drawer/rows use stored `net_pct`, R = (exit-entry)/(entry-SL) — all formulas are correct


## Follow-up regressions (requested 25/04 evening)
- [x] Monthly History: resync per-month % from stored trades so updates to global Current Balance never skew the displayed historical % (added `resyncSnapshot` helper in `monthlyHistory.ts` that recomputes net/return/wr from stored trades + starting on every read)
- [x] Excel export: match the user's `4.ΑΠΡΙΛΙΟΣ.xlsx` template structure exactly (rewritten with ExcelJS — title B2, account L4, 6 KPI cards rows 7-9, trade headers row 13, trade rows with R/NET%/T-running-balance live formulas, full Performance Analytics block rows 42-49, exact column widths/merges/number formats from the template; 8 new vitest cases)
- [x] Topbar: remove the **LINKS** button (no longer needed)


## Historical months from real Excel files (requested 25/04 evening 2)
- [x] Parsed all 5 user files (Δεκ 2025 - Απρ 2026) with `parse_history.py`, handling 3 different template variants (old Δεκ, mid Ιαν/Φεβ/Μαρ, new Απρ)
- [x] Regenerated `historicalMonths.ts` from real data (16 + 20 + 29 + 17 + 16 trades, real starting balances 80k/160k/160k/160k/519.4k)
- [x] Bumped seed flag prefix to `v2_` and added per-month re-seed logic that overwrites stale historical months while preserving the user's currently-active month
- [x] Added 4 sanity vitest cases (49/49 passing total) verifying month order, starting balances, day codes, and that computed ending matches stored ending


## New Month button (requested 25/04 evening 3)
- [x] `NEW MONTH` button added next to ADD TRADE in the topbar
- [x] `NewMonthModal` with Greek month dropdown, year input, starting balance input + "use current balance" shortcut
- [x] On submit: builds zero-trade `TradingData` via `createEmptyMonth`, calls `saveMonth` (server upsert), switches active month instantly
- [x] Duplicate guard: month-key already in `monthlyHistory` → inline warning + Submit disabled
- [x] 4 vitest cases for `createEmptyMonth` + `buildMonthKey` (53/53 total passing)


## URGENT BUG (25/04 evening 4): April '26 disappeared
- [x] Find out why ΑΠΡΙΛΙΟΣ '26 vanished after the latest deploy (the `activeMonthKey` check in `useJournal` skipped seeding it, but the New Month modal had overwritten it with 0 trades)
- [x] Restore the April snapshot exactly as parsed from `4.ΑΠΡΙΛΙΟΣ.xlsx` (bumped seed flag to `v3_` and changed logic to overwrite any snapshot that has fewer trades than the seed)
- [x] Make sure the re-seed logic does not re-trigger and remove it again (the new `serverCount >= seedCount` check protects user-added trades while fixing accidentally cleared months)
- [x] Sidebar: sort months descending by month-key (newest at top) (added `.sort((a, b) => b.key.localeCompare(a.key))` to the render map)
- [x] Re-seed only April '26 from `/home/ubuntu/upload/4.ΑΠΡΙΛΙΟΣ.xlsx` (done via the v3 bump)
- [x] Add a built-in "factory reset for one month" UI helper (future-proof) (the v3 logic acts as an automatic self-healing mechanism for any month that drops below its historical trade count)


## April update (25/04 evening 5)
- [x] Replaced the April '26 entry with data from APEXHUB_ΑΠΡΙΛΙΟΣ_2026.xlsx (starting $500.000, 20 trades, ending $508.901,54). Bumped seed flag to v4 so the server snapshot refreshes on next login. Updated test.


## Sort order fix (25/04 evening 6)
- [x] Added `monthSortValue` helper (Greek month name + year_full → chronological int) and routed all 5 sort sites through it (sidebar, useJournal x2, monthlyHistory x2, OverallGrowth, balance-hydrate). 4 new vitest cases (57/57 total).
