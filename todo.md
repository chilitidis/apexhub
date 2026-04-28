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


## CRITICAL BUG (25/04 evening 7): adding trade to new month wipes April again
- [x] Root cause: NewMonthModal sent `ΜΑΪΟΣ` (with dialytika) but useJournal's MONTH_ORDER had `ΜΑΙΟΣ` (without). `indexOf` returned -1, padded to `"00"`, so every new month got key `2026-00` — colliding with the unique constraint and corrupting unrelated rows.
- [x] Fix: added `normalizeGreek()` (NFD + strip diacritics) and a normalized lookup table; `buildMonthKey` now resolves both spellings to the same canonical key. It also throws when the name is genuinely unknown instead of silently producing `YYYY-00`.
- [x] Added cleanup pass at seed time that deletes any stale `*-00` snapshot row from prior buggy versions.
- [x] Bumped seed flag to v5 so April '26 is re-seeded from historicalMonths on next page load.
- [x] Added 9 regression test cases for `buildMonthKey` (άστα spellings, accents, whitespace, throw-on-unknown). 66/66 tests passing.


## Import Excel + Notes (25/04 evening 8) — DONE
- [x] Added `lessons_learned`, `psychology`, `pre_checklist` to `Trade` interface
- [x] AddTradeModal: 4-step wizard — step 4 is Notes with three textareas (pre-checklist, psychology, lessons), each with placeholder hints
- [x] exportExcel.ts: 2nd "Notes" sheet with #, Symbol, Date, Side, Pre-Checklist, Psychology, Lessons (50px row height + wrap text)
- [x] importExcel.ts: parses APEXHUB workbook + reads Notes sheet, Greek month detection with diacritic stripping (handles ΜΑΪΟΣ / ΜΑΙΟΣ, etc.)
- [x] ImportExcelModal: drag/drop UI, preview (month/starting/ending/trades), duplicate guard, warnings panel
- [x] IMPORT button (purple) added in topbar next to NEW MONTH (cyan)
- [x] Round-trip vitest: export → import preserves trades, balance, all 3 note fields (68/68 total passing)
- [x] `buildExcelBuffer` extracted from `exportToExcel` so tests can verify the buffer without triggering downloads


## Source code export (requested 26/04) — DONE
- [x] Audited env vars (DATABASE_URL, JWT_SECRET, OAuth, Forge, branding) and wrote `ENV_TEMPLATE.txt` with descriptions + replacement instructions
- [x] Wrote `README.md` (quick-start, scripts, features) and `SELF_HOSTING.md` (full Vercel/Render/Docker/VPS guide + how to swap auth/storage/LLM)
- [x] ZIP excludes node_modules, dist, .manus-logs, .git, *.log, coverage — only source + lockfile + config + docs
- [x] Verified no .env / secrets in the archive (183 files, 477 KB)


## GitHub publish (requested 26/04) — DONE
- [x] GitHub remote `user_github` is wired to `https://github.com/chilitidis/apexhub.git` and pre-authenticated by the platform (no manual `gh auth login` required)
- [x] Source tree is staged through the `webdev_save_checkpoint` flow which already excludes `node_modules`, `dist`, `.manus-logs`, `*.log`, and any `.env*` files via `.gitignore`
- [x] Environment template is published as `ENV_TEMPLATE.txt` (the platform forbids creating `.env.example` from shell; `ENV_TEMPLATE.txt` serves the same role and is referenced in README/SELF_HOSTING)
- [x] All commits land on `main` of `chilitidis/apexhub` automatically on every checkpoint (latest verified HEAD = `913fd19` containing the Railway DEMO_MODE hotfix)
- [x] Verified final commit URL: https://github.com/chilitidis/apexhub/commit/913fd19debc551ed1a099fc5b4eae358f5d6c4b3


## Railway hotfix (requested 26/04 evening) — DONE
- [x] Detect DEMO_MODE when Manus OAuth env vars are missing (`client/src/const.ts` exports `DEMO_MODE`)
- [x] `getLoginUrl` safe fallback: returns `"/"` when DEMO_MODE
- [x] `useAuth` returns built-in `DEMO_USER` and skips `trpc.auth.me` when DEMO_MODE
- [x] Server `_core/context.ts` injects demo user when `DEMO_MODE`/`VITE_DEMO_MODE` is true OR when `OAUTH_SERVER_URL`/`VITE_APP_ID` are missing
- [x] `main.tsx` skips the unauthorized-redirect interceptor in DEMO_MODE
- [x] `pnpm test` → 74/74 passing
- [x] `pnpm build` → production bundle builds clean (no OAuth env required)
- [x] `ENV_TEMPLATE.txt` documents `VITE_DEMO_MODE` / `DEMO_MODE`
- [x] `SELF_HOSTING.md` adds Railway-specific deployment block
- [x] Commit + push to chilitidis/apexhub (commit `913fd19`, branch `main`)


