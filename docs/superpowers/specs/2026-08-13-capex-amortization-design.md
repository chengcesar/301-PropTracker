# CapEx Amortization / Depreciation — Design

Date: 2026-08-13
Branch: `feature/capex-amortization`

## Problem

CapEx items today (`CapexItem` in `src/lib/types.ts:44-54`) have no concept of accounting
treatment — every item's full amount hits `totalCapex` and therefore `netCf` in
`calcAnnual` (`src/lib/finance.ts:491-520`). There's no way to spread a large one-time
capital expense (a renovation, a tenant fit-out) across the years it actually benefits,
and no monthly depreciation schedule exists anywhere in the codebase.

We want to let a CapEx item be either:
- **Expense** — full amount hits net cash flow in the year of its `date` (today's
  existing behavior).
- **Capitalize & Depreciate** — the amount is still paid in full, in cash, in the year
  of `date` (nothing changes about actual cash flow) — but a *separate*, purely
  informational monthly depreciation schedule spreads the same amount evenly across N
  months/years, feeding a second "Amortized" net cash flow figure and a monthly
  breakdown table.

## Prerequisite bug fix: year-scoping

Research surfaced that `totalCapex` currently sums **every** `CapexItem` ever entered,
in **every** year's view — there is no date/year filtering anywhere (`finance.ts:503`,
confirmed via `CapexTab.tsx:64`'s `prop.capex.filter((c) => Boolean(c.recurring) ===
recurring)`, which filters only by the recurring flag). A 2011 item and a 2026 item both
fully count in every year currently displayed.

This must be fixed as a prerequisite: `totalCapex` (the "Real" cash figure) will only
count items whose `date` falls within `prop.year`. This is a correctness fix, not new
scope — it's required for the new "Amortized" view to be meaningfully different from (and
comparable to) the "Real" view. Note: `taxes` (`prop.taxes.items`) has the same latent
gap (confirmed in `TaxesTab.tsx`) but is explicitly out of scope for this change.

## Data model (`src/lib/types.ts`)

```ts
export type CapexTreatment = 'expense' | 'capitalize'
export type CapexAmortizeBasis = 'manual' | 'contract'

export interface CapexItem {
  id: number
  date: string
  dateEnd?: string
  desc: string
  provider?: string                    // new — service provider, mirrors MaintenanceEvent.provider
  cat: 'Improvement' | 'Equipment' | 'Repair' | 'Other'
  amount: number
  status?: CapexStatus
  recurring?: boolean
  treatment?: CapexTreatment            // new — undefined/absent means 'expense' (preserves all existing items)
  amortizeBasis?: CapexAmortizeBasis     // new — only meaningful when treatment === 'capitalize'
  amortizeMonths?: number               // new — manual month count when amortizeBasis === 'manual'
  contractId?: number                   // new — links into Property.contracts when amortizeBasis === 'contract'
}
```

`recurring` and `treatment` are orthogonal. There is no auto-repeat engine in this
codebase — "recurring" CapEx items are hand-entered the same way as non-recurring ones,
just bucketed into a separate UI section (`CapexTab.tsx:312-339`). So every
`CapexItem` with `treatment: 'capitalize'` computes its own independent schedule from
its own `date`/`dateEnd`/`amount`, regardless of `recurring` — no special-casing needed.

Existing `CAPEX_CATS`/`CAPEX_STATUSES` (`src/lib/constants.ts:27-28`) are unchanged.

## Amortization engine (new: `src/lib/capexAmortization.ts`)

Pure functions, following the same style as `mortgageSchedule.ts`'s
`buildAmortScheduleYearly`.

```ts
export interface CapexAmortizationSchedule {
  itemId: number
  monthlyAmount: number
  totalMonths: number
  startYear: number
  startMonthIndex: number // 0-based calendar month this schedule's month-1 falls in
}

export function buildCapexAmortizationSchedule(
  item: CapexItem,
  contracts: Contract[],
): CapexAmortizationSchedule | null
```

- Returns `null` when `item.treatment !== 'capitalize'`.
- **Reference start ("placed in service") date** = `item.dateEnd || item.date` —
  depreciation starts counting from completion when an end date exists, falling back to
  the single `date` otherwise.
- **`totalMonths`:**
  - `amortizeBasis === 'manual'` → `item.amortizeMonths` (min 1).
  - `amortizeBasis === 'contract'` → whole calendar months from the reference start
    date through the linked contract's `endDate` (inclusive), min 1. If `contractId`
    points to a missing/deleted contract, the function returns `null` (surfaced as a
    validation state in the UI, not a crash).
- **`monthlyAmount`** = `item.amount / totalMonths` — straight-line, no proration for
  partial first/last months (every month gets the same amount).
- **No maximum schedule length** — a schedule can run 15+ years (e.g. a 2011 fit-out
  still depreciating in 2026).

```ts
export function capexDepreciationForMonth(
  item: CapexItem,
  contracts: Contract[],
  year: number,
  monthIndex: number, // 0-based
): number
```

Returns `monthlyAmount` if `(year, monthIndex)` falls within
`[startYear/startMonthIndex, +totalMonths)`, else `0`. This is the building block both
the monthly table and the new "Amortized" netCf figure consume.

```ts
export interface CapexAmortizationProgress {
  totalMonths: number
  monthsElapsed: number    // clamped to [0, totalMonths]
  percent: number          // monthsElapsed / totalMonths × 100, clamped [0, 100]
  amountAmortized: number  // monthlyAmount × monthsElapsed
  amountLeft: number       // item.amount − amountAmortized
}

