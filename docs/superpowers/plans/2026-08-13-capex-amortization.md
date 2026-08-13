# CapEx Amortization / Depreciation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a CapEx item be treated as either an immediate "Expense" (today's behavior) or "Capitalize & Depreciate" (straight-line monthly depreciation schedule), add a matching "Net Cash Flow (Amortized)" figure alongside the existing cash-basis figure, and fix a pre-existing bug where CapEx totals aren't scoped to the viewed year at all.

**Architecture:** A new pure calculation module (`src/lib/capexAmortization.ts`) builds and queries straight-line depreciation schedules from a `CapexItem` + its linked `Contract` (if any) — no new state, no persistence changes beyond a few new optional fields on `CapexItem`. `finance.ts`'s `calcAnnual`/`calcPortfolioTotals` gain a parallel "Amortized" figure alongside the existing cash figure. UI changes are additive: new form fields, a badge + progress bar on existing item rows, a new monthly table, two new KPI cards, and one new sortable column in the portfolio leaderboard.

**Tech Stack:** React 19 + TypeScript, Vitest for unit tests, existing hand-rolled CSS in `src/design-system.css` (no new UI framework).

**Design doc:** `docs/superpowers/specs/2026-08-13-capex-amortization-design.md`

---

### Task 1: Data model — `CapexItem` fields + constants

**Files:**
- Modify: `src/lib/types.ts:42-54`
- Modify: `src/lib/constants.ts:27-28`

- [ ] **Step 1: Extend `CapexItem` in `src/lib/types.ts`**

Replace lines 42-54:

```ts
export type CapexStatus = 'To do' | 'Ongoing' | 'Completed'

export interface CapexItem {
  id: number
  date: string
  dateEnd?: string
  desc: string
  cat: 'Improvement' | 'Equipment' | 'Repair' | 'Other'
  amount: number
  status?: CapexStatus
  /** Recurring capital reserve (repairs/upgrades/equipment) vs. a one-time non-recurring project. Defaults to non-recurring when absent. */
  recurring?: boolean
}
```

with:

```ts
export type CapexStatus = 'To do' | 'Ongoing' | 'Completed'
export type CapexTreatment = 'expense' | 'capitalize'
export type CapexAmortizeBasis = 'manual' | 'contract'

export interface CapexItem {
  id: number
  date: string
  dateEnd?: string
  desc: string
  provider?: string
  cat: 'Improvement' | 'Equipment' | 'Repair' | 'Other'
  amount: number
  status?: CapexStatus
  /** Recurring capital reserve (repairs/upgrades/equipment) vs. a one-time non-recurring project. Defaults to non-recurring when absent. */
  recurring?: boolean
  /** Accounting treatment. Absent/undefined is treated as 'expense' (matches all pre-existing items). */
  treatment?: CapexTreatment
  /** Only meaningful when treatment === 'capitalize'. */
  amortizeBasis?: CapexAmortizeBasis
  /** Manual month count when amortizeBasis === 'manual'. */
  amortizeMonths?: number
  /** Links into Property.contracts when amortizeBasis === 'contract'. */
  contractId?: number
}
```

- [ ] **Step 2: Add treatment/basis value lists to `src/lib/constants.ts`**

After line 28 (`export const CAPEX_STATUSES = ['To do', 'Ongoing', 'Completed'] as const`), add:

```ts
export const CAPEX_TREATMENTS = ['capitalize', 'expense'] as const
export const CAPEX_AMORTIZE_BASES = ['manual', 'contract'] as const
```

- [ ] **Step 3: Verify the project still typechecks**

Run: `npm run build`
Expected: succeeds (these are all-optional new fields, so no existing literal constructing a `CapexItem` breaks).

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/constants.ts
git commit -m "feat(capex): add treatment/amortization fields to CapexItem"
```

---

### Task 2: Amortization engine — `buildCapexAmortizationSchedule`

**Files:**
- Create: `src/lib/capexAmortization.ts`
- Create: `src/lib/capexAmortization.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/capexAmortization.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildCapexAmortizationSchedule } from './capexAmortization'
import type { CapexItem, Contract } from './types'

function makeCapexItem(overrides: Partial<CapexItem> = {}): CapexItem {
  return {
    id: 1,
    date: '2023-02-01',
    desc: 'Test capex',
    cat: 'Improvement',
    amount: 120000,
    ...overrides,
  }
}

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 1,
    status: 'active',
    tenant: 'Test tenant',
    contractManager: '',
    monthlyRent: 1000,
    startDate: '2020-01-01',
    endDate: '2030-12-31',
    paymentDay: 1,
    deposit: 2,
    increment: 'none',
    ipcExtra: 0,
    fixedPct: 0,
    cpiEstimatePct: 0,
    adminFee: 0,
    notes: '',
    ...overrides,
  }
}