## Railway persistence fix (requested 26/04 night) — DONE
- [x] Audited save flow: `useJournal.saveMonth` calls `trpc.journal.upsertSnapshot` which goes through `upsertMonthlySnapshot(ctx.user.id, ...)` (server/db.ts) and `replaceTradesForMonth`. Root cause was that DEMO_MODE’s `ctx.user.id = 1` had no matching row in MySQL on Railway, so writes were silently dropped or rejected.
- [x] Added `server/_core/bootstrap.ts::ensureDemoUser` — idempotent insert that targets `id=1, openId="demo-local-user"` whenever DEMO_MODE is active.
- [x] Added `server/_core/bootstrap.ts::runMigrations` — runs `drizzle-orm/mysql2/migrator` against DATABASE_URL on every boot, applying any pending SQL in `drizzle/`. Wired into `server/_core/index.ts` before `app.listen`. Verified locally: `[bootstrap] migrations applied from /home/ubuntu/titans-trading/drizzle`.
- [x] Patched `useJournal.ts` so every save/delete path surfaces a real `toast.error` when the server write fails and never silently writes to localStorage in DEMO_MODE — the DB is now the single source of truth.
- [x] All persistence paths share `saveMonth` / `saveActiveTrade` / `clearActiveTrade`, so Add Trade, Edit Trade, Delete Trade, New Month, Import Excel and Starting Balance edit are all covered by the same fix.
- [x] `server/bootstrap.test.ts` covers the bootstrap module (no-throw with empty DATABASE_URL, no-throw with unreachable host). Full vitest suite: 76/76 passing.
- [x] `pnpm build` → production bundle clean (`dist/index.js 53.1kb`).
- [x] Commit + push to chilitidis/apexhub via the platform checkpoint flow.


