# PropFlow — Cursor Project Context

> Hand this file to Cursor as context before starting any work on this project.
> It explains what the app is, what has already been built, the data model, design decisions, and what to build next.

---

## What this is

A **single-user rental property management web app** for a Colombian landlord managing a small portfolio of apartments (currently 2, growing). The app tracks income, operating expenses (OPEX), capital expenditures (CAPEX), and taxes per property per year, following standard real estate financial modeling conventions.

The working prototype was built as a single self-contained HTML file using React (via CDN + Babel). The next step is to migrate this into a proper local React project using Cursor, add persistence, and extend the feature set.

---

## Currency & locale

- All monetary values are in **Colombian Pesos (COP)**
- Format numbers with `.toLocaleString('es-CO')` — e.g. `1,808,629` (period as thousands separator)
- Display large totals in millions: `16.2M`
- Exchange rate display (COP → USD) is a nice-to-have, not required yet
- Dates follow ISO format `YYYY-MM-DD` internally; display as `MMM D, YYYY`

---

## Finance model — the core logic

This is the most important section. **Never mix these layers.**

```
Gross Potential Income (GPI)
  = contract.monthlyRent × 12 months covered by a contract

− Vacancy & credit loss
  = months where status === 'vacant' OR incomeOverride < monthlyRent
─────────────────────────────────────
= Effective Gross Income (EGI)

− OPEX (operating expenses, recurring)
  Auto (from contract):  admin/mgmt fee, internet
  Manual (per month):    electricity, water, gas, cleaning, maintenance
─────────────────────────────────────
= NOI  ← Net Operating Income (key real estate metric, pre-CAPEX, pre-tax)

− CAPEX (capital expenditure — kept SEPARATE from OPEX)
  Dated ledger: improvements, equipment replacements, major repairs
  Posted to the month they occurred

− Debt service  (P+I — not yet implemented, stub exists)
─────────────────────────────────────
= Pre-tax cash flow

− Taxes
  predial  (property tax, annual, posted to December by default)
  incomeTax  (rental income tax — persona natural)
─────────────────────────────────────
= Net cashflow  ← bottom line
```

**Why CAPEX is separate from OPEX:** CAPEX is a balance-sheet event (asset improvement), not a recurring P&L expense. Keeping it below NOI ensures NOI stays clean for valuation purposes (cap rate = NOI / property value).

**Why taxes are at the bottom:** NOI is a pre-tax metric used for property comparisons. Income tax belongs below NOI.

---

## Data model

### Property

```typescript
interface Property {
  id: number
  name: string          // e.g. "Apto 101"
  address: string       // e.g. "Calle 55 #4-36"
  type: 'Studio' | '1-bed' | '2-bed' | '3-bed'
  ref: string           // matricula / catastral reference
  year: number          // currently selected year for display

  contracts: Contract[]
  months: Record<number, MonthData>   // key is 0-based month index (0=Jan)
  capex: CapexItem[]
  taxes: { predial: number; incomeTax: number }
}
```

### Contract

```typescript
interface Contract {
  id: number
  status: 'active' | 'archived' | 'draft'

  tenant: string
  monthlyRent: number
  startDate: string     // ISO "YYYY-MM-DD"
  endDate: string       // ISO "YYYY-MM-DD"
  paymentDay: number    // day of month rent is due (1–28)
  deposit: number       // months of deposit held

  increment: 'ipc+' | 'ipc' | 'fixed' | 'none'
  ipcExtra: number      // % added on top of IPC (used when increment === 'ipc+')

  adminFee: number      // monthly admin/mgmt fee (auto OPEX)
  internet: number      // monthly internet (auto OPEX, 0 if tenant pays)

  notes: string
}
```

**Contract rules:**
- Only ONE contract can have `status === 'active'` per property at any time
- Activating a contract automatically archives the currently active one
- `status === 'draft'` contracts are saved but do not affect income or OPEX calculations
- `contractForMonth(contracts, year, mIdx)` resolves which contract was active on the 15th of that month — this is the single source of truth for income and auto-OPEX

### MonthData

```typescript
interface MonthData {
  status: 'rented' | 'vacant'
  incomeOverride: number | null   // null = use contract.monthlyRent
  expenses: {
    electricity: number
    water: number
    gas: number
    cleaning: number
    maintenance: number
    // plus any extra one-off keys like 'extra_1234': { label: string, amount: number }
  }
}
```

**Month resolution logic:**

```typescript
function contractForMonth(contracts, year, mIdx) {
  const d = new Date(year, mIdx, 15)
  return contracts.find(c => {
    if (c.status === 'draft') return false
    return d >= new Date(c.startDate) && d <= new Date(c.endDate)
  }) || null
}

function getMonthIncome(prop, mIdx) {
  const contract = contractForMonth(prop.contracts, prop.year, mIdx)
  const m = prop.months[mIdx]
  if (!contract) return 0
  if (m?.status === 'vacant') return 0
  if (m?.incomeOverride !== null && m?.incomeOverride !== undefined) return m.incomeOverride
  return contract.monthlyRent
}
```

