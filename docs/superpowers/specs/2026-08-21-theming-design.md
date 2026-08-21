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

- Category colors are used **graphically only** (donut slices, legend swatches, 3px category chip borders) — never as text. Required contrast: **≥ 3:1 against both `#ffffff` (light surface) and `#1A1A1A` (dark surface)**.
- Pastel palettes (`kawaii`) are allowed to trade off against this floor slightly, but each palette's colors are still tuned to be mutually distinguishable and legible against both surfaces; final hexes are gated by the contrast verification in §8.

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

Each look defines `--accent` for light and dark. Only `--accent` changes; the semantic `--green`/`--red` (income/expense), backgrounds, surfaces, and text variables are untouched.

`--accent` is consumed in ~15 places, in two roles: (a) background with white text on top (`.chart-tab.active`, `.type-btn.active`, `.overview-tab.active`, `.filter-chip.active`, `.freq-chip.active`, `.toggle-switch` checked, `.fab`), and (b) foreground text on light/dark surfaces (`.desktop-nav a.active`, `.tab-bar a.active`, `.auth-toggle a`, `.rec-*` labels, input focus borders). A single `--accent` value must satisfy both roles per mode.

### Concrete accents

| Look | Light `--accent` | Dark `--accent` |
|---|---|---|
| Indigo | `#6366F1` (unchanged) | `#6366F1` (unchanged) |
| Crimson | `#C62828` | `#EF5350` |
| Custom | computed from hue (below) | computed from hue (below) |

Indigo stays byte-for-byte as today — zero visual change for existing users.

### Custom ("Your Colour") — pre-paint computation

The stored value is a **hue integer 0–360** (`accentHue`), not a hex. It is resolved to a concrete `--accent` in the **inline `<head>` snippet**, synchronously, before first paint — the same treatment the existing light/dark snippet already gives. No FOUC.

Computation (light mode `L=45%` start, dark mode `L=65%` start), S fixed at 65%:

```
accentFor(hue, mode):
  L = (mode == light) ? 45 : 65
  loop (max 10 iterations):
    hex = hsl(hue, 65%, L)
    ratio = contrast(hex, white if light else #0F0F0F)
    if ratio >= 4.5: return hex
    L += (mode == light) ? -2 : +2
  return hex   // clamped; see note below
```

Clamping keeps S=65% and steps L into a safe band (light: down to ~28%; dark: up to ~75%) rather than a pure fixed-L formula, so low-luminance hues (yellow) and high-luminance hues (blue) both hit the target. The clamp is a ~15-line pure function duplicated inside the head snippet (self-contained, no external deps).

The head snippet also sets `data-accent="custom"` and writes the resolved hex inline via `document.documentElement.style.setProperty("--accent", hex)`. The `[data-accent="custom"]` CSS rule provides only a fallback value (e.g. indigo) for the no-JS/edge case; the inline value wins in normal operation.

### `::root` typo fix (targeted)

`css/style.css` line 9 declares variables under `::root`, an invalid selector that matches nothing — the light-mode variables only appear to work because of browser quirks/fallbacks. The accent layer depends on these variables, so this is corrected to `:root` as part of this work. This is a one-token fix; no other variable rework.

### CSS rules added

```css
[data-accent="crimson"]              { --accent: #C62828; }
[data-accent="crimson"][data-theme="dark"] { --accent: #EF5350; }
[data-accent="custom"]               { --accent: #6366F1; } /* fallback; inline var wins */
```

### Affected files

- `css/style.css` — `::root` → `:root`; add `data-accent` rules
- Inline `<head>` snippet on all 8 pages (§6 file list) — read `appTheme`/`accentHue`, set `data-accent`, compute + inject custom `--accent`

---

## 5. Settings UI — `settings.html`

New controls in the existing **Appearance** card:

1. **App Theme** — three chips: `Default`, `Crimson`, `Your Colour`. Selecting `Your Colour` reveals a `<input type="color">` (renders `#rrggbb`; converted to hue on save).
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
| `css/style.css` | `::root` → `:root`; `data-accent` rules |
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
3. **No same-color collision in-session** — across the full default set + several custom categories, no two categories in the same session resolve to the same hex (ties back to §2 slot reservation).
4. **Override precedence** — set an override on "Food"; it wins over the palette everywhere (donut, legend, transaction rows, log chips). Reset it; it reverts to the palette color.
5. **Accent live-switch** — switching Indigo/Crimson/Your Colour updates active tabs, chips, toggles, and FAB immediately with no reload; persists across reload.
6. **Custom-hue FOUC** — set a custom hue, hard-reload dashboard: no flash of indigo/crimson before the custom accent paints (head snippet is synchronous).
7. **Custom-hue contrast** — across a hue spread (e.g. 0, 30, 55, 120, 200, 270), the resolved accent meets ≥4.5:1 against its white-text-on-accent role in light mode and its foreground-on-dark-surface role in dark mode.
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