describe('buildCapexAmortizationSchedule', () => {
  it('returns null when treatment is not "capitalize"', () => {
    expect(buildCapexAmortizationSchedule(makeCapexItem({ treatment: 'expense' }), [])).toBeNull()
    expect(buildCapexAmortizationSchedule(makeCapexItem(), [])).toBeNull()
  })

  it('computes a straight-line monthly amount for manual basis, starting at dateEnd', () => {
    const item = makeCapexItem({
      dateEnd: '2023-11-01',
      amount: 120000,
      treatment: 'capitalize',
      amortizeBasis: 'manual',
      amortizeMonths: 12,
    })
    const schedule = buildCapexAmortizationSchedule(item, [])
    expect(schedule).toEqual({
      itemId: 1,
      monthlyAmount: 10000,
      totalMonths: 12,
      startYear: 2023,
      startMonthIndex: 10, // November, 0-based
    })
  })

  it('falls back to date when dateEnd is absent', () => {
    const item = makeCapexItem({
      date: '2023-03-01',
      amount: 60000,
      treatment: 'capitalize',
      amortizeBasis: 'manual',
      amortizeMonths: 6,
    })
    const schedule = buildCapexAmortizationSchedule(item, [])
    expect(schedule?.startYear).toBe(2023)
    expect(schedule?.startMonthIndex).toBe(2) // March, 0-based
  })

  it('returns null for manual basis with no amortizeMonths', () => {
    const item = makeCapexItem({ treatment: 'capitalize', amortizeBasis: 'manual' })
    expect(buildCapexAmortizationSchedule(item, [])).toBeNull()
  })

  it('computes remaining months from a linked contract, inclusive of the end month', () => {
    const contract = makeContract({ id: 5, endDate: '2030-09-30' })
    const item = makeCapexItem({
      dateEnd: '2023-11-15',
      amount: 144000000,
      treatment: 'capitalize',
      amortizeBasis: 'contract',
      contractId: 5,
    })
    const schedule = buildCapexAmortizationSchedule(item, [contract])
    // Nov 2023 through Sep 2030 inclusive = 83 months
    expect(schedule?.totalMonths).toBe(83)
    expect(schedule?.monthlyAmount).toBeCloseTo(144000000 / 83, 5)
  })

  it('returns null when contractId points to a missing contract', () => {
    const item = makeCapexItem({
      dateEnd: '2023-11-01',
      treatment: 'capitalize',
      amortizeBasis: 'contract',
      contractId: 999,
    })
    expect(buildCapexAmortizationSchedule(item, [])).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/capexAmortization.test.ts`
Expected: FAIL — `Cannot find module './capexAmortization'` (file doesn't exist yet).

- [ ] **Step 3: Implement `buildCapexAmortizationSchedule`**

Create `src/lib/capexAmortization.ts`:

```ts
import type { CapexItem, Contract } from './types'

export interface CapexAmortizationSchedule {
  itemId: number
  monthlyAmount: number
  totalMonths: number
  startYear: number
  /** 0-based calendar month this schedule's month 1 falls in. */
  startMonthIndex: number
}

function monthsBetweenInclusive(fromYear: number, fromMonth: number, toYear: number, toMonth: number): number {
  return toYear * 12 + toMonth - (fromYear * 12 + fromMonth) + 1
}

/** Straight-line depreciation schedule for a capitalized CapEx item, or null if it isn't capitalized / can't be computed. */
export function buildCapexAmortizationSchedule(
  item: CapexItem,
  contracts: Contract[],
): CapexAmortizationSchedule | null {
  if (item.treatment !== 'capitalize') return null

  const refDateStr = item.dateEnd?.trim() ? item.dateEnd : item.date
  const refDate = new Date(`${refDateStr}T12:00:00`)
  if (!Number.isFinite(refDate.getTime())) return null
  const startYear = refDate.getFullYear()
  const startMonthIndex = refDate.getMonth()

  let totalMonths: number
  if (item.amortizeBasis === 'manual') {
    if (!item.amortizeMonths || item.amortizeMonths < 1) return null
    totalMonths = Math.floor(item.amortizeMonths)
  } else if (item.amortizeBasis === 'contract') {
    const contract = contracts.find((c) => c.id === item.contractId)
    if (!contract) return null
    const endDate = new Date(`${contract.endDate}T12:00:00`)
    if (!Number.isFinite(endDate.getTime())) return null
    totalMonths = Math.max(
      1,
      monthsBetweenInclusive(startYear, startMonthIndex, endDate.getFullYear(), endDate.getMonth()),
    )
  } else {
    return null
  }

  return {
    itemId: item.id,
    monthlyAmount: item.amount / totalMonths,
    totalMonths,
    startYear,
    startMonthIndex,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/capexAmortization.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/capexAmortization.ts src/lib/capexAmortization.test.ts
git commit -m "feat(capex): add straight-line amortization schedule builder"
```

---

### Task 3: Amortization engine — `capexDepreciationForMonth`

**Files:**
- Modify: `src/lib/capexAmortization.ts`
- Modify: `src/lib/capexAmortization.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/capexAmortization.test.ts`:

```ts
import { capexDepreciationForMonth } from './capexAmortization'

describe('capexDepreciationForMonth', () => {
  const item = makeCapexItem({
    dateEnd: '2023-11-01',
    amount: 120000,
    treatment: 'capitalize',
    amortizeBasis: 'manual',
    amortizeMonths: 12,
  })

  it('returns 0 before the schedule starts', () => {
    expect(capexDepreciationForMonth(item, [], 2023, 9)).toBe(0) // October 2023
  })

  it('returns the monthly amount for months within the schedule', () => {
    expect(capexDepreciationForMonth(item, [], 2023, 10)).toBe(10000) // November 2023 (month 1)
    expect(capexDepreciationForMonth(item, [], 2024, 9)).toBe(10000) // October 2024 (month 12)
  })

  it('returns 0 after the schedule ends', () => {
    expect(capexDepreciationForMonth(item, [], 2024, 10)).toBe(0) // November 2024 (month 13)
  })

  it('returns 0 for an expense-treated item in every month', () => {
    const expenseItem = makeCapexItem({ treatment: 'expense', date: '2023-11-01', amount: 120000 })
    expect(capexDepreciationForMonth(expenseItem, [], 2023, 10)).toBe(0)
  })

  it('spans multiple years correctly for a long schedule', () => {
    const longItem = makeCapexItem({
      dateEnd: '2011-06-01',
      amount: 12000,
      treatment: 'capitalize',
      amortizeBasis: 'manual',
      amortizeMonths: 180, // 15 years
    })
    expect(capexDepreciationForMonth(longItem, [], 2026, 0)).toBe(12000 / 180) // still depreciating in Jan 2026
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/capexAmortization.test.ts`
Expected: FAIL — `capexDepreciationForMonth is not exported` / `is not a function`

- [ ] **Step 3: Implement `capexDepreciationForMonth`**

Append to `src/lib/capexAmortization.ts`:

```ts
/** Depreciation amount an item contributes to a given calendar month (0-based), or 0 if outside its schedule / not capitalized. */
export function capexDepreciationForMonth(
  item: CapexItem,
  contracts: Contract[],
  year: number,
  monthIndex: number,
): number {
  const schedule = buildCapexAmortizationSchedule(item, contracts)
  if (!schedule) return 0
  const offset = year * 12 + monthIndex - (schedule.startYear * 12 + schedule.startMonthIndex)
  if (offset < 0 || offset >= schedule.totalMonths) return 0
  return schedule.monthlyAmount
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/capexAmortization.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/capexAmortization.ts src/lib/capexAmortization.test.ts
git commit -m "feat(capex): add per-month depreciation lookup"
```

---

### Task 4: Amortization engine — `capexAmortizationProgress`

**Files:**
- Modify: `src/lib/capexAmortization.ts`
- Modify: `src/lib/capexAmortization.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/capexAmortization.test.ts`:

```ts
import { capexAmortizationProgress, type CapexAmortizationSchedule } from './capexAmortization'

describe('capexAmortizationProgress', () => {
  const schedule: CapexAmortizationSchedule = {
    itemId: 1,
    monthlyAmount: 10000,
    totalMonths: 12,
    startYear: 2023,
    startMonthIndex: 10, // November 2023
  }

  it('is 0% before the schedule starts', () => {
    const progress = capexAmortizationProgress(schedule, 2023, 9) // October 2023
    expect(progress.monthsElapsed).toBe(0)
    expect(progress.percent).toBe(0)
    expect(progress.amountAmortized).toBe(0)
    expect(progress.amountLeft).toBe(120000)
  })

  it('counts the first month as elapsed once it starts', () => {
    const progress = capexAmortizationProgress(schedule, 2023, 10) // November 2023 (month 1)
    expect(progress.monthsElapsed).toBe(1)
    expect(progress.amountAmortized).toBe(10000)
  })

  it('is mid-schedule partway through', () => {
    const progress = capexAmortizationProgress(schedule, 2024, 3) // April 2024 (month 6)
    expect(progress.monthsElapsed).toBe(6)
    expect(progress.percent).toBe(50)
    expect(progress.amountAmortized).toBe(60000)
    expect(progress.amountLeft).toBe(60000)
  })

  it('clamps at 100% once fully amortized', () => {
    const progress = capexAmortizationProgress(schedule, 2025, 0) // well past the end
    expect(progress.monthsElapsed).toBe(12)
    expect(progress.percent).toBe(100)
    expect(progress.amountAmortized).toBe(120000)
    expect(progress.amountLeft).toBe(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/capexAmortization.test.ts`
Expected: FAIL — `capexAmortizationProgress is not exported` / `is not a function`

- [ ] **Step 3: Implement `capexAmortizationProgress`**

Append to `src/lib/capexAmortization.ts`:

```ts
export interface CapexAmortizationProgress {
  totalMonths: number
  monthsElapsed: number
  percent: number
  amountAmortized: number
  amountLeft: number
}

/** Live progress of a schedule as of a given calendar month (0-based) — pass today's year/month for a "right now" status. */
export function capexAmortizationProgress(
  schedule: CapexAmortizationSchedule,
  asOfYear: number,
  asOfMonthIndex: number,
): CapexAmortizationProgress {
  const totalAmount = schedule.monthlyAmount * schedule.totalMonths
  const rawElapsed = asOfYear * 12 + asOfMonthIndex - (schedule.startYear * 12 + schedule.startMonthIndex) + 1
  const monthsElapsed = Math.min(schedule.totalMonths, Math.max(0, rawElapsed))
  const amountAmortized = schedule.monthlyAmount * monthsElapsed
  return {
    totalMonths: schedule.totalMonths,
    monthsElapsed,
    percent: (monthsElapsed / schedule.totalMonths) * 100,
    amountAmortized,
    amountLeft: totalAmount - amountAmortized,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/capexAmortization.test.ts`
Expected: PASS (14 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/capexAmortization.ts src/lib/capexAmortization.test.ts
git commit -m "feat(capex): add live amortization progress calc"
```

---

### Task 5: Fix `totalCapex` year-scoping bug

**Files:**
- Modify: `src/lib/finance.ts:503`
- Modify: `src/lib/finance.test.ts`

**Context:** `totalCapex` currently sums every `CapexItem` ever entered regardless of `prop.year` — a 2011 item and a 2026 item both fully count in every year's view. This must be fixed before the new "Amortized" figure can be meaningfully different from (and compared to) the "Real" cash figure. This applies to ALL items regardless of `treatment` — a capitalized item still costs real cash when paid, so it still hits Real netCf in full, in its start-date year.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/finance.test.ts` (there's already a `makeProperty` helper at line 130 and `calcAnnual` is already imported at line 339 — add this describe block after the existing `calcAnnual` tests, i.e. after the `calcAnnual exposes maintenance without double-subtracting it` block):

```ts
import type { CapexItem } from './types'

function makeCapexItemForTest(overrides: Partial<CapexItem> = {}): CapexItem {
  return {
    id: 1,
    date: '2026-03-01',
    desc: 'Test capex',
    cat: 'Improvement',
    amount: 1000,
    ...overrides,
  }
}

describe('calcAnnual scopes totalCapex to prop.year', () => {
  it('only counts CapEx items dated in the viewed year', () => {
    const p = makeProperty({
      year: 2026,
      capex: [
        makeCapexItemForTest({ id: 1, date: '2026-03-01', amount: 1000 }),
        makeCapexItemForTest({ id: 2, date: '2025-06-01', amount: 5000 }), // different year — excluded
        makeCapexItemForTest({ id: 3, date: '2027-01-01', amount: 9000 }), // different year — excluded
      ],
    })
    expect(calcAnnual(p).totalCapex).toBe(1000)
  })

  it('counts a capitalized item in full in its start-date year (cash still leaves the bank)', () => {
    const p = makeProperty({
      year: 2026,
      capex: [
        makeCapexItemForTest({
          id: 1,
          date: '2026-02-01',
          dateEnd: '2026-11-01',
          amount: 120000,
          treatment: 'capitalize',
          amortizeBasis: 'manual',
          amortizeMonths: 12,
        }),
      ],
    })
    expect(calcAnnual(p).totalCapex).toBe(120000)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/finance.test.ts -t "scopes totalCapex"`
Expected: FAIL — first test fails because `totalCapex` is `15000` (sums all three items) instead of `1000`.

- [ ] **Step 3: Fix `calcAnnual` in `src/lib/finance.ts`**

Replace line 503:

```ts
  const totalCapex = prop.capex.reduce((a, b) => a + b.amount, 0)
```

with:

```ts
  const totalCapex = prop.capex
    .filter((c) => new Date(`${c.date}T12:00:00`).getFullYear() === prop.year)
    .reduce((a, b) => a + b.amount, 0)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/finance.test.ts -t "scopes totalCapex"`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full finance test suite to check for regressions**

Run: `npx vitest run src/lib/finance.test.ts`
Expected: PASS (all tests, including pre-existing ones)

- [ ] **Step 6: Commit**

```bash
git add src/lib/finance.ts src/lib/finance.test.ts
git commit -m "fix(capex): scope totalCapex to the viewed year"
```

---

### Task 6: Add `totalCapexAmortized` / `netCfAmortized` to `AnnualResult`

**Files:**
- Modify: `src/lib/finance.ts:4-17` (AnnualResult), `:491-520` (calcAnnual), `:561-576` (convertAnnual)
- Modify: `src/lib/finance.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/finance.test.ts`:

```ts
describe('calcAnnual computes an amortized net cash flow view', () => {
  it('matches totalCapex for an expense-treated item (same full-year hit)', () => {
    const p = makeProperty({
      year: 2026,
      capex: [makeCapexItemForTest({ id: 1, date: '2026-03-01', amount: 5000, treatment: 'expense' })],
    })
    const ann = calcAnnual(p)
    expect(ann.totalCapexAmortized).toBe(ann.totalCapex)
    expect(ann.netCfAmortized).toBe(ann.netCf)
  })

  it('spreads a capitalized item across its schedule instead of hitting the payment year', () => {
    const p = makeProperty({
      year: 2026,
      capex: [
        makeCapexItemForTest({
          id: 1,
          date: '2023-02-01',
          dateEnd: '2023-11-01',
          amount: 120000,
          treatment: 'capitalize',
          amortizeBasis: 'manual',
          amortizeMonths: 24, // Nov 2023 -> Oct 2025, so 2026 gets none of it
        }),
      ],
    })
    const ann = calcAnnual(p)
    // Real: full amount only hit 2023 (the item's date year), so 2026's totalCapex is 0
    expect(ann.totalCapex).toBe(0)
    // Amortized: schedule ended Oct 2025, so 2026 gets 0 depreciation too
    expect(ann.totalCapexAmortized).toBe(0)
  })

  it('attributes depreciation slices to a later year than the payment year', () => {
    const p = makeProperty({
      year: 2024,
      capex: [
        makeCapexItemForTest({
          id: 1,
          date: '2023-02-01',
          dateEnd: '2023-11-01', // schedule starts November 2023
          amount: 120000,
          treatment: 'capitalize',
          amortizeBasis: 'manual',
          amortizeMonths: 24, // runs through October 2025
        }),
      ],
    })
    const ann = calcAnnual(p)
    // Real: item's date (2023) isn't 2024, so no cash hit this year
    expect(ann.totalCapex).toBe(0)
    // Amortized: all 12 months of 2024 fall within the Nov 2023 - Oct 2025 schedule
    expect(ann.totalCapexAmortized).toBe(12 * (120000 / 24))
    expect(ann.netCfAmortized).toBe(ann.noi - ann.totalCapexAmortized - ann.taxes - ann.serviceOneTime)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/finance.test.ts -t "amortized net cash flow"`
Expected: FAIL — `totalCapexAmortized`/`netCfAmortized` are `undefined`

- [ ] **Step 3: Add the fields to `AnnualResult`**

In `src/lib/finance.ts`, update the import at line 1 and the interface at lines 4-17:

```ts
import type { CapexItem, Contract, MonthData, Property, ServiceEntry } from './types'
import { type CurrencyCode, type FxRates, convert } from './currency'
import { capexDepreciationForMonth } from './capexAmortization'

export interface AnnualResult {
  gpi: number
  vacancy: number
  egi: number
  totalOpex: number
  noi: number
  totalCapex: number
  /** Sum of capitalized items' monthly depreciation falling in prop.year, plus the full amount of expense-treated items dated in prop.year. */
  totalCapexAmortized: number
  taxes: number
  /** Sum of one-time service/utility payments dated in prop.year */
  serviceOneTime: number
  /** Sum of maintenanceEvents dated in prop.year — already included in totalOpex/noi; exposed separately so breakdown views can itemize it. */
  maintenance: number
  netCf: number
  /** Net cash flow using totalCapexAmortized instead of totalCapex — a book/depreciation view rather than a cash view. */
  netCfAmortized: number
}
```

(`CapexItem` wasn't previously imported in this file — it's needed for the helper added in the next step.)

- [ ] **Step 4: Compute the new fields in `calcAnnual`**

Replace the body of `calcAnnual` (lines 491-520):

```ts
export function calcAnnual(prop: Property): AnnualResult {
  let gpi = 0
  let egi = 0
  let totalOpex = 0
  for (let i = 0; i < 12; i++) {
    const pot = monthlyPotentialRentForGpi(prop, i)
    const m = getMonthData(prop, i)
    gpi += pot
    egi += m.income
    totalOpex += m.totalOpex
  }
  const vacancy = Math.max(0, gpi - egi)
  const totalCapex = prop.capex
    .filter((c) => new Date(`${c.date}T12:00:00`).getFullYear() === prop.year)
    .reduce((a, b) => a + b.amount, 0)
  const totalCapexAmortized = totalCapexAmortizedForYear(prop.capex, prop.contracts, prop.year)
  const taxes = (prop.taxes.items ?? []).reduce((a, t) => a + (t.amount ?? 0), 0)
  const serviceOneTime = sumServiceOneTimeAnnual(prop)
  const maintenance = sumMaintenanceAnnual(prop)
  const noi = egi - totalOpex
  return {
    gpi,
    vacancy,
    egi,
    totalOpex,
    noi,
    totalCapex,
    totalCapexAmortized,
    taxes,
    serviceOneTime,
    maintenance,
    netCf: noi - totalCapex - taxes - serviceOneTime,
    netCfAmortized: noi - totalCapexAmortized - taxes - serviceOneTime,
  }
}

/** Sum, for a given year, of: capitalized items' monthly depreciation landing in that year + expense-treated items' full amount dated in that year. */
function totalCapexAmortizedForYear(capex: CapexItem[], contracts: Contract[], year: number): number {
  let sum = 0
  for (const item of capex) {
    if (item.treatment === 'capitalize') {
      for (let m = 0; m < 12; m++) sum += capexDepreciationForMonth(item, contracts, year, m)
    } else if (new Date(`${item.date}T12:00:00`).getFullYear() === year) {
      sum += item.amount
    }
  }
  return sum
}
```

- [ ] **Step 5: Update `convertAnnual` to carry the new fields**

In `convertAnnual` (around line 561-576), add the two new fields to the returned object:

```ts
export function convertAnnual(result: AnnualResult, from: CurrencyCode, to: CurrencyCode, rates: FxRates): AnnualResult {
  if (from === to) return result
  const c = (n: number) => convert(n, from, to, rates)
  return {
    gpi: c(result.gpi),
    vacancy: c(result.vacancy),
    egi: c(result.egi),
    totalOpex: c(result.totalOpex),
    noi: c(result.noi),
    totalCapex: c(result.totalCapex),
    totalCapexAmortized: c(result.totalCapexAmortized),
    taxes: c(result.taxes),
    serviceOneTime: c(result.serviceOneTime),
    maintenance: c(result.maintenance),
    netCf: c(result.netCf),
    netCfAmortized: c(result.netCfAmortized),
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/lib/finance.test.ts`
Expected: PASS (all tests)

- [ ] **Step 7: Commit**

```bash
git add src/lib/finance.ts src/lib/finance.test.ts
git commit -m "feat(capex): add amortized net cash flow view to calcAnnual"
```

---

### Task 7: Add `netAmortized` to portfolio totals

**Files:**
- Modify: `src/lib/finance.ts:532-558` (`PortfolioTotals`, `calcPortfolioTotals`), `:579-595` (`calcPortfolioTotalsIn`)
- Modify: `src/lib/finance.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/finance.test.ts`:

```ts
import { calcPortfolioTotals } from './finance'

describe('calcPortfolioTotals includes netAmortized', () => {
  it('sums netCfAmortized across properties', () => {
    const p1 = makeProperty({
      year: 2026,
      capex: [makeCapexItemForTest({ id: 1, date: '2026-01-01', amount: 1000, treatment: 'expense' })],
    })
    const p2 = makeProperty({
      id: 2,
      year: 2026,
      capex: [makeCapexItemForTest({ id: 2, date: '2026-01-01', amount: 2000, treatment: 'expense' })],
    })
    const totals = calcPortfolioTotals([p1, p2])
    expect(totals.netAmortized).toBe(calcAnnual(p1).netCfAmortized + calcAnnual(p2).netCfAmortized)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/finance.test.ts -t "includes netAmortized"`
Expected: FAIL — `totals.netAmortized` is `undefined`

- [ ] **Step 3: Add `netAmortized` to `PortfolioTotals` and both aggregators**

Replace lines 532-558:

```ts
export interface PortfolioTotals {
  gpi: number
  egi: number
  opex: number
  noi: number
  capex: number
  taxes: number
  net: number
  netAmortized: number
}

export function calcPortfolioTotals(properties: Property[]): PortfolioTotals {
  return properties.reduce(
    (acc, p) => {
      const a = calcAnnual(p)
      return {
        gpi: acc.gpi + a.gpi,
        egi: acc.egi + a.egi,
        opex: acc.opex + a.totalOpex,
        noi: acc.noi + a.noi,
        capex: acc.capex + a.totalCapex,
        taxes: acc.taxes + a.taxes,
        net: acc.net + a.netCf,
        netAmortized: acc.netAmortized + a.netCfAmortized,
      }
    },
    { gpi: 0, egi: 0, opex: 0, noi: 0, capex: 0, taxes: 0, net: 0, netAmortized: 0 },
  )
}
```

Replace lines 579-595 (`calcPortfolioTotalsIn`):

```ts
export function calcPortfolioTotalsIn(properties: Property[], to: CurrencyCode, rates: FxRates): PortfolioTotals {
  return properties.reduce(
    (acc, p) => {
      const a = convertAnnual(calcAnnual(p), p.currency, to, rates)
      return {
        gpi: acc.gpi + a.gpi,
        egi: acc.egi + a.egi,
        opex: acc.opex + a.totalOpex,
        noi: acc.noi + a.noi,
        capex: acc.capex + a.totalCapex,
        taxes: acc.taxes + a.taxes,
        net: acc.net + a.netCf,
        netAmortized: acc.netAmortized + a.netCfAmortized,
      }
    },
    { gpi: 0, egi: 0, opex: 0, noi: 0, capex: 0, taxes: 0, net: 0, netAmortized: 0 },
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/finance.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Full build check**

Run: `npm run build`
Expected: succeeds — this will surface any other call site constructing a `PortfolioTotals` literal that now needs `netAmortized` too. If the build fails on a missing property, add `netAmortized: 0` (or the equivalent computed value) to that literal.

- [ ] **Step 6: Commit**

```bash
git add src/lib/finance.ts src/lib/finance.test.ts
git commit -m "feat(capex): add netAmortized to portfolio totals"
```

---

### Task 8: CapexTab form — provider, treatment, amortize-against fields

**Files:**
- Modify: `src/components/property/CapexTab.tsx:1-42` (imports, types), `:77-127` (startEdit/saveEdit/addItem), `:243-296` (form JSX)

This task has no automated test (no component-test harness exists in this codebase — `src/lib/finance.test.ts` is the only test file). Verify manually per step 5.

- [ ] **Step 1: Update imports and add label maps**

Replace lines 1-5:

```ts
import { useState } from 'react'
import { CAPEX_AMORTIZE_BASES, CAPEX_CATS, CAPEX_STATUSES, CAPEX_TREATMENTS } from '../../lib/constants'
import type { CapexAmortizeBasis, CapexItem, CapexStatus, CapexTreatment, Property } from '../../lib/types'
import type { CurrencyCode } from '../../lib/currency'
import { fmt, parseNum } from '../../lib/format'
import { buildCapexAmortizationSchedule, capexAmortizationProgress } from '../../lib/capexAmortization'
```

After the `capexDurationWeeks` function (line 16), add:

```ts
const CAPEX_TREATMENT_LABELS: Record<CapexTreatment, string> = {
  capitalize: 'Capitalize & Depreciate',
  expense: 'Expense',
}
const CAPEX_AMORTIZE_BASIS_LABELS: Record<CapexAmortizeBasis, string> = {
  manual: 'Manual months',
  contract: 'Contract',
}
```

- [ ] **Step 2: Extend `CapexForm` and `emptyCapexForm`**

Replace lines 25-41:

```ts
type CapexForm = {
  date: string
  dateEnd: string
  desc: string
  provider: string
  cat: (typeof CAPEX_CATS)[number]
  amount: string
  status: CapexStatus
  treatment: CapexTreatment
  amortizeBasis: CapexAmortizeBasis
  amortizeMonths: string
  contractId: string
}

const emptyCapexForm = (): CapexForm => ({
  date: '',
  dateEnd: '',
  desc: '',
  provider: '',
  cat: 'Improvement',
  amount: '',
  status: 'To do',
  treatment: 'capitalize',
  amortizeBasis: 'manual',
  amortizeMonths: '',
  contractId: '',
})
```

- [ ] **Step 3: Update `startEdit`, `saveEdit`, `addItem`**

Replace lines 77-127:

```ts
  const startEdit = (c: CapexItem) => {
    setEditingId(c.id)
    setForm({
      date: c.date,
      dateEnd: c.dateEnd ?? '',
      desc: c.desc,
      provider: c.provider ?? '',
      cat: c.cat,
      amount: String(Math.round(c.amount)),
      status: c.status ?? 'To do',
      treatment: c.treatment ?? 'expense',
      amortizeBasis: c.amortizeBasis ?? 'manual',
      amortizeMonths: c.amortizeMonths ? String(c.amortizeMonths) : '',
      contractId: c.contractId != null ? String(c.contractId) : '',
    })
    setShowForm(true)
  }

  const buildCapexItemFromForm = (id: number, preserveRecurring: boolean): CapexItem => {
    const base: CapexItem = {
      id,
      date: form.date,
      desc: form.desc,
      cat: form.cat,
      amount: parseNum(form.amount),
      status: form.status,
      treatment: form.treatment,
      ...(preserveRecurring ? { recurring: true } : {}),
      ...(form.provider.trim() ? { provider: form.provider.trim() } : {}),
      ...(form.dateEnd.trim() ? { dateEnd: form.dateEnd.trim() } : {}),
    }
    if (form.treatment !== 'capitalize') return base
    return {
      ...base,
      amortizeBasis: form.amortizeBasis,
      ...(form.amortizeBasis === 'manual' ? { amortizeMonths: parseNum(form.amortizeMonths) } : {}),
      ...(form.amortizeBasis === 'contract' && form.contractId ? { contractId: Number(form.contractId) } : {}),
    }
  }

  const saveEdit = () => {
    if (editingId === null) return
    if (!form.desc || !form.amount) return
    const id = editingId
    onUpdateProp((p) => ({
      ...p,
      capex: p.capex.map((x) => (x.id !== id ? x : buildCapexItemFromForm(id, Boolean(x.recurring)))),
    }))
    resetForm()
  }

  const addItem = () => {
    if (!form.desc || !form.amount) return
    const item = buildCapexItemFromForm(Date.now(), recurring)
    onUpdateProp((p) => ({ ...p, capex: [...p.capex, item] }))
    resetForm()
  }

  const removeItem = (id: number) => {
    onUpdateProp((p) => ({ ...p, capex: p.capex.filter((x) => x.id !== id) }))
  }
```

- [ ] **Step 4: Add the new form fields to the JSX**

Replace the form grid and its container (lines 243-296) — from `<div className="sec-title mb12">...` through the closing `</div>` right before the "Add CapEx / Cancel" button row:

```tsx
            <div className="sec-title mb12">{editingId ? 'Edit CapEx entry' : `New ${recurring ? 'recurring' : 'non-recurring'} CapEx`}</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '130px 130px 1fr 1fr 130px 140px 120px',
                gap: '10px',
              }}
            >
              <div className="field">
                <label>Start</label>
                <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="field">
                <label>End</label>
                <input type="date" value={form.dateEnd} onChange={(e) => setForm((p) => ({ ...p, dateEnd: e.target.value }))} />
              </div>
              <div className="field">
                <label>Description</label>
                <input
                  type="text"
                  placeholder="Renovation"
                  value={form.desc}
                  onChange={(e) => setForm((p) => ({ ...p, desc: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Service provider</label>
                <input
                  type="text"
                  placeholder="Contractor, company..."
                  value={form.provider}
                  onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Category</label>
                <select value={form.cat} onChange={(e) => setForm((p) => ({ ...p, cat: e.target.value as (typeof CAPEX_CATS)[number] }))}>
                  {CAPEX_CATS.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Amount ({prop.currency})</label>
                <input
                  type="text"
                  placeholder="0"
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as CapexStatus }))}>
                  {CAPEX_STATUSES.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt12">
              <label className="fs11 text3" style={{ display: 'block', marginBottom: 6 }}>Treatment</label>
              <div className="flex gap16">
                {CAPEX_TREATMENTS.map((t) => (
                  <label key={t} className="flex align-center gap8" style={{ cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="radio"
                      name={`capex-treatment-${recurring ? 'r' : 'nr'}`}
                      checked={form.treatment === t}
                      onChange={() => setForm((p) => ({ ...p, treatment: t }))}
                    />
                    {CAPEX_TREATMENT_LABELS[t]}
                  </label>
                ))}
              </div>
            </div>

            {form.treatment === 'capitalize' && (
              <div className="mt12" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '10px' }}>
                <div className="field">
                  <label>Amortize against</label>
                  <select
                    value={form.amortizeBasis}
                    onChange={(e) => setForm((p) => ({ ...p, amortizeBasis: e.target.value as CapexAmortizeBasis }))}
                  >
                    {CAPEX_AMORTIZE_BASES.map((b) => (
                      <option key={b} value={b}>
                        {CAPEX_AMORTIZE_BASIS_LABELS[b]}
                      </option>
                    ))}
                  </select>
                </div>
                {form.amortizeBasis === 'manual' ? (
                  <div className="field">
                    <label>Months</label>
                    <input
                      type="number"
                      min={1}
                      placeholder="12"
                      value={form.amortizeMonths}
                      onChange={(e) => setForm((p) => ({ ...p, amortizeMonths: e.target.value }))}
                    />
                  </div>
                ) : (
                  <div className="field">
                    <label>Contract</label>
                    <select value={form.contractId} onChange={(e) => setForm((p) => ({ ...p, contractId: e.target.value }))}>
                      <option value="">— Select —</option>
                      {prop.contracts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.tenant}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
```

Note: `buildCapexAmortizationSchedule` and `capexAmortizationProgress` are imported in Step 1 for use in Task 9 (the item row); they aren't referenced yet in this task's form code, which is fine — Task 9 lands in the same file immediately after.

- [ ] **Step 5: Manually verify in the running app**

Run: `npm run dev`, open a property's CapEx tab, click "+ Add Non-Recurring CapEx". Confirm:
- Service provider field appears next to Description
- Treatment radio defaults to "Capitalize & Depreciate"
- Selecting "Capitalize & Depreciate" reveals "Amortize against" with "Manual months" selected by default and a Months number input
- Switching "Amortize against" to "Contract" swaps the Months input for a Contract dropdown listing `prop.contracts` by tenant name
- Selecting "Expense" hides the "Amortize against" row entirely
- Saving a new item with Capitalize + Manual months, then clicking Edit on it, correctly restores all the new field values into the form

- [ ] **Step 6: Commit**

```bash
git add src/components/property/CapexTab.tsx
git commit -m "feat(capex): add provider, treatment, and amortization fields to the form"
```

---

### Task 9: CapexTab item row — treatment badge + progress bar

**Files:**
- Modify: `src/components/property/CapexTab.tsx:179-237` (item list rendering)
- Modify: `src/design-system.css` (near line 656-657, `.capex-item`)

- [ ] **Step 1: Add CSS for the wrapper and progress bar**

In `src/design-system.css`, replace lines 656-657:

```css
  .capex-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); }
  .capex-item:last-child { border-bottom: none; }
```

with:

```css
  .capex-item-wrap { border-bottom: 1px solid var(--border); padding: 10px 0; }
  .capex-item-wrap:last-child { border-bottom: none; }
  .capex-item-wrap .capex-item { border-bottom: none; padding: 0 0 8px 0; }
  .capex-item { display: flex; align-items: center; gap: 10px; }
  .capex-progress-track { height: 6px; border-radius: 3px; background: var(--surface2); overflow: hidden; margin-bottom: 6px; }
  .capex-progress-fill { height: 100%; background: var(--purple); border-radius: 3px; }
```

- [ ] **Step 2: Update the item list rendering**

Replace lines 179-237 (from `{items.length > 0 && (` through its closing `)}`):

```tsx
      {items.length > 0 && (
        <div className="card">
          <div className="card-inner">
            {items.map((c) => {
              const weeks = capexDurationWeeks(c.date, c.dateEnd)
              const schedule = buildCapexAmortizationSchedule(c, prop.contracts)
              const today = new Date()
              const progress = schedule ? capexAmortizationProgress(schedule, today.getFullYear(), today.getMonth()) : null
              const linkedContract = c.contractId != null ? prop.contracts.find((ct) => ct.id === c.contractId) : undefined
              return (
                <div key={c.id} className="capex-item-wrap">
                  <div className="capex-item">
                    <div style={{ width: '110px', flexShrink: 0 }}>
                      <div className="fs11 text3">Start</div>
                      <div className="fs13 mono">{c.date || '—'}</div>
                    </div>
                    <div style={{ width: '110px', flexShrink: 0 }}>
                      <div className="fs11 text3">End</div>
                      <div className="fs13 mono">{c.dateEnd?.trim() ? c.dateEnd : '—'}</div>
                    </div>
                    <div style={{ width: '80px', flexShrink: 0 }}>
                      <div className="fs11 text3">Weeks</div>
                      <div className="fs13 fw5">{weeks !== null ? weeks : '—'}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="fs11 text3">Description</div>
                      <div className="fs13 fw5">{c.desc}</div>
                      {c.provider && <div className="fs11 text3">{c.provider}</div>}
                    </div>
                    <span className={`badge ${c.cat === 'Improvement' ? 'rented' : c.cat === 'Equipment' ? 'override' : 'pending'}`}>
                      {c.cat}
                    </span>
                    <span className={`badge ${c.status === 'Completed' ? 'rented' : c.status === 'Ongoing' ? 'override' : 'pending'}`}>
                      {c.status ?? 'To do'}
                    </span>
                    <span className={`badge ${c.treatment === 'capitalize' ? 'override' : 'vacant'}`}>
                      {CAPEX_TREATMENT_LABELS[c.treatment ?? 'expense']}
                    </span>
                    <div style={{ width: '130px', textAlign: 'right' }}>
                      <div className="fs11 text3">Amount</div>
                      <div className="fs13 fw6 neg">−{fmt(cx(c.amount))}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="ghost"
                        title="Edit CapEx entry"
                        onClick={() => startEdit(c)}
                        style={{ padding: '4px 8px', fontSize: 13 }}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="ghost danger"
                        title="Remove CapEx entry"
                        onClick={() => removeItem(c.id)}
                        style={{ padding: '4px 8px' }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {schedule && progress && (
                    <div>
                      <div className="capex-progress-track">
                        <div className="capex-progress-fill" style={{ width: `${progress.percent}%` }} />
                      </div>
                      <div className="fs11 text3">
                        {Math.round(progress.percent)}% · Amortized {fmt(cx(progress.amountAmortized))} · {fmt(cx(progress.amountLeft))} left
                      </div>
                      <div className="fs11 text3">
                        {linkedContract ? `Contract: ${linkedContract.tenant} · ` : ''}
                        {progress.monthsElapsed} / {progress.totalMonths} mo
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
```

- [ ] **Step 3: Manually verify in the running app**

Run: `npm run dev` (if not already running). Add a CapEx item with Treatment = "Capitalize & Depreciate", Amortize against = "Manual months", Months = 12, Amount = 120000, End date = today's month. Confirm:
- A purple "Capitalize & Depreciate" pill shows next to the category/status pills
- A thin progress bar appears below the row, filled proportional to elapsed months
- The "X% · Amortized ... · ... left" line and "N / 12 mo" line render with sensible numbers
- An "Expense"-treated item shows an amber "Expense" pill and no progress bar

- [ ] **Step 4: Commit**

```bash
git add src/components/property/CapexTab.tsx src/design-system.css
git commit -m "feat(capex): show treatment badge and amortization progress on item rows"
```

---

### Task 10: CapEx Depreciation by Month table

**Files:**
- Modify: `src/components/property/CapexTab.tsx` (imports + new component + mount point)

- [ ] **Step 1: Add the `MONTHS_FULL` import and `capexDepreciationForMonth` import**

Update the import block at the top of `CapexTab.tsx` (from Task 8's Step 1) to also pull in `MONTHS_FULL` and `capexDepreciationForMonth`:

```ts
import { useState } from 'react'
import { CAPEX_AMORTIZE_BASES, CAPEX_CATS, CAPEX_STATUSES, CAPEX_TREATMENTS, MONTHS_FULL } from '../../lib/constants'
import type { CapexAmortizeBasis, CapexItem, CapexStatus, CapexTreatment, Property } from '../../lib/types'
import type { CurrencyCode } from '../../lib/currency'
import { fmt, parseNum } from '../../lib/format'
import { buildCapexAmortizationSchedule, capexAmortizationProgress, capexDepreciationForMonth } from '../../lib/capexAmortization'
```

- [ ] **Step 2: Add the `CapexDepreciationTable` component**

Add this after the closing brace of `CapexLogSection` (right before `export function CapexTab`):

```tsx
function CapexDepreciationTable({ prop, cx }: { prop: Property; cx: (n: number) => number }) {
  const items = prop.capex.filter((c) => c.treatment === 'capitalize')
  const monthlyByItem = items.map((c) =>
    Array.from({ length: 12 }, (_, m) => capexDepreciationForMonth(c, prop.contracts, prop.year, m)),
  )
  const activeIdx = items.map((_, idx) => idx).filter((idx) => monthlyByItem[idx].some((v) => v > 0))
  if (activeIdx.length === 0) return null

  const sumFor = (predicate: (idx: number) => boolean) =>
    Array.from({ length: 12 }, (_, m) => activeIdx.filter(predicate).reduce((a, idx) => a + monthlyByItem[idx][m], 0))
  const nrTotals = sumFor((idx) => !items[idx].recurring)
  const rTotals = sumFor((idx) => Boolean(items[idx].recurring))
  const combined = Array.from({ length: 12 }, (_, m) => nrTotals[m] + rTotals[m])
  const cell = (v: number) => (v > 0 ? `−${fmt(cx(v))}` : '—')
  const sumAll = (arr: number[]) => arr.reduce((a, v) => a + v, 0)

  return (
    <div className="mb24">
      <div className="sec-hdr mb12">
        <span className="sec-title">CapEx Depreciation by Month · {prop.year}</span>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="cf-table">
          <thead>
            <tr>
              <th>Month</th>
              {activeIdx.map((idx) => (
                <th key={items[idx].id}>{items[idx].desc}</th>
              ))}
              <th>NR Total</th>
              <th>R Total</th>
              <th>Combined</th>
            </tr>
          </thead>
          <tbody>
            {MONTHS_FULL.map((name, m) => (
              <tr key={name}>
                <td>{name}</td>
                {activeIdx.map((idx) => (
                  <td key={items[idx].id}>{cell(monthlyByItem[idx][m])}</td>
                ))}
                <td>{cell(nrTotals[m])}</td>
                <td>{cell(rTotals[m])}</td>
                <td className="fw6">{cell(combined[m])}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td>Total</td>
              {activeIdx.map((idx) => (
                <td key={items[idx].id}>{cell(sumAll(monthlyByItem[idx]))}</td>
              ))}
              <td>{cell(sumAll(nrTotals))}</td>
              <td>{cell(sumAll(rTotals))}</td>
              <td className="fw6">{cell(sumAll(combined))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Mount it in `CapexTab`**

Update the `CapexTab` export to render the new table after both sections:

```tsx
export function CapexTab({ prop, onUpdateProp, cx = (n) => n }: Props) {
  return (
    <div>
      <CapexLogSection
        prop={prop}
        onUpdateProp={onUpdateProp}
        cx={cx}
        recurring={false}
        title="Non-recurring CapEx"
        hint="One-time capital projects — renovations, tenant improvements, major replacements"
        addLabel="+ Add Non-Recurring CapEx"
        emptyTitle="No non-recurring CapEx this year"
        emptyHint="Track one-time capital projects for this property"
      />
      <CapexLogSection
        prop={prop}
        onUpdateProp={onUpdateProp}
        cx={cx}
        recurring
        title="Recurring CapEx"
        hint="Capital reserves — ongoing improvements, repairs, equipment"
        addLabel="+ Add Recurring CapEx"
        emptyTitle="No recurring CapEx entries"
        emptyHint="Track ongoing capital reserves, repairs, and equipment replacements"
      />
      <CapexDepreciationTable prop={prop} cx={cx} />
    </div>
  )
}
```

- [ ] **Step 4: Manually verify in the running app**

With the capitalized item from Task 9 still in place, navigate to the CapEx tab and confirm the "CapEx Depreciation by Month · {year}" table appears below the two log sections, with one column named after the item's description, correct monthly amounts, and a Total row. Add a second capitalized item marked "recurring" and confirm it contributes to "R Total" instead of "NR Total", and that "Combined" is their sum.

- [ ] **Step 5: Commit**

```bash
git add src/components/property/CapexTab.tsx
git commit -m "feat(capex): add CapEx Depreciation by Month table"
```

---

### Task 11: Twin "Net Cash Flow (Amortized)" KPI cards + CashflowTab bug fix

**Files:**
- Modify: `src/components/property/OverviewTab.tsx:303-306`
- Modify: `src/components/property/CashflowTab.tsx:34`, `:81-84`

- [ ] **Step 1: Add the KPI card to `OverviewTab.tsx`**

Replace lines 303-306:

```tsx
        <div className="kpi-card">
          <div className="kpi-label">Net cashflow <KpiInfoIcon tip="Final cashflow after all income and expenses" /></div>
          <div className="kpi-value green">{fmtCurrencyM(cx(ann.netCf), dc)}</div>
        </div>
```

with:

```tsx
        <div className="kpi-card">
          <div className="kpi-label">Net cashflow <KpiInfoIcon tip="Final cashflow after all income and expenses" /></div>
          <div className="kpi-value green">{fmtCurrencyM(cx(ann.netCf), dc)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Net cashflow (Amortized) <KpiInfoIcon tip="Net cashflow with capitalized CapEx spread across its depreciation schedule instead of hitting the year it was paid" /></div>
          <div className="kpi-value green">{fmtCurrencyM(cx(ann.netCfAmortized), dc)}</div>
        </div>
```

- [ ] **Step 2: Fix the `mCapex` year-scoping bug in `CashflowTab.tsx`**

Replace line 34:

```ts
      const mCapex = prop.capex.filter((c) => new Date(c.date).getMonth() === i).reduce((a, b) => a + b.amount, 0)
```

with:

```ts
      const mCapex = prop.capex
        .filter((c) => {
          const d = new Date(`${c.date}T12:00:00`)
          return d.getFullYear() === prop.year && d.getMonth() === i
        })
        .reduce((a, b) => a + b.amount, 0)
```

(This has the same "no year filter" bug as `finance.ts`'s old `totalCapex` — an item from any past/future year with a matching month was being counted in every year's monthly P&L waterfall.)

- [ ] **Step 3: Add the KPI card to `CashflowTab.tsx`**

Replace lines 81-84:

```tsx
        <div className="kpi-card">
          <div className="kpi-label">Net cashflow <KpiInfoIcon tip="Final cashflow after all income and expenses" /></div>
          <div className="kpi-value green">{fmtCurrencyM(cx(ann.netCf), dc)}</div>
        </div>
```

with:

```tsx
        <div className="kpi-card">
          <div className="kpi-label">Net cashflow <KpiInfoIcon tip="Final cashflow after all income and expenses" /></div>
          <div className="kpi-value green">{fmtCurrencyM(cx(ann.netCf), dc)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Net cashflow (Amortized) <KpiInfoIcon tip="Net cashflow with capitalized CapEx spread across its depreciation schedule instead of hitting the year it was paid" /></div>
          <div className="kpi-value green">{fmtCurrencyM(cx(ann.netCfAmortized), dc)}</div>
        </div>
```

- [ ] **Step 4: Manually verify in the running app**

Open a property's Overview tab and Cashflow tab. Confirm both now show two "Net cashflow" cards side by side, and that adding a capitalized CapEx item (from Task 9) makes the two numbers diverge — "Net cashflow" drops by the full amount in the payment year, "Net cashflow (Amortized)" only drops by that year's depreciation slice.

- [ ] **Step 5: Commit**

```bash
git add src/components/property/OverviewTab.tsx src/components/property/CashflowTab.tsx
git commit -m "feat(capex): add amortized net cashflow KPI card; fix capex month-scoping bug in P&L waterfall"
```

---

### Task 12: Portfolio leaderboard — `netCfAmortized` column

**Files:**
- Modify: `src/pages/PortfolioPage.tsx` (8 sites, listed below)

All edits follow the exact pattern already used for the existing `netCf` column/field at each site.

- [ ] **Step 1: Add to `COL_KEYS` and `COL_LABELS`**

Replace line 768:

```ts
  'gpi', 'egi', 'egiPerM2', 'vacancyMoRate', 'opex', 'noi', 'noiPerM2', 'valuePerM2', 'capRate', 'capex', 'yieldOnCapex', 'payback', 'taxes', 'netCf', 'margin',
```

with:

```ts
  'gpi', 'egi', 'egiPerM2', 'vacancyMoRate', 'opex', 'noi', 'noiPerM2', 'valuePerM2', 'capRate', 'capex', 'yieldOnCapex', 'payback', 'taxes', 'netCf', 'netCfAmortized', 'margin',
```

Replace line 778:

```ts
  capRate: 'Cap rate', capex: 'CAPEX', yieldOnCapex: 'Yield on CAPEX', payback: 'Payback (yrs)', taxes: 'Taxes', netCf: 'Net CF', margin: 'Margin',
```

with:

```ts
  capRate: 'Cap rate', capex: 'CAPEX', yieldOnCapex: 'Yield on CAPEX', payback: 'Payback (yrs)', taxes: 'Taxes', netCf: 'Net CF', netCfAmortized: 'Net CF (Amortized)', margin: 'Margin',
```

- [ ] **Step 2: Add a case to `formatCardMetricValue`**

Find the `case 'netCf':` block inside `formatCardMetricValue` (around line 1053-1054):

```ts
    case 'netCf':
      return { text: `${a.netCf >= 0 ? '+' : ''}${fm(a.netCf)}`, tone: a.netCf >= 0 ? 'pos' : 'neg' }
```

Add immediately after it:

```ts
    case 'netCfAmortized':
      return { text: `${a.netCfAmortized >= 0 ? '+' : ''}${fm(a.netCfAmortized)}`, tone: a.netCfAmortized >= 0 ? 'pos' : 'neg' }
```

- [ ] **Step 3: Add to the sort logic**

Find the `else if (sortKey === 'netCf')` line (around line 1989):

```ts
        else if (sortKey === 'netCf') { va = aa.netCf; vb = ab.netCf }
```

Add immediately after it:

```ts
        else if (sortKey === 'netCfAmortized') { va = aa.netCfAmortized; vb = ab.netCfAmortized }
```

- [ ] **Step 4: Add to the CSV export map**

Find the `netCf:` entry in the export map (around line 2487):

```ts
      netCf: { label: `Net CF (${dc})`, value: (_p, a) => raw(a.netCf) },
```

Add immediately after it:

```ts
      netCfAmortized: { label: `Net CF Amortized (${dc})`, value: (_p, a) => raw(a.netCfAmortized) },
```

- [ ] **Step 5: Add to the per-property row `cellMap`**

Find the `netCf:` entry in the leaderboard row's `cellMap` object (around line 3618):

```ts
                    netCf: <td key="netCf" className={a.netCf >= 0 ? 'pos fw5' : 'neg fw5'}>{a.netCf >= 0 ? '+' : ''}{fm(a.netCf)}</td>,
```

Add immediately after it:

```ts
                    netCfAmortized: <td key="netCfAmortized" className={a.netCfAmortized >= 0 ? 'pos fw5' : 'neg fw5'}>{a.netCfAmortized >= 0 ? '+' : ''}{fm(a.netCfAmortized)}</td>,
```

- [ ] **Step 6: Add to the `totalMap` (Total row)**

Find the `netCf:` entry in the total row's `totalMap` object (around line 3710):

```ts
                    netCf: <td key="netCf">{totals.net >= 0 ? '+' : ''}{fm(totals.net)}</td>,
```

Add immediately after it:

```ts
                    netCfAmortized: <td key="netCfAmortized">{totals.netAmortized >= 0 ? '+' : ''}{fm(totals.netAmortized)}</td>,
```

- [ ] **Step 7: Manually verify in the running app**

Open the Portfolio page, open the column picker, confirm "Net CF (Amortized)" is available as a column (both in table view and in the card view's metric picker if applicable), add it, confirm it sorts correctly by clicking its header, and confirm the Total row shows the aggregated value. Export to CSV and confirm the new column appears in the file.

- [ ] **Step 8: Commit**

```bash
git add src/pages/PortfolioPage.tsx
git commit -m "feat(capex): add Net CF (Amortized) column to the portfolio leaderboard"
```

---

### Task 13: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS (all tests, including every test added in Tasks 2-7)

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors

- [ ] **Step 3: Run the linter**

Run: `npm run lint`
Expected: no new errors introduced by this feature (pre-existing warnings elsewhere in the codebase are not this feature's responsibility to fix)

- [ ] **Step 4: Manual smoke test in the browser**

Run: `npm run dev`. Walk through the full flow end to end on a test property:
1. Add a non-recurring CapEx item, Treatment = Capitalize & Depreciate, Amortize against = Contract, pick a contract. Confirm the contract's remaining months compute correctly and the progress bar/pill render.
2. Add a second item, Treatment = Expense. Confirm no progress bar, and it still counts fully in "Net cashflow" and "Net cashflow (Amortized)" alike, in its transaction year only.
3. Confirm the CapEx Depreciation by Month table only lists capitalized items with nonzero depreciation in the current year.
4. Switch the property's viewed year forward past the schedule's end and confirm the depreciation table stops showing that item, while the progress bar (which uses today's real date, not the viewed year) is unaffected by year navigation.
5. Open the Portfolio page and confirm "Net CF (Amortized)" is selectable and computes consistently with the property-level figure.

- [ ] **Step 5: Final commit (if anything was fixed during the smoke test)**

```bash
git add -A
git commit -m "chore(capex): fix issues found during manual verification"
```

(Skip this commit if step 4 found nothing to fix.)