**Key principle:** `months` only stores overrides and manual entries. If a month has no entry in `months`, income = `contract.monthlyRent` and auto-OPEX = contract fees. This means changing the contract retroactively propagates to all months that don't have explicit overrides.

### CapexItem

```typescript
interface CapexItem {
  id: number
  date: string          // ISO "YYYY-MM-DD"
  desc: string
  cat: 'Improvement' | 'Equipment' | 'Repair' | 'Other'
  amount: number
}
```

---

## What has been built (prototype)

The HTML prototype (`rental-manager.html`) contains a fully working single-page app with:

### Sidebar
- Portfolio view (all properties aggregate)
- Per-property navigation with status dot (green = has active contract, amber = no active contract)
- "Add property" modal

### Per-property tabs

**Overview tab**
- 5 KPI cards: GPI, Vacancy loss, NOI, CAPEX, Net cashflow
- Active contract summary card
- 12-month grid — each month is a clickable tile showing income, OPEX total, net, and status badge (Rented / Vacant / Override / No contract)
- Filter pills: All / Pending / Vacant / Override
- Month entry modal (opens on tile click)

**Contracts tab**
- Month coverage bar — 12 colored segments showing which months are covered
- Contract timeline — chronological list of all contracts with status dots
- Gap indicators between contracts (vacancy periods)
- Per-contract actions: Edit / Archive / Activate / Delete draft / Reactivate
- "Archive" shows a confirmation modal
- "New contract" wizard — 2-step: fill details → review + activate

**Cashflow tab**
- Annual P&L waterfall table (GPI → vacancy → EGI → OPEX items → NOI → CAPEX → taxes → net CF)
  - Each row has a bar chart showing % of GPI
- Monthly cashflow schedule table with cumulative column

**OPEX / CAPEX tab**
- OPEX by month table (all expense categories as columns)
- CAPEX ledger with add/remove
- "No CAPEX" empty state

**Taxes tab**
- Predial and income tax inputs
- Effective tax rate calculated live
- Summary table

### Portfolio view
- Aggregate KPI row
- Table with one row per property showing all P&L line items

---

## Month entry modal — detailed behavior

When a user clicks a month tile:

1. Shows which contract covers that month (or warns if none)
2. Status toggle: Rented / Vacant
3. Income override field (blank = contract amount, filled = override)
4. Expense table:
   - **Auto rows** (locked, pulled from contract): Admin/mgmt fee, Internet
   - **Manual rows** (editable): Electricity, Water, Gas, Cleaning, Maintenance
   - **One-off** rows: user can add ad-hoc expenses with a description
5. Live net cashflow = income − total OPEX (updates as user types)
6. Save writes to `prop.months[mIdx]`

---

## New contract wizard — detailed behavior

**Step 1 — Details:**
Fields: tenant, monthlyRent, startDate, endDate, paymentDay, deposit, increment type, ipcExtra %, adminFee, internet, notes.

**Step 2 — Review:**
- Summary card with all fields
- Overlap warning if new start date ≤ active contract's end date
- Checkbox: "Activate immediately" (default: true)
  - If true: existing active contract → archived, new contract → active
  - If false: new contract saved as draft

**Validation:** tenant + monthlyRent + startDate + endDate required to proceed to step 2.

---

## UI design system

The prototype uses a custom CSS design system. Migrate these variables and patterns into your Tailwind config or CSS variables:

```css
--bg: #F7F6F2        /* page background */
--surface: #FFFFFF   /* card/panel bg */
--surface2: #F0EEE8  /* subtle surface, table headers, info boxes */
--border: #E2DED6    /* default border */
--border2: #CBC7BE   /* hover border */
--text: #1A1917      /* primary text */
--text2: #6B6860     /* secondary text */
--text3: #9E9C97     /* muted/hint text */
--accent-bg: #1A1917 /* primary button bg */
--accent-text: #F7F6F2
--green: #1A6B47     /* positive values, active status */
--green-bg: #E8F5EE
--red: #9B2020       /* negative values */
--red-bg: #FCEAEA
--amber: #8A5A00     /* warnings, vacant */
--amber-bg: #FEF3DC
--purple: #4A3FA0    /* overrides, NOI metric */
--purple-bg: #EEEDF8
```

**Typography:** DM Sans (body) + DM Mono (numbers, dates, codes)

**Key patterns:**
- Positive money values: green, prefixed with `+`
- Negative money values: red, prefixed with `−` (minus, not hyphen)
- Zero / not applicable: muted text3, show `—`
- All numbers formatted with `es-CO` locale
- `fmtM(n)` for millions display in KPI cards
- Months with no contract: dashed border, dimmed, not clickable (or shows warning)

---

## Suggested tech stack for local migration

```
React + TypeScript
Vite (dev server)
Tailwind CSS (or keep the custom CSS variables above)
Zustand (state management — fits the flat store shape)
React Router (for property routes: /property/:id/:tab)
date-fns (date manipulation)
Recharts or Chart.js (for bar charts in cashflow tab)
localStorage or IndexedDB (persistence — no backend needed yet)
```

---

## Persistence strategy

There is no backend. All data lives in the browser.

**Recommended approach:** Zustand store with a `persist` middleware writing to `localStorage`.