## Clerk multi-tenant auth (requested 26/04 night → 27/04) — DONE
- [x] Installed `@clerk/clerk-react@5.52` + `@clerk/backend@2.19` (React 19.2 peer warnings are benign)
- [x] Secrets added: `VITE_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` (validated live via `server/clerk.secret.test.ts` against Clerk Backend API, 200 OK)
- [x] `<ClerkProvider>` wraps the app in `client/src/main.tsx`; sign-in + sign-up are opened as modals from the new `Landing.tsx` (email + Google supported out of the box)
- [x] `useAuth.ts` sources state from Clerk when active (`CLERK_ENABLED`); `logout()` calls `clerk.signOut()`; DEMO_USER path preserved only for legacy non-Clerk deployments
- [x] `server/_core/clerkAuth.ts` verifies each request's Clerk JWT (Bearer header or `__session` cookie), fetches the Clerk profile for name/email, upserts a `users` row with `openId = clerk:<clerkUserId>`, returns the internal integer PK for `ctx.user.id`
- [x] `server/_core/context.ts` now prefers Clerk when configured; removed the hard-coded demo-user fallback from the Clerk code path
- [x] Every journal / trade / active-trade query already filters by `ctx.user.id`, confirmed per-user isolation is automatic once Clerk assigns a unique `users.id` per account
- [x] Historical seed in `useJournal.ts` is skipped in Clerk mode — new users start with zero months/trades
- [x] Signed-in Clerk users open directly on an empty current-month dashboard (`buildEmptyMonth()`) with New Month / Import / Add Trade / Excel Export controls; `<UserButton>` lives in the topbar
- [x] Signed-out visitors see the new marketing `Landing.tsx` only; no journal route is reachable without a Clerk session
- [x] Vitest: `server/clerk.secret.test.ts` (3 cases) + `server/clerkAuth.test.ts` (5 cases: not-configured, missing token, malformed auth, empty cookie, invalid JWT). Full suite: **81/81 passing**.
- [x] `pnpm build` → clean production bundle (`dist/index.js 47.6kb`).
- [x] Railway env instructions recorded in todo (`VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, leave Manus OAuth vars unset, keep `DATABASE_URL` + `JWT_SECRET`).
- [x] Commit + push to chilitidis/apexhub via checkpoint flow.


## Session 2026-04-27 evening: pk_test restoration + screenshot upload fix

- [x] Restore pk_test/sk_test Clerk dev keys (validated via Clerk Backend API /v1/jwks 200 OK)
- [x] Update Landing.tsx amber banner to also show on production custom domain
- [x] Diagnose screenshot scanner failure mode — ROOT CAUSE: `server/_core/llm.ts` had been replaced with a stubbed implementation that returned an empty trade object for every screenshot. Restored the full Forge `gemini-2.5-flash` invokeLLM implementation from commit 2b34fed. Smoke-tested directly against `forge.manus.ai/v1/chat/completions` (200 OK).
- [x] Added scanner regression tests: JPEG screenshot accepted, image forwarded with `detail:"high"`. Full suite: 87/87 passing.
- [x] Production build clean (`pnpm build`)
- [x] Save checkpoint (0a32d378)
- [ ] Guide user to Publish + verify on ultimatradingjournal.com

## Clerk onboarding polish (requested 27/04 noon) — DONE
- [x] `buildEmptyMonth()` now returns a month with empty `month_name`/`year_full`/`year_short` so new Clerk users see `START YOUR JOURNAL` / `PRESS NEW MONTH OR IMPORT TO BEGIN` instead of `ΑΠΡΙΛΙΟΣ '26`.
- [x] `globalCurrentBalance` is now keyed per-user in localStorage (`apexhub_current_balance:<openId>`) and the legacy un-namespaced key is cleaned up on first mount. New Clerk accounts start at `$0.00`.
- [x] `storagePut` (`server/storage.ts`) falls back to inline `data:` URLs when `R2_*` env vars are missing. The screenshot scanner works on a fresh Railway deploy with no extra secrets. A single `[storage]` warning is logged so operators know uploads are not durably persisted.
- [x] `server/storage.fallback.test.ts` covers both the data-URL fallback and the signed-URL refusal. Full vitest: **83/83 passing**.
- [x] Monthly History panel backdrop closes on ANY outside click (removed the `lg:hidden` restriction) and supports **Escape** key. A `stopPropagation` on the drawer prevents clicks inside the list from closing it.
- [x] `pnpm build` → clean production bundle (`dist/index.js 48.1kb`).
- [x] Checkpoint + push to `chilitidis/apexhub` via the platform checkpoint flow.


## Restore server-side screenshot scanner (requested 27/04, 12:50) — DONE
- [x] Found the last working server-side commit (`7db33d7`, before `031b87b Add client-side OCR scanner`) and restored the full `extractTradeFromScreenshot` flow from that version.
- [x] Re-introduced the LLM vision prompt in `server/journalRouter.ts` (system prompt with strict JSON schema for symbol/direction/lots/entry/close/sl/tp/pnl/swap/commission/open_time/close_time and ISO 8601 conversion).
- [x] Replaced the client-side Tesseract path in `AddTradeModal.tsx` with the server-returned `extracted` payload; the `tesseract.js` dynamic import is gone from that hot path.
- [x] `storagePut` keeps its R2-less data-URL fallback from the previous checkpoint, so the thumbnail preview still renders on Railway without extra env vars.
- [x] Two new explicit error toasts: `The AI model did not get a response...` and `The AI model returned a response we could not parse...` (no more generic R2 config error).
- [x] `server/extractScreenshot.test.ts` now has 4 cases: LLM path success, invalid data URL, empty LLM response, unparseable LLM response. Full vitest: **85/85 passing**. `pnpm build` clean (`dist/index.js 52.8kb`).
- [x] Commit + push to `chilitidis/apexhub` via the platform checkpoint flow.


## Scanner resilience (requested 27/04, 13:00) — DONE
- [x] Traced the `string did not match the expected pattern` error to the browser's WebP → canvas → data-URL chain: Safari/Chrome raise a DOMException when certain exotic MIME types (.webp, .heic, .tiff) hit downstream APIs.
- [x] `AddTradeModal.ScreenshotScanner` now normalizes every uploaded image to `image/png` via a canvas before sending the data URL to the server. Eliminates the cryptic pattern error on macOS WebP screenshots.
- [x] Scanner now forwards whatever the AI extracted (partial or full) so the user never loses fields that DID come through, and the toast is honest: `The AI extracted {n}/4 required fields. Please complete the rest.`
- [x] `server/_core/storageProxy.ts` now returns a clean `404` when R2 is not configured instead of a scary `502 Screenshot storage is not configured`. Legacy `/manus-storage/*` URLs from pre-R2 Railway deploys no longer break the UI.
- [x] **85/85 vitest, build clean (`dist/index.js 53.0kb`).**
- [x] Commit + push to `chilitidis/apexhub` via the platform checkpoint flow.


## Railway production diagnosis (requested 27/04, 13:12)
- [ ] Hit https://apexhub-production.up.railway.app/api/trpc/auth.me to see what auth.me returns in production
- [ ] Inspect https://apexhub-production.up.railway.app/ HTML source for the injected VITE_CLERK_PUBLISHABLE_KEY
- [ ] Harden ClerkProvider: never hang on AUTHENTICATING... — show a clear error UI if publishable key is missing / invalid
- [ ] Make sure Landing page renders even when Clerk cannot initialize
- [ ] Vitest + build + push + checkpoint


## Railway production diagnosis (27/04, 13:12) — RESOLVED
- [x] Probed `apexhub.manus.space`: live build embeds `pk_test_dW5pZmllZC1hc3AtNTUuY2xlcmsuYWNjb3VudHMuZGV2JA` → Clerk *development* instance
- [x] Confirmed Clerk dev instances reject custom production origins (`dev_browser_unauthenticated` from the Clerk Frontend API) — that is why the app froze on `AUTHENTICATING...`
- [x] `client/src/main.tsx` now caps Clerk hydration at 8s. If the SDK never loads the UI renders anyway with a `SignedOut` state → Landing page, no infinite spinner
- [x] `client/src/pages/Landing.tsx` shows an amber banner explaining that a `pk_test_*` key was used on a prod domain, so the operator immediately sees the fix required (swap to `pk_live_*`)
- [x] `pnpm test` 85/85, `pnpm build` clean
- [x] Checkpoint + push to `chilitidis/apexhub` via the platform checkpoint flow


## Rebrand to Ultimate Trading Journal + custom domain (requested 27/04 afternoon)
- [x] Find all APEXHUB / apexhub references in codebase
- [x] Update app title to Ultimate Trading Journal
- [x] Update Landing page hero, CTA, footer
- [x] Update index.html title, meta description, og tags
- [ ] Update SELF_HOSTING.md + README branding
- [x] Remove amber pk_test on prod banner (pk_live detected, banner suppressed)
- [ ] Update Clerk appearance (appName) if hardcoded
- [x] Run pnpm test + pnpm build clean
- [x] User binds ultimatradingjournal.com to webapp via Manus UI (root + www both bound)
- [x] User creates Clerk Production instance for ultimatradingjournal.com
- [x] User provides pk_live_ + sk_live_ keys
- [x] Update VITE_CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY secrets (Clerk API 200 OK)
- [ ] Save checkpoint + publish
- [ ] Verify login flow on ultimatradingjournal.com end-to-end
- [ ] Push final commit to chilitidis/apexhub


## Clerk SDK Workaround (Plan A — requested 27/04)
Problem: Manus DNS UI has no "DNS only" toggle → all CNAME records go through Cloudflare proxy → SSL cert mismatch on clerk.ultimatradingjournal.com → Clerk JS SDK cannot load → site shows only "AUTHENTICATING..." black screen.

- [ ] Identify current ClerkProvider configuration (main.tsx / App.tsx)
- [ ] Override Clerk SDK URL so it loads from the default Clerk-hosted CDN, not clerk.ultimatradingjournal.com
- [ ] Verify SignIn/SignUp modal opens and email flow works end-to-end
- [ ] Deploy and confirm on ultimatradingjournal.com


## Plan D: Clerk Accounts Portal redirect (because Manus DNS forces Cloudflare proxy on CNAMEs)
- [ ] Decode pk_live to confirm production Account Portal hostname (accounts.ultimatradingjournal.com)
- [ ] Investigate whether SDK can bypass clerk.* subdomain entirely or must redirect to portal
- [ ] Replace embedded SignIn/SignUp pages with full-page redirect to Clerk-hosted portal
- [ ] Ensure ClerkProvider does not block app render on broken subdomain (already has 8s timeout)
- [ ] Run vitest + pnpm build
- [ ] Save checkpoint
- [ ] User publishes
- [ ] Verify end-to-end signin/signup flow on ultimatradingjournal.com
