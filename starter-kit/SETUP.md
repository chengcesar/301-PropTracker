# Design System — Starter Kit

Everything you need to spin up a new app with the same look and feel as Portfolio Tracker.

---

## What's in this folder

| File | Purpose |
|---|---|
| `tailwind.css` | Tailwind v4 entry + font theme tokens |
| `vite.config.js` | Vite config with Tailwind v4 plugin |
| `index.html` | HTML shell with Google Fonts |
| `SETUP.md` | This file |

You also need to copy one large file from the source project:

```
300-trend-viz/src/App.css  →  your-new-app/src/design-system.css
300-trend-viz/src/pages/DesignSystemPage.jsx  →  your-new-app/src/pages/DesignSystemPage.jsx
```

---

## Step-by-step procedure

### 1. Scaffold a new React + Vite project

```bash
npm create vite@latest my-new-app -- --template react
cd my-new-app
npm install
```

### 2. Install Tailwind v4 (exact versions used in the source)

```bash
npm install tailwindcss@^4.2.0 @tailwindcss/vite@^4.2.0
```

### 3. Copy the 4 files from this starter kit

Replace the files Vite generates with the ones here:

```
Temp/starter-kit/vite.config.js   →  vite.config.js
Temp/starter-kit/tailwind.css     →  src/tailwind.css
Temp/starter-kit/index.html       →  index.html
```

### 4. Copy the design system CSS

```bash
# From the root of 300-trend-viz:
cp src/App.css  ../my-new-app/src/design-system.css
```

> `App.css` is the entire design system. It contains all tokens, components,
> table styles, badges, animations — everything. Rename it `design-system.css`
> so it's clearly not app-specific code.

### 5. Copy the Design System reference page (optional but recommended)

```bash
cp src/pages/DesignSystemPage.jsx  ../my-new-app/src/pages/DesignSystemPage.jsx
```

Register it in your new `App.jsx` at `/design-system` for a live reference
while you build.

### 6. Wire up the imports in `src/main.jsx`

```jsx
import './tailwind.css';
import './design-system.css';
import App from './App';
// ... rest of your main.jsx
```

> Import order matters: tailwind first, then design-system.

### 7. Verify fonts are loading

Open DevTools → Network → filter "fonts.google" — you should see Inter,
DM Mono, Fraunces, and Averia Serif Libre loading.

---

## Dependencies (non-Tailwind)

Only add these if your new app needs them:

| Package | Use case |
|---|---|
| `react-router-dom@^7` | Routing (only if multi-page) |
| `recharts` | Charts |
| `chart.js` + `react-chartjs-2` | Charts (alternative) |
| `firebase` | Auth / database |

---

## Design token quick reference

### Colors
| Token | Value | Use |
|---|---|---|
| Primary | `#0539FF` | Buttons, accents, active states |
| Blue | `#3b82f6` | Secondary buttons, links |
| Background | `#f7f9fc` | Page background |
| Surface | `#fff` | Cards, modals |
| Border | `#e8ecf2` | All borders |
| Text primary | `#1a1d23` | Headings, strong text |
| Text secondary | `#374151` | Body text |
| Text muted | `#6b7280` | Labels, captions |
| Text faint | `#9ca3af` | Placeholder, hint |
| Positive | `#1BC5BD` | Gains, success |
| Negative | `#b91c1c` | Losses, danger |

### Fonts
| Variable | Value | Use |
|---|---|---|
| `--font-heading` | `Fraunces, serif` | Display headings |
| `--font-data` | `DM Mono, monospace` | Numbers, prices, code |
| (base) | `Inter, sans-serif` | All UI text |

### Border radius
| Value | Class context |
|---|---|
| `4px` | Inline elements |
| `6px` | Small buttons |
| `8px` | Buttons, inputs |
| `12px` | Cards |
| `16px` | Large cards, modals |
| `20px` | Pills, chips |

---

## CSS class cheat sheet

### Buttons
```css
.add-btn          /* primary blue — main CTA */
.load-btn         /* secondary blue */
.filter-bar-btn   /* ghost button with border */
.copy-excel-btn   /* light gray utility button */
.settings-btn     /* 40×40 icon button */
.tool-btn         /* text+icon button, blue on hover */
.txn-edit-btn     /* blue outlined inline edit */
.txn-delete-btn   /* red outlined inline delete */
.txn-save-btn     /* solid blue save */
.txn-cancel-btn   /* gray cancel */
```

### Badges
```css
.change-badge.pos / .neg           /* price change — teal/red bg */
.portfolio-badge-positive/negative/neutral  /* vs benchmark pill */
.buy-badge / .sell-badge           /* transaction type */
.bond-txn-badge.buy / .sell        /* bond variant */
.realloc-badge--buy/sell/hold      /* outlined action pill */
.schedule-badge.received/next/upcoming/maturity/vacant
.hhi-badge                         /* diversification (custom bg/color) */
.source-tag                        /* blue micro tag */
.sample-badge                      /* red watermark */
.schedule-count-badge              /* neutral count pill */
.rental-yield-pill                 /* green yield */
.qp-chip / .qp-chip.active         /* chart range quick-picks */
```

### Cards & layout
```css
.summary-card      /* KPI card: label + value */
.summary-label     /* 11px uppercase muted */
.summary-value     /* 20px bold + .pos/.neg */
.filter-bar        /* white container with filter controls */
.filter-pills      /* flex pill group */
.filter-pill.active
.holdings-card     /* table wrapper */
.stats-row / .stat / .stat-label / .stat-val  /* inline mini-stats */
.txn-card          /* transaction section card */
```

### Tables
```css
/* Holdings */
.holdings-table  .holding-row  .totals-row
.holding-cell  .holding-logo  .holding-logo-placeholder
.holding-name  .holding-ticker  .asset-dot

/* Transactions */
.txn-table  .txn-table-wrap

/* Allocation legend */
.allocation-legend-table
.alloc-name-cell  .allocation-dot  .alloc-item-name

/* Schedule row highlights */
.schedule-row-next td      { background: #eff6ff }
.schedule-row-principal td { background: #fffbeb }
.schedule-row-vacant td    { background: #fef2f2 }
```

### States
```css
.skeleton-line    /* inline shimmer */
.skeleton-value   /* block shimmer */
.spinner          /* 20px rotating spinner */
.empty-state      /* centered empty message */
.error-msg        /* red alert box */
```
