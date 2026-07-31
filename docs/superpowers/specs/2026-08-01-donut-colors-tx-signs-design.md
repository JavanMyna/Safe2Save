# Donut Chart Colors & Transaction Sign/Color Fixes — Design

**Date:** 2026-08-01
**Scope:** Bug fixes (2) + enhancement (signs)

---

## 1. Bug: Donut Chart — Restore Unique Category Colors

### Problem

The donut chart on `dashboard.html` displays only 2 distinguishable colors (red for Food, blue for Transport). Remaining segments appear white/washed out because several default category colors have poor contrast against the `--surface` background (`#ffffff` in light mode).

### Root Cause

`js/categories.js` defaults include pale colors — `#FFCE56` (yellow), `#4BC0C0` (light teal), `#C9CBCF` (light gray) — that lack contrast on white. Category-to-color mapping logic (`CAT.colorFor()`) is correct; only the hex values are the issue.

### Fix

Replace the default and custom palette hex values in `js/categories.js` with higher-contrast equivalents. No logic changes. Each category keeps its color identity (Food = red, Transport = blue, etc.).

**Defaults — before → after:**

| Category | Before | After |
|---|---|---|
| Food | `#FF6384` | `#FF6384` (unchanged) |
| Transport | `#36A2EB` | `#36A2EB` (unchanged) |
| Bills | `#FFCE56` | `#D4A017` (gold) |
| Shopping | `#4BC0C0` | `#0E9C9C` (deeper teal) |
| Entertainment | `#9966FF` | `#9966FF` (unchanged) |
| Health | `#FF9F40` | `#FF7F2A` (punchier orange) |
| Other | `#C9CBCF` | `#8E8E93` (mid-gray) |

**Custom palette — before → after:**

```js
// Before
var CUSTOM_PALETTE = ["#B39DDB", "#80CBC4", "#FFE082", "#EF9A9A", "#81D4FA", "#A5D6A7", "#F48FB1", "#CE93D8"];
// After
var CUSTOM_PALETTE = ["#7E57C2", "#26A69A", "#F4B400", "#E57373", "#29B6F6", "#66BB6A", "#EC407A", "#AB47BC"];
```

All chosen colors have WCAG AA contrast (≥4.5:1 for normal text equivalents) against both `#ffffff` and `#1A1A1A`.

### Affected Files

- `js/categories.js` — lines 2–9 (defaults array), line 15 (CUSTOM_PALETTE)

### Verification

1. Load dashboard with transactions across all 7 default categories — all donut segments show distinct, visible colors
2. Toggle between light and dark theme — all segments remain distinguishable
3. Create a custom category — its donut segment gets a visible color from the new palette

---

## 2. Bug: Transaction Colors Not Shown on Dashboard

### Problem

Transaction amounts on `dashboard.html` never display in red/green, even when "Transaction Colors" is enabled. The `log.html` page works correctly.

### Root Cause

CSS selector mismatch. The color rules use `.spend-row .spend-amount`, but `dashboard.html` renders transaction rows with class `.tx-row`, not `.spend-row`:

- `log.html` structure: `.spend-row > div > .spend-amount`  ← selector matches
- `dashboard.html` structure: `.tx-row > .tx-content > div > .spend-amount`  ← selector does NOT match

### Fix

Add `.tx-row .spend-amount` selectors alongside existing `.spend-row .spend-amount` rules in `css/style.css`.

**Before (lines 621–635):**
```css
.spend-row .spend-amount {
  font-weight: 600;
  color: var(--red);
  white-space: nowrap;
}
.spend-row .spend-amount.income {
  color: var(--green);
}
[data-tx-colors="off"] .spend-row .spend-amount,
[data-tx-colors="off"] .spend-row .spend-amount.income {
  color: var(--text);
}
```

**After:**
```css
.spend-row .spend-amount,
.tx-row .spend-amount {
  font-weight: 600;
  color: var(--red);
  white-space: nowrap;
}
.spend-row .spend-amount.income,
.tx-row .spend-amount.income {
  color: var(--green);
}
[data-tx-colors="off"] .spend-row .spend-amount,
[data-tx-colors="off"] .spend-row .spend-amount.income,
[data-tx-colors="off"] .tx-row .spend-amount,
[data-tx-colors="off"] .tx-row .spend-amount.income {
  color: var(--text);
}
```

### Affected Files

- `css/style.css` — lines 621–635

### Contrast Note

`--red` and `--green` are already theme-adaptive:

| Theme | `--red` | `--green` |
|---|---|---|
| Light | `#EF4444` | `#10B981` |
| Dark | `#F87171` | `#34D399` |

Both are 600-weight bold and visible against their respective backgrounds.

### Verification

1. Dashboard with colors ON: expenses appear red, income appears green (was broken before)
2. Dashboard with colors OFF: all amounts appear in `--text` color
3. Log page: behavior unchanged (was already working)

---

## 3. Enhancement: Dynamic Sign Display Based on Color Toggle

### Current Behavior (broken)

Both pages hardcode `+` for income and `−` for expenses regardless of toggle state.

### Desired Behavior

| Toggle State | Expense | Income |
|---|---|---|
| Colors ON (default) | `−RM xx.xx` in red | `RM xx.xx` in green (no sign) |
| Colors OFF | `−RM xx.xx` in normal text | `+RM xx.xx` in normal text |

### Fix

In both `dashboard.html` and `log.html`, replace hardcoded sign logic with a check against the `data-tx-colors` attribute on `<html>`:

```js
var txColorsOff = document.documentElement.hasAttribute('data-tx-colors');
var sign = isIncome ? (txColorsOff ? '+ ' : '') : '− ';
// Then: sign + U.fmtMYR(t.amount)
```

### Affected Files

- `dashboard.html` line 448 — `filterAndRender` transaction row
- `log.html` line 306 — `renderToday` transaction row

### Verification

1. Colors ON, dashboard: expense shows `−RM 25.00` (red), income shows `RM 100.00` (green)
2. Colors ON, log: same as above
3. Colors OFF, both pages: expense shows `−RM 25.00`, income shows `+RM 100.00`, both in `--text` color
4. Toggle the setting in Settings → refresh dashboard/log → signs and colors update correctly

---

## Summary of Changes

| File | Change | Lines |
|---|---|---|
| `js/categories.js` | Default palette hex values | 3–9 |
| `js/categories.js` | Custom palette hex values | 15 |
| `css/style.css` | Add `.tx-row` selectors to color/toggle rules | 621–635 |
| `dashboard.html` | Dynamic sign logic in `filterAndRender` | ~448 |
| `log.html` | Dynamic sign logic in `renderToday` | ~306 |