```typescript
// Store shape
interface AppStore {
  properties: Property[]
  addProperty: (p: Property) => void
  updateProperty: (id: number, updater: (p: Property) => Property) => void
  removeProperty: (id: number) => void
}
```

**Export / import:** Add a "Export JSON" button that serializes the full store and downloads it as `propflow-backup-YYYY-MM-DD.json`. Add an "Import JSON" button to restore. This is the backup story until a real backend is added.

---

## File / folder structure (recommended)

```
src/
  components/
    layout/
      Sidebar.tsx
      Topbar.tsx
    property/
      OverviewTab.tsx
      ContractsTab.tsx
      CashflowTab.tsx
      OpexCapexTab.tsx
      TaxesTab.tsx
    modals/
      MonthModal.tsx
      NewContractModal.tsx
      EditContractModal.tsx
      AddPropertyModal.tsx
      ConfirmModal.tsx
    shared/
      Badge.tsx
      KpiCard.tsx
      WaterfallTable.tsx
      MonthGrid.tsx
      ContractTimeline.tsx
  lib/
    finance.ts       ← all calculation logic (contractForMonth, getMonthData, calcAnnual)
    format.ts        ← fmt(), fmtM(), formatDate()
    types.ts         ← all TypeScript interfaces
  store/
    useAppStore.ts   ← Zustand store with persist
  pages/
    Portfolio.tsx
    PropertyPage.tsx
```

**Critical rule:** All financial calculation logic must live in `lib/finance.ts`, not in components. Components only call these functions and render the results. This makes the logic testable and ensures consistency across all views.

---

## Key functions to extract into `lib/finance.ts`

```typescript
// Which contract was active on the 15th of a given month
contractForMonth(contracts: Contract[], year: number, mIdx: number): Contract | null

// Income + OPEX breakdown for a single month
getMonthData(prop: Property, mIdx: number): {
  income: number
  autoExp: { admin: number; internet: number }
  manualExp: Record<string, number>
  totalOpex: number
  noi: number
  status: 'rented' | 'vacant'
  incomeOverride: number | null
  contract: Contract | null
}

// Full year P&L rollup
calcAnnual(prop: Property): {
  gpi: number
  vacancy: number
  egi: number
  totalOpex: number
  noi: number
  totalCapex: number
  taxes: number
  netCf: number
}

// Portfolio rollup (sum of calcAnnual across all properties)
calcPortfolio(props: Property[]): AnnualTotals
```

---

## Features not yet built (backlog)

### High priority
- **Persistence** — localStorage via Zustand persist (see above)
- **Export JSON backup** + import
- **CSV import for expenses** — drag-and-drop, column mapping UI (designed but not wired to real file parsing)
- **Rent renewal calculator** — given IPC % input, compute new rent = current × (1 + IPC + ipcExtra/100), show comparison

### Medium priority
- **Document attachments** — attach PDF contracts to each contract record (store as base64 in localStorage or link to external URL)
- **Debt service / mortgage tracker** — P+I monthly payment, link to property, shows below NOI in waterfall
- **Notifications / reminders** — contract expiry (30/60/90 days warning), payment day reminder
- **Year-over-year comparison** — side-by-side 2025 vs 2026 for a property
- **Multi-year contract support** — contracts spanning multiple years, correct GPI calculation per year

### Lower priority
- **PDF report export** — one-page annual summary per property, portfolio summary
- **COP/USD exchange rate** — apply a rate to show USD equivalents in KPI cards
- **Occupancy rate metric** — months rented / months with a contract (shown in portfolio view)
- **Cloud sync** — Supabase or Firebase backend when the portfolio grows

---

## Gotchas and edge cases to handle

1. **January with no contract** — `contractForMonth` returns null; income = 0, OPEX = 0, month tile shows "No contract" dashed state, not clickable
2. **Contract spanning two years** — `calcAnnual` iterates months 0–11 for `prop.year`; a contract with startDate in 2025 and endDate in 2026 correctly covers January 2026
3. **Overlapping contracts** — only one `active` at a time; the wizard warns if dates overlap and auto-archives on activation
4. **Taxes posted to December** — `calcAnnual` subtracts taxes once; the monthly schedule table shows taxes only in row 11 (December)
5. **CAPEX in month X** — `prop.capex` is a flat array filtered by `new Date(item.date).getMonth() === mIdx` for the monthly schedule table
6. **Empty portfolio** — handle gracefully (empty state in sidebar and portfolio view)
7. **Number parsing** — Colombian users may type `1.808.629` or `1,808,629`; strip all non-digit characters before parsing: `parseFloat(s.replace(/[^\d]/g, ''))`

---

## Prototype reference

The full working prototype is in `rental-manager.html` in this folder. Open it in any browser — it runs without a build step. Use it as the source of truth for behavior when something is ambiguous.

The React component tree in the prototype maps directly to the folder structure above. Each tab is a self-contained component. The modals are rendered with a fixed overlay pattern.

All financial logic is currently inline in the prototype. When migrating, extract it cleanly into `lib/finance.ts` first, write unit tests for the edge cases listed above, then build the UI on top of the tested logic.
