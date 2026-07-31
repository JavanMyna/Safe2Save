# Donut Chart Colors & Transaction Sign/Color Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore visible distinct colors to the donut chart, fix red/green transaction coloring on the dashboard, and make transaction signs responsive to the "Transaction Colors" toggle.

**Architecture:** Three independent changes with no shared state or cross-dependencies. Palette values change in `categories.js`; CSS selectors gain `.tx-row` coverage in `style.css`; sign logic becomes toggle-aware in two inline scripts (`dashboard.html`, `log.html`).

**Tech Stack:** Vanilla HTML/CSS/JS — no build step, no test framework. Chart.js v4 (CDN) for donut chart. Verification is visual in-browser.

## Global Constraints

- No build step, no test runner, no linter — verify by serving the folder statically and checking in-browser
- Match existing code style: use `var` where the file already uses `var`, `const`/`let` where it uses those
- `occurred_on` is `YYYY-MM-DD`; do not conflate with timestamptz fields
- Every change must be smoke-tested in both light and dark themes
- Transaction color toggle default is ON (colors enabled)

---

### Task 1: Restore Donut Chart Category Colors

**Files:**
- Modify: `js/categories.js:3-9,15`

**Interfaces:**
- Consumes: nothing new — `CAT.colorFor()` and `CAT.hashColor()` already use these arrays
- Produces: unchanged API — same functions, new hex values

- [ ] **Step 1: Update default palette (lines 3-9)**

Replace the `defaults` array color values. The `name`, `emoji`, and structure stay identical — only the `color` hex values change:

```js
var defaults = [
    { name: "Food",          emoji: "🍔", color: "#FF6384" },  // unchanged
    { name: "Transport",     emoji: "🚗", color: "#36A2EB" },  // unchanged
    { name: "Bills",         emoji: "🧾", color: "#D4A017" },  // was #FFCE56
    { name: "Shopping",      emoji: "🛍️", color: "#0E9C9C" },  // was #4BC0C0
    { name: "Entertainment", emoji: "🎬", color: "#9966FF" },  // unchanged
    { name: "Health",        emoji: "💊", color: "#FF7F2A" },  // was #FF9F40
    { name: "Other",         emoji: "📦", color: "#8E8E93" }   // was #C9CBCF
];
```

- [ ] **Step 2: Update custom palette (line 15)**

Replace the `CUSTOM_PALETTE` array:

```js
var CUSTOM_PALETTE = ["#7E57C2", "#26A69A", "#F4B400", "#E57373", "#29B6F6", "#66BB6A", "#EC407A", "#AB47BC"];
```

- [ ] **Step 3: Smoke test — light theme**

Serve the folder (`npx serve .`), open `dashboard.html`. Verify:
- Donut chart shows 7+ distinct visible colors (if you have transactions across multiple categories)
- The donut legend swatches below the chart show distinct colors for each category
- Bills (gold `#D4A017`), Shopping (teal `#0E9C9C`), Other (gray `#8E8E93`) are clearly visible — not washed out

- [ ] **Step 4: Smoke test — dark theme**

Toggle to dark theme via Settings or browser dev tools, refresh dashboard. Verify:
- All donut segments remain distinguishable against the dark `--surface` background
- No segment blends into the background (especially check Bills gold and Other gray)

- [ ] **Step 5: Smoke test — custom category**

Create a custom category in Settings (e.g., "Pets"). Log a transaction with it. Refresh dashboard. Verify the custom category gets a visible color in the donut chart.

- [ ] **Step 6: Commit**

```bash
git add js/categories.js
git commit -m "fix: restore donut chart category colors with high-contrast palette"
```

---

### Task 2: Fix Transaction Color CSS Selector for Dashboard

**Files:**
- Modify: `css/style.css:621-635`

**Interfaces:**
- Consumes: `data-tx-colors` attribute on `<html>`, `--red` / `--green` / `--text` CSS variables
- Produces: `.spend-amount` inside `.tx-row` now gets the same red/green color treatment as inside `.spend-row`

- [ ] **Step 1: Update the `.spend-amount` color rules (lines 621-629)**

Replace the current block:

```css
.spend-row .spend-amount {
  font-weight: 600;
  color: var(--red);
  white-space: nowrap;
}

.spend-row .spend-amount.income {
  color: var(--green);
}
```

