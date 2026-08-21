# Theming — Category Palettes, App Accents & Grey-Color Fix — Design

**Date:** 2026-08-21
**Scope:** Bug fix (grey categories) + feature (category palettes, per-category color override, app accent themes)

---

## 0. Summary

Three independent, user-facing controls plus one root-cause bug fix:

1. **Category palette** — 7 named palettes; user picks one; it drives the pie chart, legend, and every category color site-wide.
2. **Per-category color override** — user picks a color for any single category; it wins over the palette.
3. **App accent theme** — 3 looks (`Indigo` default, `Crimson`, `Your Colour` custom), each with a light + dark variant; changes the app's accent hue only.
4. **Grey-color bug** — `CAT.colorFor()` no longer returns a flat grey fallback for unknown categories.

The three controls are **independent settings**. Any combination is valid (e.g. Crimson app accent + Forest category palette).

---

## 1. Root Cause — Grey Categories (fix)

### Problem

On a fresh device (or when the custom-category sync fails), the pie chart and its legend render categories in flat greys (`#C9CBCF`, `#8E8E93`) instead of distinct colors. Mobile (which has `customCats` in localStorage) looks fine; desktop looks grey.

### Root Cause

`js/categories.js` `colorFor(name)`:

```js
function colorFor(name) {
  var found = all().find(function(c) { return c.name === name; });
  return found ? found.color : "#C9CBCF";  // ← flat light-grey fallback
}
```

Any name not in the 7 hardcoded `defaults` and not in the current device's `customCats` resolves to `#C9CBCF`. The legend swatches use the *same* function (no Chart.js involved), which is why they grey too. This is a data/assignment flaw, not a rendering or CSS issue.

### Fix (structural, not a patch)

`colorFor()` will deterministically map **any** name — default, custom, or unknown — into the active palette. No name can ever resolve to a flat grey. If sync fails, a category still gets a stable, distinct color derived from its name.

---

## 2. Category Palettes (7) — `js/categories.js`

### Structure

A `PALETTES` map keyed by name. Each palette is a **15-color ordered array**:

- **Indices 0–6** — fixed slots for the 7 default categories, in `defaults` order: Food, Transport, Bills, Shopping, Entertainment, Health, Other.
- **Indices 7–14** — 8 hash slots for custom/unknown categories.

This reservation is deliberate: custom categories hash **only into `palette.slice(7)`** (8 slots), never into the fixed default slots. Without this, a hashed custom category could land on the exact same hex as a fixed default and become indistinguishable from it.

### Assignment algorithm

```
colorFor(name):
  override = catOverrides[name]          // §3 — checked first
  if override: return override
  palette  = PALETTES[currentPalette]
  idx      = indexOfDefault(name)        // 0–6, or -1
  if idx >= 0: return palette[idx]
  return palette[7 + (hash(name) % 8)]   // custom/unknown → hash slots only
```

