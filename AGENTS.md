# Safe2Save — Agent Instructions
Standing context for this project. Loaded automatically every Pi session — task-specific instructions belong in the brief pasted at the start of each session, not here.

## Project Overview

Safe2Save is a personal finance tracker for people with irregular income. Core feature: given a manually entered bank balance, it calculates a "safe to save" amount — how much can be moved to savings without eating into the runway needed to cover upcoming spending. Static site, no build step, backed by Supabase (Postgres + Auth), hosted on GitHub Pages. Mobile is the primary target device.

## Tech Stack

- Vanilla HTML / CSS / JavaScript — no framework, no bundler, no build step
- Chart.js (loaded via CDN) for dashboard charts
- Supabase (Postgres + Auth) for the backend — RLS enabled on every table
- No test framework, no linter, no package.json — this is intentional, keep it dependency-free unless explicitly asked to add tooling

## Project Structure

```
index.html        # Landing page
login.html        # Auth (signup/login via synthetic email + password)
dashboard.html     # Overview, charts, recent transactions
log.html            # Log a transaction
checkin.html          # Balance check-in / safe-to-save calculator
settings.html          # Preferences, budget, export, sign out
css/style.css            # All styles, single file
js/supabase.js             # Supabase client init (URL + anon key)
js/auth.js                  # Auth handling (AUTH module)
js/categories.js              # Category defs + colors (CAT module)
js/utils.js                    # Shared helpers (U module) — spend filtering, formatting, date math
supabase/migration.sql           # Schema + RLS policies, run manually in Supabase SQL editor
```

## Known Bug Patterns — Regression Watchlist

These have broken before during audit cycles. Any change touching these areas needs explicit verification against the specific edge case noted, not just "looks right":

- **Burn-rate cliff (checkin.html, `computeRecommendation`)** — the averaging window jumps from 14 to 30 days the moment `historyDays >= 14` (line ~153), and separately switches from computed average to `starting_daily_estimate` when `uniqueDays < 5`. Both are hard thresholds, not gradual transitions, so a user's `avgDailySpend` can jump discontinuously right at those boundaries. Any change to this function must be tested with history right before and right after both thresholds (day 4 vs day 5, day 13 vs day 14).
- **Chart date-range alignment (dashboard.html, `reloadAll` + `renderSpendingChart`/`renderSavingsChart`)** — the transaction fetch uses `since = U.daysAgoStr(currentWindow - 1)` while the chart tabs are `7 / 30 / 365`. Any change to the window logic or chart rendering must confirm the fetched date range and the rendered bucket range agree exactly at both ends, for all three window sizes.
- **Non-spend / transfer exclusion (`js/utils.js`, `isRealSpend` + `NON_SPEND_CATEGORIES`)** — `isRealSpend()` is the single source of truth for whether a transaction counts as real spend (excludes `type === "income"` and the `NON_SPEND_CATEGORIES` list, currently just `["Savings"]`). Any new spend-total calculation must route through `U.isRealSpend` / `U.spendTotal` rather than reimplementing the filter — a second filter that drifts from this one is how transfers get miscounted as spending again.

## House Rules

- Do not approximate financial calculation logic. If correctness is ambiguous, stop and flag it rather than guessing.
- After any change to `computeRecommendation`, chart date logic, or spend filtering, state which test case(s) were used — include at least one edge case from the watchlist above.
- No build step, no test runner, no linter exists — verify by serving the folder statically (`npx serve` or similar) and checking in-browser. Match existing code style (this codebase mixes `var` and `const`/`let`; follow whatever the specific file already uses rather than normalizing across files).
- `occurred_on` is a plain date string (`YYYY-MM-DD`); `created_at`/`checked_at` are `timestamptz`. Don't conflate them — use `U.localDateStr()` when converting a timestamp to a local calendar date, since UTC+8 (Sabah) means midnight–8am UTC can otherwise land on the wrong day.
- Every Supabase table has RLS policies scoped to `auth.uid()` — do not modify `supabase/migration.sql` policies without explicitly flagging the change, since a mistake here is a data-leak risk, not just a bug.
- Don't commit `desktop.ini` or other Windows filesystem metadata files — one is already tracked in the repo root and shouldn't have been; avoid adding more, and use relative/POSIX-style paths in any new file references regardless of what OS the edit was made on.
- Custom categories are stored in `localStorage` on the client and synced from Supabase (`CAT.syncFromServer`) — server data is treated as authoritative for existing names, local-only entries are preserved. Keep that merge direction if touching category logic.

## Local Setup (for reference, not to be repeated by the agent)

No build step. Clone, create a Supabase project, run `supabase/migration.sql` against it, put the project URL + anon key into `js/supabase.js`, then serve the folder statically.