export function capexAmortizationProgress(
  schedule: CapexAmortizationSchedule,
  asOfYear: number,
  asOfMonthIndex: number,
): CapexAmortizationProgress
```

`asOf` is real-world today's date, **not** the year currently selected in the property
page nav — the progress bar/badge (e.g. "51%", "Amortized 72.867.470 / 71.132.530
left", "42/83 mo") reflects the schedule's live status regardless of which year is
being viewed. Only the monthly table (below) is year-scoped to `prop.year`.

## Financial calc changes (`src/lib/finance.ts`)

**a) Year-scoping fix** (see Prerequisite section above):

```ts
const totalCapex = prop.capex
  .filter((c) => new Date(c.date).getFullYear() === prop.year)
  .reduce((a, b) => a + b.amount, 0)
```

Applies regardless of `treatment` — a capitalized item still costs real cash when paid,
so it still hits Real netCf in full, in its start-date year. Capitalizing only changes
the *book* depreciation view, never the cash view.

**b) New fields on `AnnualResult`:**

```ts
totalCapexAmortized: number
netCfAmortized: number  // noi - totalCapexAmortized - taxes - serviceOneTime
```

For an expense-treated item, its contribution to `totalCapexAmortized` equals its
contribution to `totalCapex` (full amount, same start-date year). For a capitalized
item, `totalCapex` still counts the full amount in its start-date year (Real), while
`totalCapexAmortized` sums `capexDepreciationForMonth(item, contracts, prop.year, m)`
across all 12 months of `prop.year` — spreading its cost into whichever year(s) the
schedule's months fall in, which may start well before or extend well after the payment
year.

`calcPortfolioTotals`/`calcPortfolioTotalsIn` get a parallel `netAmortized` field,
aggregated the same way `net` is today.

## UI changes

**Form** (`CapexTab.tsx`, both non-recurring and recurring sections, same
`CapexLogSection` component):
- New **Service provider** text field, next to Description.
- New **Treatment** radio: "Capitalize & Depreciate" / "Expense" — defaults to
  "Capitalize & Depreciate" for new entries (existing items with no `treatment` field
  are treated as `'expense'`).
- When Capitalize is selected, reveal **Amortize against**: select of "Manual months" /
  "Contract":
  - Manual → number input for months directly.
  - Contract → dropdown of `prop.contracts`, labeled by tenant name (there's no numeric
    "contract #" field in the data model today, so the UI shows e.g. "Acme Corp Lease"
    rather than inventing a new contract-number field).

**Item row:** existing category/status badges, plus a new treatment pill
("Capitalize"/"Expense"). When capitalized, add the progress bar + "Amortized X / Y
left" line + "{contract tenant} · 42/83 mo" (or "· 42/60 mo" for manual), driven by
`capexAmortizationProgress`.

**New section in `CapexTab.tsx`:** "CapEx Depreciation by Month · {prop.year}" table —
one column per capitalized item active during `prop.year` (named by `desc`), plus NR
Total / R Total / Combined columns, 12 month rows + a Total row, built from
`capexDepreciationForMonth`.

**Twin KPI cards:** `OverviewTab.tsx:303-306` and `CashflowTab.tsx:81-84` each already
render a single "Net cashflow" kpi-card — add a second card next to it, "Net Cash Flow
(Amortized)", side by side, in both places.

**Portfolio:** add `netCfAmortized` as a new column option in the existing leaderboard
column system (`COL_KEYS`/`COL_LABELS` in `PortfolioPage.tsx`), following the same
pattern as today's `netCf` column, and fold `netAmortized` into `PortfolioTotals`.

## Testing plan

- **`capexAmortization.ts`** (new unit tests):
  - `buildCapexAmortizationSchedule`: manual basis math, contract basis remaining-months
    calc across various date combos (incl. same-month edge case), `null` for
    expense-treated items, `null` when `contractId` points to a missing contract.
  - `capexDepreciationForMonth`: before/within/after schedule range, spanning a year
    boundary, spanning many years (the 2011→2026 case).
  - `capexAmortizationProgress`: not-yet-started (0%), mid-schedule, fully amortized
    (100%, `amountLeft: 0`), clamping.
- **`finance.ts`** (extend `finance.test.ts`): year-scoping fix for `totalCapex`,
  `totalCapexAmortized`/`netCfAmortized` for a mix of expense + capitalized items across
  a multi-year schedule, portfolio aggregation.
- **Manual verification in the running app**: add a capitalized non-recurring item with
  a manual month count and one with a contract link; confirm the progress bar/badges and
  monthly table match expectations; confirm the two netCf KPI cards diverge correctly
  once a capitalized item exists.

## Open items noted for follow-up (not blocking)

- No "contract number" field exists on `Contract` — the UI displays the contract's
  tenant name instead. Flag if a dedicated contract-number field is wanted later.
- `prop.taxes.items` has the same year-scoping gap as CapEx did, left unfixed here as
  out of scope.