`hash(name)` = sum of char codes, `% 8` (same determinism as the current `hashColor`). Two customs can still collide within the 8 hash slots — acceptable (identical to today's behavior), and rare in practice with a small category count.

### Palette list

| Key | Name | Flavor |
|---|---|---|
| `legacy` | Legacy | Exact current colors (defaults + current `CUSTOM_PALETTE`) |
| `triadic` | Triadic | **Default** — 3 evenly-spaced hues + warm/cool variations |
| `tetradic` | Tetradic | Two complementary pairs, 60° apart |
| `square` | Square | Four hues 90° apart |
| `forest` | Forest | Greens + olive + teal |
| `ocean` | Ocean | Cool cyan → deep blue |
| `kawaii` | Kawaii | Peach-blossom pastels (pink/peach/lilac/baby-blue) |

Concrete 15-color arrays are listed in the appendix (§A). The `legacy` palette reproduces the current defaults + current `CUSTOM_PALETTE` exactly, so `legacy` users see zero visual change.

### Contrast requirement (binding)

Category colors are used **graphically only** (donut slices, legend swatches, 3px category chip borders) — never as text. The dark surface is `--surface` = `#1A1A1A`; the light surface is `--surface` = `#ffffff`.

- **Against dark surface (`#1A1A1A`):** all 7 palettes ≥3:1. Pastels pass this trivially.
- **Against light surface (`#ffffff`):** 6 palettes ≥3:1. **`kawaii` ≥2.5:1** — an explicit, testable floor, not a vague "slightly" exception. The appendix kawaii hexes are illustrative pastels and are tuned (darkened) until they meet 2.5:1 while staying visually "cute"; slices additionally rely on the 2px `--surface` border for separation.
- **Mutual distinguishability:** within a palette, no two colors are perceptually identical (adjacent-slice separation is guaranteed by the 2px surface border, not by inter-slice contrast).

The `kawaii` exception is the *only* deviation from the 3:1 floor and is pinned to a number; every other palette holds 3:1 against both surfaces.

### Changes vs. today

- Replace `defaults[i].color` + `CUSTOM_PALETTE` with the `PALETTES` map. `defaults` keeps `name`/`emoji`; per-category hardcoded color is removed (color now comes from the palette by index).
- Remove `hashColor`/`CUSTOM_PALETTE`; add `hash(name)` used only for the hash-slot offset.
- `colorFor(name)` gains palette awareness (reads the current palette; default `triadic`). Existing call sites in `dashboard.html` and `log.html` are unchanged — they already call `CAT.colorFor(name)`.
- `CAT` exposes `setPalette(name)` / `getPalette()` and initializes `currentPalette` lazily from localStorage on first use.
- Custom categories stop storing a `color` field. They store `{name, emoji}` only; color is always computed at render time from the current palette. `syncFromServer` ignores any legacy `color` field (vestigial, harmless) and `saveCustomCategories` stops writing it.

### Affected files

- `js/categories.js` — palettes, `colorFor`, `hash`, `setPalette`/`getPalette`, `syncFromServer`
- `log.html` — `saveCustomCategories` (stop writing `color`), custom-category create (drop `color: CAT.hashColor(name)`)

---

## 3. Per-Category Color Override

### Structure

A `catOverrides` map `{ name: "#rrggbb" }`, stored in localStorage and synced to Supabase. Checked **first** in `colorFor` (§2 order).

### Rules

- Override values are normalized to 6-digit lowercase hex (`#rrggbb`) so the existing `+ "40"` alpha-dim trick in `renderDonutChart` (line 222) keeps working.
- Setting an override is additive; removing it reverts the category to palette resolution.
- Applies to default *and* custom categories alike.

### Affected files

- `js/categories.js` — `getOverrides`/`setOverride`/`clearOverride`/`clearAllOverrides`
- `settings.html` — override UI (§5) and Supabase sync (§6)

---

## 4. App Accent Themes (3 × light/dark) — `css/style.css`

### Structure

Retain the existing `data-theme` attribute for light/dark. Add a **`data-accent`** attribute on `<html>`:

| `data-accent` | Look |
|---|---|
| *(absent)* | Indigo (current default) |
| `crimson` | Crimson |
| `custom` | Your Colour (derived from a stored hue) |

Only accent colors change; the semantic `--green`/`--red` (income/expense), backgrounds, surfaces, and text variables are untouched.

### Two accent variables (required — not optional)

`--accent` is consumed in two roles that impose *incompatible* contrast requirements:

- **(a) Fill** — accent used as a background with white text on top (`.chart-tab.active`, `.type-btn.active`, `.overview-tab.active`, `.filter-chip.active`, `.freq-chip.active`, `.toggle-switch` checked, `.fab`). Requires **white text ≥4.5:1 against the accent** → the accent must be dark.
- **(b) Foreground** — accent used as text/border on a surface (`.desktop-nav a.active`, `.tab-bar a.active`, `.auth-toggle a`, `.rec-*` labels, input focus borders, overview heading). Requires **accent ≥4.5:1 against the surface** → in dark mode the accent must be light.

A single solid color **cannot** satisfy both ≥4.5:1 against pure white *and* ≥4.5:1 against near-black (the relative-luminance bands — ≤0.183 vs ≥0.211 — do not overlap). One variable would either wash out in dark mode (white-on-accent fails) or vanish against the dark surface (accent-as-text fails). The codebase already carries the clue: line 1486 uses `var(--accent, #7c9cff)` with a *lighter* dark-mode fallback.

Therefore the accent splits into two variables:

| Variable | Role | Constraint per mode |
|---|---|---|
| `--accent` | Fill (a) | contrast vs `#ffffff` ≥4.5, light *and* dark |
| `--accent-fg` | Foreground (b) | contrast vs `#ffffff` (light) / `#1A1A1A` (dark) ≥4.5 |

CSS usage is split accordingly:

- **`--accent`** (fill): `.chart-tab.active`, `.type-btn.active`, `.overview-tab.active`, `.filter-chip.active` (bg + border), `.freq-chip.active` (bg + border), `.toggle-switch` checked, `.fab`.
- **`--accent-fg`** (foreground): `.desktop-nav a.active`, `.tab-bar a.active`, `.auth-toggle a`, `.rec-row-*` labels, input focus borders, overview heading.

### Concrete values

| Look | Mode | `--accent` (fill) | `--accent-fg` (foreground) |
|---|---|---|---|
| Indigo | light | `#6366F1` (unchanged) | `#6366F1` (unchanged) |
| Indigo | dark | `#6366F1` (unchanged) | `#7C9CFF` (was `#6366F1`) |
| Crimson | light | `#C62828` | `#C62828` |
| Crimson | dark | `#C62828` | `#EF5350` |
| Custom | light | computed (below) | same as `--accent` |
| Custom | dark | computed (below) | computed (below) |

Indigo's *fill* stays `#6366F1` in both modes — zero change to filled controls for existing users. The one deliberate change: Indigo's dark-mode *foreground* moves from `#6366F1` (~4.05:1 against `#1A1A1A`, below AA) to `#7C9CFF` (~5.5:1). This is a small contrast fix, not a restyle, and it's the same value the code already hints at in the line-1486 fallback.

**PR-description callout (required):** the Indigo dark-mode `--accent-fg` change (`#6366F1` → `#7C9CFF`) is user-visible and outside the grey-bug/palette feature scope. It ships deliberately as a contrast fix, but it must be called out as its own line in the PR description — not folded into the palette/accent feature summary — so it gets an explicit sign-off rather than riding through as a side effect of the two-variable split.

### Custom ("Your Colour") — pre-paint computation

The stored value is a **hue integer 0–360** (`accentHue`), not a hex. It is resolved to concrete `--accent` and `--accent-fg` values in the **inline `<head>` snippet**, synchronously, before first paint — same treatment the existing light/dark snippet already gives. No FOUC.

S fixed at 65%. Each role has exactly one target surface, so the search is well-defined and terminates:

```
accentFor(hue, mode, role):
  light:
    // fill + foreground both target white surface → one dark value serves both
    L = 45; while contrast(hsl(hue,65%,L), #ffffff) < 4.5: L -= 2   // floor 28
  dark, role == fill:
    // white text sits on the accent
    L = 40; while contrast(hsl(hue,65%,L), #ffffff) < 4.5: L -= 2   // floor 24
  dark, role == fg:
    // accent text sits on the #1A1A1A surface
    L = 60; while contrast(hsl(hue,65%,L), #1A1A1A) < 4.5: L += 2   // ceiling 78
The loops terminate inside the stated bounds for all hues 0–360: at the floor/ceiling the contrast target is already exceeded (e.g. `hsl(60,65%,24%)` dark-olive ≈7:1 vs white; `hsl(240,65%,78%)` light-blue ≈9:1 vs `#1A1A1A`). The floor/ceiling are safety clamps, not the operating point. **The floor/ceiling are asserted, not merely expected:** the helper's loop is bounded and ends with a hard clamp to the floor/ceiling (`L = max(min(L, ceiling), floor)`), so the return value is provably in-bounds even if the hand-derived worst-case reasoning were wrong for some hue. §8 item 7 extends the hue spread to assert this for all six test hues, both roles, both modes. The helper is a ~20-line pure function duplicated inside the head snippet (self-contained, no external deps).

The head snippet sets `data-accent="custom"` and writes the resolved hexes inline via `document.documentElement.style.setProperty("--accent", …)` / `("--accent-fg", …)`. No `[data-accent="custom"]` CSS rule is needed: when inline vars are absent (the no-JS case), the `data-accent="custom"` attribute also can't be set, so the cascade already resolves `--accent`/`--accent-fg` to Indigo via `:root`/`[data-theme="dark"]` — the intended fallback, without relying on an unstated selector-order assumption.


### `::root` typo fix (targeted)

`css/style.css` line 9 declares variables under `::root`, an invalid selector that matches nothing — the light-mode variables only appear to work because of browser quirks/fallbacks. The accent layer depends on these variables, so this is corrected to `:root` as part of this work. One-token fix; no other variable rework.

### CSS rules added

```css
:root                                   { --accent: #6366F1; --accent-fg: #6366F1; }
[data-theme="dark"]                     { --accent-fg: #7C9CFF; }  /* --accent stays #6366F1 */
[data-accent="crimson"]                 { --accent: #C62828; --accent-fg: #C62828; }
[data-accent="crimson"][data-theme="dark"] { --accent-fg: #EF5350; }
/* no [data-accent="custom"] rule — cascade falls back to Indigo; see §4 */
```

### Affected files

- `css/style.css` — `::root` → `:root`; add `--accent-fg`; repoint foreground selectors from `var(--accent)` to `var(--accent-fg)`; add `data-accent` rules
- Inline `<head>` snippet on all 8 pages (§6 file list) — read `appTheme`/`accentHue`, set `data-accent`, compute + inject custom `--accent`/`--accent-fg`

---

## 5. Settings UI — `settings.html`

New controls in the existing **Appearance** card:

1. **App Theme** — three chips: `Default`, `Crimson`, `Your Colour`. Selecting `Your Colour` reveals a `<input type="color">` (renders `#rrggbb`; converted to hue on save) **plus a live-derived preview swatch** showing the actual `--accent` (fill) and `--accent-fg` that will ship in the current mode, computed by the same helper the head snippet uses. This shows the user what they'll actually get — the stored hue is re-derived at a fixed S=65% and a contrast-clamped L, so the preview differs from the raw picker swatch, especially near-greys.
2. **Category Palette** — 7 swatch chips (each shows its palette's first 5 colors as a mini strip) + name; click to select; selected chip highlighted. Defaults to `Triadic`.
3. **Category Colors** — a list of every category (7 defaults + custom cats). Each row: name + `<input type="color">` bound to its override, plus a small "reset" affordance per row (reverts that category to palette). A "Reset all" action clears the whole `catOverrides` map.

All three apply **live** on change (no reload): accent/palette/override update in place. Stored to localStorage immediately and upserted to Supabase fire-and-forget (matching the existing `show_transaction_colors` pattern in `settings.html`).

### Affected files

- `settings.html` — Appearance card UI + event handlers + load/apply + save

---

## 6. Storage & Sync

### localStorage keys

| Key | Values | Notes |
|---|---|---|
| `theme` | `light` \| `dark` | existing |
| `appTheme` | `indigo` \| `crimson` \| `custom` | new |
| `accentHue` | int 0–360 | new; only meaningful when `appTheme=custom` |
| `catPalette` | one of 7 palette keys | new; default `triadic` |
| `catOverrides` | JSON map `{name: "#rrggbb"}` | new |

### Supabase `settings` — new columns (migration)

| Column | Type | Default |
|---|---|---|
| `app_theme` | `text` | `'indigo'` |
| `accent_hue` | `int` | `null` |
| `category_palette` | `text` | `'triadic'` |
| `category_color_overrides` | `jsonb` | `'{}'::jsonb` |

Add via `alter table settings add column if not exists …` (same style as existing Phases 5–7 in `supabase/migration.sql`). **No RLS policy changes** — the existing `settings_select_own`/`settings_update_own` policies (scoped to `auth.uid()`) already cover the new columns. Flagged here per house rules: this is a schema migration, not a policy edit.

### Sync direction

Server-authoritative, matching existing prefs: settings page loads from Supabase → applies → writes localStorage; changes write localStorage immediately + upsert to Supabase fire-and-forget. The head snippet (dashboard/log/checkin) reads **localStorage only** (runs before auth), so a brand-new device shows the localStorage default on first paint, then the settings load re-applies the server value — identical to today's `txColors` behavior. Category colors have no FOUC: they are computed at render time by `CAT.colorFor`, which runs after `syncFromServer` + settings load.

### Affected files

- `supabase/migration.sql` — 4 `alter table` lines
- `settings.html` — load/apply/save of the 4 new prefs

---

## 7. Complete File List

| File | Change |
|---|---|
| `js/categories.js` | `PALETTES` map; `colorFor` rewrite (no grey, palette + override + hash-slot); `hash`; `setPalette`/`getPalette`; `getOverrides`/`setOverride`/`clearOverride`/`clearAllOverrides`; `syncFromServer` (ignore legacy `color`) |
| `css/style.css` | `::root` → `:root`; add `--accent-fg`; repoint foreground selectors to `var(--accent-fg)`; `data-accent` rules |
| `settings.html` | Appearance card: theme/palette/override UI + handlers + load/save/sync |
| `dashboard.html` | head snippet (accent + custom-hue); no render-logic change (`colorFor` already used) |
| `log.html` | head snippet; `saveCustomCategories` stop writing `color`; custom-create drop `color` field |
| `checkin.html` | head snippet |
| `index.html` | head snippet |
| `login.html` | head snippet |
| `privacy.html` | head snippet |
| `terms.html` | head snippet |
| `supabase/migration.sql` | 4 new columns |

The 8 pages with the inline head snippet are exactly: `dashboard.html`, `log.html`, `checkin.html`, `settings.html`, `index.html`, `login.html`, `privacy.html`, `terms.html`.

---

## 8. Verification

Run by serving the folder statically and checking in-browser (no test framework).

1. **Grey bug** — with a custom category present on device A but empty `customCats` on device B (or after clearing localStorage), open dashboard: the custom category still gets a distinct, non-grey color in both the donut and legend.
2. **Palette distinctness** — each of the 7 palettes renders visually distinct slices for ≥5 categories, in light and dark.
3. **No custom-vs-default collision** — with the full 7 default categories plus several custom categories, no *custom* category resolves to the same hex as any *default* category's fixed slot (ties back to §2 slot reservation). Custom-vs-custom collisions within the 8 hash slots are accepted by design (§2).
4. **Override precedence** — set an override on "Food"; it wins over the palette everywhere (donut, legend, transaction rows, log chips). Reset it; it reverts to the palette color.
5. **Accent live-switch** — switching Indigo/Crimson/Your Colour updates active tabs, chips, toggles, and FAB immediately with no reload; persists across reload.
6. **Custom-hue FOUC** — set a custom hue, hard-reload dashboard: no flash of indigo/crimson before the custom accent paints (head snippet is synchronous).
7. **Custom-hue contrast + bounds, both roles, both modes** — across a hue spread (0, 30, 55, 120, 200, 270): (a) `--accent` fill meets ≥4.5:1 vs `#ffffff` in light *and* dark (white text legible); (b) `--accent-fg` meets ≥4.5:1 vs `#ffffff` in light and ≥4.5:1 vs `#1A1A1A` in dark; (c) the helper returns L within the stated floor/ceiling for all six hues, both roles, both modes (termination-within-bounds is asserted, not eyeballed). Test both variables independently — one passing does not imply the other.
8. **Regression** — `computeRecommendation`, chart date-range alignment, and `isRealSpend`/spend-filtering are untouched; confirm the financial math and chart windows behave as before (no changes made to those code paths).

---

## Appendix A — Concrete Palettes (initial values, gated by §2 contrast verification)

Each row is the full 15-color array: `[0..6 fixed defaults] + [7..14 hash slots]`.

- **legacy**
  `#FF6384 #36A2EB #D4A017 #0E9C9C #9966FF #FF7F2A #8E8E93 | #7E57C2 #26A69A #F4B400 #E57373 #29B6F6 #66BB6A #EC407A #AB47BC`
- **triadic** (default)
  `#E63946 #2A9D8F #4361EE #9B5DE5 #F4A261 #06A7C6 #8D6E63 | #457B9D #1D3557 #E76F51 #8338EC #0D9E6A #C29200 #3A86FF #B5179E`
- **tetradic**
  `#E63946 #2A9D8F #457B9D #F4A261 #E76F51 #6D597A #355070 | #B56576 #6A994E #A7C957 #F2E8CF #BC6C25 #283618 #DDA15E #606C38`
- **square**
  `#E63946 #F4A261 #2A9D8F #4361EE #9B5DE5 #FFB703 #8338EC | #06D6A0 #EF476F #118AB2 #073B4C #FFD166 #EF8354 #3A86FF #7209B7`
- **forest**
  `#166534 #15803D #65A30D #A16207 #0F766E #606C38 #3F6212 | #1B4332 #2D6A4F #40916C #52B788 #74C69D #95D5B2 #52796F #081C15`
- **ocean**
  `#0E7490 #0369A1 #1D4ED8 #0EA5E9 #22D3EE #155E75 #164E63 | #03045E #0077B6 #0096C7 #00B4D8 #48CAE4 #90E0EF #023E8A #083D77`
- **kawaii**
  `#FFB3C1 #FFD6A5 #FFE5EC #E8B4F8 #A2D2FF #F8C8DC #C9E4DE | #FBE7C6 #CDB4DB #A9DEF9 #FF9EBB #BDE0FE #FFF1A6 #B5EAD7 #D8C4FF`

Final hexes are confirmed/adjusted under the §2 contrast requirement and §8 checks; the structural rules (15 slots, 7 fixed + 8 hash, index reservation) are binding regardless of any hex tuning.