With the combined selectors:

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
```

- [ ] **Step 2: Update the toggle-off rule (lines 631-635)**

Replace:

```css
[data-tx-colors="off"] .spend-row .spend-amount,
[data-tx-colors="off"] .spend-row .spend-amount.income {
  color: var(--text);
}
```

With:

```css
[data-tx-colors="off"] .spend-row .spend-amount,
[data-tx-colors="off"] .spend-row .spend-amount.income,
[data-tx-colors="off"] .tx-row .spend-amount,
[data-tx-colors="off"] .tx-row .spend-amount.income {
  color: var(--text);
}
```

- [ ] **Step 3: Smoke test — dashboard with colors ON**

Open `dashboard.html` (Transaction Colors enabled in Settings). Verify:
- Expense amounts in the "Recent" transaction list show in red
- Income amounts in the "Recent" transaction list show in green
- Signs are still the old hardcoded ones at this point (`+` for income, `−` for expenses) — Task 3 will fix this

- [ ] **Step 4: Smoke test — log page unaffected**

Open `log.html`. Verify transaction amounts still show red/green as before (no regression).

- [ ] **Step 5: Smoke test — toggle OFF**

Disable Transaction Colors in Settings. Refresh dashboard. Verify:
- All transaction amounts in the "Recent" list appear in normal text color (`--text`)
- Log page also shows all amounts in normal text color

- [ ] **Step 6: Commit**

```bash
git add css/style.css
git commit -m "fix: extend transaction color CSS to .tx-row on dashboard"
```

---

### Task 3: Dynamic Sign Display Based on Transaction Color Toggle

**Files:**
- Modify: `dashboard.html:448`
- Modify: `log.html:306`

**Interfaces:**
- Consumes: `data-tx-colors` attribute on `document.documentElement`, `U.fmtMYR()` formatter
- Produces: sign prefix changes based on toggle state — expense always `−`, income is `+` only when colors OFF

- [ ] **Step 1: Update `filterAndRender` in `dashboard.html` (line 448)**

Find the line (currently):

```js
'<div class="spend-amount currency' + (isIncome ? ' income' : '') + '">' + (isIncome ? '+ ' : '− ') + U.fmtMYR(t.amount) + '</div>' +
```

Replace with:

```js
(function() {
  var txColorsOff = document.documentElement.hasAttribute('data-tx-colors');
  var sign = isIncome ? (txColorsOff ? '+ ' : '') : '− ';
  return '<div class="spend-amount currency' + (isIncome ? ' income' : '') + '">' + sign + U.fmtMYR(t.amount) + '</div>';
})() +
```

- [ ] **Step 2: Update `renderToday` in `log.html` (line 306)**

Find the line (currently):

```js
return '<div class="spend-row"><div>' + (t.category ? '<span class="spend-category" style="border-left:3px solid ' + CAT.colorFor(t.category) + ';">' + U.escHtml(t.category) + '</span>' : "") + (t.note ? '<span class="spend-meta">' + U.escHtml(t.note) + '</span>' : "") + '</div><div class="spend-amount currency' + (isIncome ? ' income' : '') + '">' + (isIncome ? '+' : '−') + ' ' + U.fmtMYR(t.amount) + '</div></div>';
```

Replace the sign portion `(isIncome ? '+' : '−') + ' '` with the dynamic logic. The full replacement line:

```js
return '<div class="spend-row"><div>' + (t.category ? '<span class="spend-category" style="border-left:3px solid ' + CAT.colorFor(t.category) + ';">' + U.escHtml(t.category) + '</span>' : "") + (t.note ? '<span class="spend-meta">' + U.escHtml(t.note) + '</span>' : "") + '</div><div class="spend-amount currency' + (isIncome ? ' income' : '') + '">' + (function() { var txColorsOff = document.documentElement.hasAttribute('data-tx-colors'); return isIncome ? (txColorsOff ? '+ ' : '') : '− '; })() + U.fmtMYR(t.amount) + '</div></div>';
```

- [ ] **Step 3: Smoke test — colors ON, dashboard**

Open `dashboard.html` with Transaction Colors enabled. Verify:
- Expense rows: `−RM xx.xx` in red
- Income rows: `RM xx.xx` in green (no sign)
- Space between amount and category/note looks normal

- [ ] **Step 4: Smoke test — colors ON, log page**

Open `log.html` with Transaction Colors enabled. Verify:
- Expense rows: `−RM xx.xx` in red
- Income rows: `RM xx.xx` in green (no sign)

- [ ] **Step 5: Smoke test — colors OFF, both pages**

Disable Transaction Colors in Settings. Refresh dashboard and log page. Verify:
- Expense rows: `−RM xx.xx` in normal text color
- Income rows: `+RM xx.xx` in normal text color

- [ ] **Step 6: Smoke test — toggle while on page**

On dashboard with recent transactions visible, toggle Transaction Colors in a separate Settings tab. Return to dashboard and refresh. Verify colors and signs update correctly.

- [ ] **Step 7: Smoke test — dark theme**

Toggle to dark theme. Repeat steps 3-5. Verify red/green are visible and signs follow the rules.

- [ ] **Step 8: Commit**

```bash
git add dashboard.html log.html
git commit -m "feat: dynamic transaction signs based on color toggle state"
```

---

## Verification Checklist (Post-Implementation)

- [ ] All 7 default categories show distinct, visible colors in the donut chart (light and dark)
- [ ] Custom categories get visible donut colors
- [ ] Dashboard recent transactions: expenses red, income green (colors ON)
- [ ] Log page transactions: expenses red, income green (colors ON)
- [ ] Dashboard recent transactions: both plain text, signs show `−` / `+` (colors OFF)
- [ ] Log page transactions: both plain text, signs show `−` / `+` (colors OFF)
- [ ] Income has NO sign when colors ON (both pages)
- [ ] Income has `+` sign when colors OFF (both pages)
- [ ] Expenses always have `−` sign in both modes
- [ ] Spacing around amounts looks natural in all states
