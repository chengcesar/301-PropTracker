# Multi-Year Contract Escalation & Full-Contract Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make contract rent actually escalate year over year (currently `monthlyRent` is flat forever despite `increment`/`ipcExtra` being stored), and give the Overview tab a new "Active contract" widget that can show either the current year (today's coverage bar, unchanged) or a full multi-year timeline with per-year increment overrides.

**Architecture:** A pure calculation engine lives in `src/lib/finance.ts` (`contractYearIndex`, `rentForContractYear`, `rentOnDate`, `contractYearRows`) and is unit-tested with Vitest — this project has no test runner today, so setting one up is Task 1. Every place that reads `contract.monthlyRent` to compute *actual* income for a specific date switches to `rentOnDate`. A new `ActiveContractCard.tsx` component (extracted rather than added to the already 1190-line `OverviewTab.tsx`) renders the widget and owns the year/full-contract toggle.

**Tech Stack:** React 19, TypeScript, Vite. Adding Vitest for the pure-logic layer (no jsdom needed — nothing under test touches the DOM).

**Reference spec:** [docs/superpowers/specs/2026-08-11-multi-year-contract-escalation-design.md](../specs/2026-08-11-multi-year-contract-escalation-design.md)

---

## Definitions used throughout this plan

- **Contract-year N** (1-based): the 12-month period starting at `startDate`'s Nth anniversary. Year 1 = `[startDate, startDate + 1yr)`. This is *not* the calendar year.
- **Year 1 never has an increment applied** — it's the signed base rent. Increments describe the change from year N−1 to year N, for N ≥ 2.
- **Default increment** (no override): derived purely from `increment`/`fixedPct`/`cpiEstimatePct`/`ipcExtra` — the same value for every contract-year unless overridden.
- **Override**: `yearOverrides[N]` replaces the default increment for contract-year N only, but the resulting rent for year N still compounds into year N+1, N+2, etc.

---

### Task 1: Set up Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

No test runner exists in this project at all. The escalation engine (Task 3 onward) is pure date/math logic that's high-risk to get wrong silently (compounding, anniversary boundaries) and is exactly the kind of code unit tests are for, so we add a minimal runner scoped to that.

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Add the test script**

Modify `package.json` — add `"test": "vitest run"` to `scripts`:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run"
  },
```

- [ ] **Step 4: Verify it runs with zero tests**

Run: `npm test`
Expected: Vitest starts, reports "No test files found" (or similar) — it should NOT error about missing config/binary.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for pure-logic unit tests"
```

---

### Task 2: Add new `Contract` fields and update every construction site

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/data/seedProperties.ts` (unused by the running app, but still type-checked by `tsc -b`)
- Modify: `src/lib/seedProperties.ts`
- Modify: `src/components/modals/AddPropertyModal.tsx`

Adds `fixedPct`, `cpiEstimatePct`, `yearOverrides` to `Contract`. These are required (not optional) fields, matching how `ipcExtra` is already required — so every place that builds a `Contract` object literal needs updating or `tsc -b` fails. There are 8 such literals outside the modal forms (which go through `ContractForm`/`EditContractModal`/`NewContractModal` — handled in Task 11).

- [ ] **Step 1: Add the fields to the type**

Modify `src/lib/types.ts` — in the `Contract` interface, after `ipcExtra: number`:

```ts
export interface Contract {
  id: number
  status: ContractStatus
  tenant: string
  contractManager: string
  monthlyRent: number
  startDate: string
  endDate: string
  paymentDay: number
  deposit: number
  increment: IncrementType
  ipcExtra: number
  /** Annual % increase used when increment === 'fixed' */
  fixedPct: number
  /** Estimated CPI % used as the base for increment === 'ipc' | 'ipc+' (manually entered — not fetched) */
  cpiEstimatePct: number
  /** Contract-year index (1-based, anchored to startDate's anniversary) -> increment % override for that year only */
  yearOverrides?: Record<number, number>
  adminFee: number
  notes: string
}
```

- [ ] **Step 2: Fix `src/data/seedProperties.ts` (3 literals, all `increment: 'ipc+'`)**

All three occurrences are the identical two lines:

```
          increment: 'ipc+',
          ipcExtra: 1,
```

Replace all three with (use replace_all):

```
          increment: 'ipc+',
          ipcExtra: 1,
          fixedPct: 0,
          cpiEstimatePct: 0,
```

- [ ] **Step 3: Fix `src/lib/seedProperties.ts` (4 literals — 2 patterns, 2 occurrences each)**

Pattern A (Sarah Johnson ~L91, Jordan Lee ~L416) — replace both occurrences of:

```
          increment: 'fixed',
          ipcExtra: 0,
```

with:

```
          increment: 'fixed',
          ipcExtra: 0,
          fixedPct: 0,
          cpiEstimatePct: 0,
```

Pattern B (Michael Chen ~L193, Emma Williams ~L334) — replace both occurrences of:

```
          increment: 'none',
          ipcExtra: 0,
```

with:

```
          increment: 'none',
          ipcExtra: 0,
          fixedPct: 0,
          cpiEstimatePct: 0,
```

- [ ] **Step 4: Fix `src/components/modals/AddPropertyModal.tsx` (~L236-237)**

Find:

```ts
              increment: 'ipc+',
              ipcExtra: 1,
```

Replace with:

```ts
              increment: 'ipc+',
              ipcExtra: 1,
              fixedPct: 0,
              cpiEstimatePct: 0,
```

- [ ] **Step 5: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors mentioning `Contract`, `fixedPct`, or `cpiEstimatePct`. (If any construction site was missed, TypeScript will point at the exact file/line — fix it the same way.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/data/seedProperties.ts src/lib/seedProperties.ts src/components/modals/AddPropertyModal.tsx
git commit -m "feat(contracts): add fixedPct, cpiEstimatePct, yearOverrides fields"
```

---

### Task 3: `contractYearIndex` and `contractYearBounds`

**Files:**
- Modify: `src/lib/finance.ts`
- Create: `src/lib/finance.test.ts`

The anniversary-anchored year math everything else builds on.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/finance.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { contractYearIndex, contractYearBounds } from './finance'
import type { Contract } from './types'

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 1,
    status: 'active',
    tenant: 'Test tenant',
    contractManager: '',
    monthlyRent: 1000,
    startDate: '2020-07-01',
    endDate: '2030-06-30',
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

describe('contractYearIndex', () => {
  it('returns 1 on the exact start date', () => {
    const c = makeContract()
    expect(contractYearIndex(c, new Date('2020-07-01T12:00:00'))).toBe(1)
  })

  it('returns 1 the day before the first anniversary', () => {
    const c = makeContract()
    expect(contractYearIndex(c, new Date('2021-06-30T12:00:00'))).toBe(1)
  })

  it('returns 2 exactly on the first anniversary', () => {
    const c = makeContract()
    expect(contractYearIndex(c, new Date('2021-07-01T12:00:00'))).toBe(2)
  })

  it('returns 6 the day before the sixth anniversary', () => {
    const c = makeContract()
    expect(contractYearIndex(c, new Date('2026-06-30T12:00:00'))).toBe(6)
  })

  it('returns 7 exactly on the sixth anniversary', () => {
    const c = makeContract()
    expect(contractYearIndex(c, new Date('2026-07-01T12:00:00'))).toBe(7)
  })
})

describe('contractYearBounds', () => {
  it('bounds year 1 to the contract start date', () => {
    const c = makeContract()
    const b = contractYearBounds(c, 1)
    expect(b.start.toISOString().slice(0, 10)).toBe('2020-07-01')
    expect(b.end.toISOString().slice(0, 10)).toBe('2021-06-30')
  })

  it('bounds the last year to the contract end date', () => {
    const c = makeContract({ startDate: '2020-07-01', endDate: '2022-06-30' })
    const b = contractYearBounds(c, 2)
    expect(b.start.toISOString().slice(0, 10)).toBe('2021-07-01')
    expect(b.end.toISOString().slice(0, 10)).toBe('2022-06-30')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `contractYearIndex` and `contractYearBounds` are not exported from `./finance`.

- [ ] **Step 3: Implement**

Modify `src/lib/finance.ts` — add near the other Contract-related helpers (after `activeContract`, before `contractForMonth`):

```ts
/** 1-based contract-year containing `date`, anchored to startDate's anniversary (not calendar Jan 1). */
export function contractYearIndex(contract: Contract, date: Date): number {
  const start = new Date(`${contract.startDate}T12:00:00`)
  const probe = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0)
  let years = probe.getFullYear() - start.getFullYear()
  const anniversary = new Date(start.getFullYear() + years, start.getMonth(), start.getDate(), 12, 0, 0, 0)
  if (probe < anniversary) years -= 1
  return years + 1
}

/** Calendar bounds of contract-year `yearIndex`, clamped to the contract's actual start/end. */
export function contractYearBounds(contract: Contract, yearIndex: number): { start: Date; end: Date } {
  const contractStart = new Date(`${contract.startDate}T12:00:00`)
  const contractEnd = new Date(`${contract.endDate}T12:00:00`)
  const yearStart = new Date(
    contractStart.getFullYear() + (yearIndex - 1),
    contractStart.getMonth(),
    contractStart.getDate(),
    12, 0, 0, 0,
  )
  const nextYearStart = new Date(
    contractStart.getFullYear() + yearIndex,
    contractStart.getMonth(),
    contractStart.getDate(),
    12, 0, 0, 0,
  )
  const yearEnd = new Date(nextYearStart.getTime() - 24 * 60 * 60 * 1000)
  return {
    start: yearStart < contractStart ? contractStart : yearStart,
    end: yearEnd > contractEnd ? contractEnd : yearEnd,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance.ts src/lib/finance.test.ts
git commit -m "feat(finance): add contractYearIndex and contractYearBounds"
```

---

### Task 4: `defaultIncrementPct` and `effectiveIncrementPct`

**Files:**
- Modify: `src/lib/finance.ts`
- Modify: `src/lib/finance.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/finance.test.ts`:

```ts
import { defaultIncrementPct, effectiveIncrementPct } from './finance'

describe('defaultIncrementPct', () => {
  it('returns fixedPct for increment "fixed"', () => {
    expect(defaultIncrementPct(makeContract({ increment: 'fixed', fixedPct: 3 }))).toBe(3)
  })

  it('returns cpiEstimatePct for increment "ipc"', () => {
    expect(defaultIncrementPct(makeContract({ increment: 'ipc', cpiEstimatePct: 5 }))).toBe(5)
  })

  it('returns cpiEstimatePct + ipcExtra for increment "ipc+"', () => {
    expect(defaultIncrementPct(makeContract({ increment: 'ipc+', cpiEstimatePct: 5, ipcExtra: 1 }))).toBe(6)
  })

  it('returns 0 for increment "none"', () => {
    expect(defaultIncrementPct(makeContract({ increment: 'none', fixedPct: 99 }))).toBe(0)
  })
})

describe('effectiveIncrementPct', () => {
  it('falls back to the default when there is no override', () => {
    const c = makeContract({ increment: 'fixed', fixedPct: 3 })
    expect(effectiveIncrementPct(c, 2)).toBe(3)
  })

  it('uses the override for that year only', () => {
    const c = makeContract({ increment: 'fixed', fixedPct: 3, yearOverrides: { 2: 10 } })
    expect(effectiveIncrementPct(c, 2)).toBe(10)
    expect(effectiveIncrementPct(c, 3)).toBe(3)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `defaultIncrementPct` and `effectiveIncrementPct` not exported.

- [ ] **Step 3: Implement**

Modify `src/lib/finance.ts` — add directly after `contractYearBounds`:

```ts
/** Type-based increment %, ignoring any per-year override. Same value for every contract-year. */
export function defaultIncrementPct(contract: Contract): number {
  switch (contract.increment) {
    case 'fixed':
      return contract.fixedPct
    case 'ipc':
      return contract.cpiEstimatePct
    case 'ipc+':
      return contract.cpiEstimatePct + contract.ipcExtra
    case 'none':
    default:
      return 0
  }
}

/** Increment % actually applied for contract-year `yearIndex` — override if set, else the type-based default. */
export function effectiveIncrementPct(contract: Contract, yearIndex: number): number {
  return contract.yearOverrides?.[yearIndex] ?? defaultIncrementPct(contract)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance.ts src/lib/finance.test.ts
git commit -m "feat(finance): add defaultIncrementPct and effectiveIncrementPct"
```

---

### Task 5: `rentForContractYear`

**Files:**
- Modify: `src/lib/finance.ts`
- Modify: `src/lib/finance.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/finance.test.ts`:

```ts
import { rentForContractYear } from './finance'

describe('rentForContractYear', () => {
  it('year 1 is always the base monthlyRent, no increment applied', () => {
    const c = makeContract({ monthlyRent: 1000, increment: 'fixed', fixedPct: 10 })
    expect(rentForContractYear(c, 1)).toBe(1000)
  })

  it('compounds the default increment year over year', () => {
    const c = makeContract({ monthlyRent: 1000, increment: 'fixed', fixedPct: 10 })
    expect(rentForContractYear(c, 2)).toBe(1100)
    expect(rentForContractYear(c, 3)).toBeCloseTo(1210, 5)
  })

  it('an override on year N changes N and compounds into later years, not earlier ones', () => {
    const c = makeContract({
      monthlyRent: 1000,
      increment: 'fixed',
      fixedPct: 10,
      yearOverrides: { 2: 0 },
    })
    expect(rentForContractYear(c, 1)).toBe(1000)
    expect(rentForContractYear(c, 2)).toBe(1000) // override: 0% instead of 10%
    expect(rentForContractYear(c, 3)).toBeCloseTo(1100, 5) // year 3 has no override, +10% on top of year 2's 1000
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `rentForContractYear` not exported.

- [ ] **Step 3: Implement**

Modify `src/lib/finance.ts` — add directly after `effectiveIncrementPct`:

```ts
/** Rent for contract-year `yearIndex`, compounding the effective increment from year 1's base monthlyRent. */
export function rentForContractYear(contract: Contract, yearIndex: number): number {
  let rent = contract.monthlyRent
  for (let y = 2; y <= yearIndex; y++) {
    rent = rent * (1 + effectiveIncrementPct(contract, y) / 100)
  }
  return rent
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance.ts src/lib/finance.test.ts
git commit -m "feat(finance): add rentForContractYear compounding calculation"
```

---

### Task 6: `rentOnDate`

**Files:**
- Modify: `src/lib/finance.ts`
- Modify: `src/lib/finance.test.ts`

This is the function every income read-site switches to.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/finance.test.ts`:

```ts
import { rentOnDate } from './finance'

describe('rentOnDate', () => {
  it('returns the base rent inside year 1', () => {
    const c = makeContract({ monthlyRent: 1000, increment: 'fixed', fixedPct: 10 })
    expect(rentOnDate(c, new Date('2021-01-15T12:00:00'))).toBe(1000)
  })

  it('returns the escalated rent once a later contract-year has started', () => {
    const c = makeContract({ monthlyRent: 1000, increment: 'fixed', fixedPct: 10 })
    // 2026-07-01 is the start of contract-year 7 (see contractYearIndex tests)
    expect(rentOnDate(c, new Date('2026-07-01T12:00:00'))).toBeCloseTo(1000 * 1.1 ** 6, 5)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `rentOnDate` not exported.

- [ ] **Step 3: Implement**

Modify `src/lib/finance.ts` — add directly after `rentForContractYear`:

```ts
/** What this contract actually pays on `date` — the new source of truth for real rent, replacing raw monthlyRent reads. */
export function rentOnDate(contract: Contract, date: Date): number {
  return rentForContractYear(contract, contractYearIndex(contract, date))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance.ts src/lib/finance.test.ts
git commit -m "feat(finance): add rentOnDate"
```

---

### Task 7: Wire `rentOnDate` into the existing income calculations

**Files:**
- Modify: `src/lib/finance.ts:224-297` (per the current line numbers — re-check before editing since Tasks 3-6 added lines above this)
- Modify: `src/lib/finance.test.ts`

Updates the three sites identified in the spec: `maxMonthlyRentAmongContractsOverlappingYear`, `monthlyPotentialRentForGpi`, and `getMonthData`. These three feed `calcAnnual` and `vacancyLossMonthCount`, so fixing them here is sufficient — no changes needed in those two.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/finance.test.ts`:

```ts
import { maxMonthlyRentAmongContractsOverlappingYear, monthlyPotentialRentForGpi, getMonthData } from './finance'
import type { Property } from './types'

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 1,
    owner: '', name: 'Test', address: '', neighbourhood: '', city: '', postalCode: '', country: '',
    currency: 'USD', area: 0, bedrooms: 0, bathrooms: 0, parking: 0, storageUnits: 0,
    concierge: false, terrace: 0, balcony: 0, floors: 0,
    year: 2026,
    contracts: [],
    months: {},
    capex: [],
    taxes: { items: [] },
    ...overrides,
  }
}

describe('maxMonthlyRentAmongContractsOverlappingYear uses escalated rent', () => {
  it('uses the rent at the point the contract overlaps the year, not the flat base', () => {
    const c = makeContract({
      monthlyRent: 1000, increment: 'fixed', fixedPct: 10,
      startDate: '2020-07-01', endDate: '2030-06-30',
    })
    // Calendar year 2026 overlaps contract-years 6 and 7 (see contractYearIndex tests) — clamped to Jan 1, 2026
    const expected = rentForContractYear(c, contractYearIndex(c, new Date(2026, 0, 1, 12)))
    expect(maxMonthlyRentAmongContractsOverlappingYear([c], 2026)).toBeCloseTo(expected, 5)
  })
})

describe('monthlyPotentialRentForGpi uses escalated rent', () => {
  it('returns the escalated rent for the covering contract in that month', () => {
    const c = makeContract({
      monthlyRent: 1000, increment: 'fixed', fixedPct: 10,
      startDate: '2020-07-01', endDate: '2030-06-30',
    })
    const p = makeProperty({ year: 2026, contracts: [c] })
    // July 2026 (month index 6) is the start of contract-year 7
    expect(monthlyPotentialRentForGpi(p, 6)).toBeCloseTo(1000 * 1.1 ** 6, 5)
  })
})

describe('getMonthData uses escalated rent', () => {
  it('reports escalated income for a covered month with no override', () => {
    const c = makeContract({
      monthlyRent: 1000, increment: 'fixed', fixedPct: 10,
      startDate: '2020-07-01', endDate: '2030-06-30',
    })
    const p = makeProperty({ year: 2026, contracts: [c] })
    expect(getMonthData(p, 6).income).toBeCloseTo(1000 * 1.1 ** 6, 5)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — the three functions still return the flat `1000` instead of the escalated value.

- [ ] **Step 3: Implement**

Modify `src/lib/finance.ts`:

Find (in `maxMonthlyRentAmongContractsOverlappingYear`):

```ts
  for (const c of contracts) {
    if (!contractOverlapsCalendarYear(c, year)) continue
    max = Math.max(max, c.monthlyRent)
  }
```

Replace with:

```ts
  for (const c of contracts) {
    if (!contractOverlapsCalendarYear(c, year)) continue
    const start = new Date(`${c.startDate}T12:00:00`)
    const end = new Date(`${c.endDate}T12:00:00`)
    const yearStart = new Date(year, 0, 1, 12, 0, 0, 0)
    const probe = yearStart < start ? start : yearStart > end ? end : yearStart
    max = Math.max(max, rentOnDate(c, probe))
  }
```

Find (in `monthlyPotentialRentForGpi`):

```ts
  const c = contractForMonth(prop.contracts, prop.year, monthIdx)
  if (c) return c.monthlyRent
```

Replace with:

```ts
  const c = contractForMonth(prop.contracts, prop.year, monthIdx)
  if (c) return rentOnDate(c, new Date(prop.year, monthIdx, 15))
```

Find (in `getMonthData`):

```ts
  const rent = contract ? contract.monthlyRent : 0
```

Replace with:

```ts
  const rent = contract ? rentOnDate(contract, new Date(prop.year, mIdx, 15)) : 0
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests green, including the new ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance.ts src/lib/finance.test.ts
git commit -m "feat(finance): use escalated rent in GPI/vacancy/month-income calculations"
```

---

### Task 8: `contractYearRows` — the row model for the "Full contract" timeline

**Files:**
- Modify: `src/lib/finance.ts`
- Modify: `src/lib/finance.test.ts`

Keeps the multi-year row/color/total logic in a pure, testable function so `ActiveContractCard.tsx` (Task 13) just renders it.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/finance.test.ts`:

```ts
import { contractYearRows } from './finance'

describe('contractYearRows', () => {
  it('builds one row per calendar year the contract touches, clamped at both ends', () => {
    const c = makeContract({
      monthlyRent: 1000, increment: 'none',
      startDate: '2020-07-01', endDate: '2022-06-30',
    })
    const rows = contractYearRows(c, new Date('2021-01-01T12:00:00'))
    expect(rows.map((r) => r.calendarYear)).toEqual([2020, 2021, 2022])
    // 2020: only Jul-Dec in range, all within contract-year 1
    expect(rows[0].yearIndex).toBe(1)
    expect(rows[0].months[0].rent).toBeNull() // January, before startDate
    expect(rows[0].months[6].rent).toBe(1000) // July
    // 2021: Jan-Jun tail of year 1, Jul-Dec start of year 2
    expect(rows[1].yearIndex).toBe(2)
    expect(rows[1].months[0].rent).toBe(1000) // January — still contract-year 1
    expect(rows[1].months[6].rent).toBe(1000) // July — contract-year 2 (0% increment, same value)
    // 2022: only Jan-Jun in range (contract ends June 30), within contract-year 2
    expect(rows[2].yearIndex).toBe(2)
    expect(rows[2].months[0].rent).toBe(1000)
    expect(rows[2].months[6].rent).toBeNull() // July, after endDate
  })

  it('flags exactly one row as current based on the reference date', () => {
    const c = makeContract({ startDate: '2020-07-01', endDate: '2030-06-30' })
    const rows = contractYearRows(c, new Date('2026-03-01T12:00:00'))
    const flagged = rows.filter((r) => r.isCurrent)
    expect(flagged.map((r) => r.calendarYear)).toEqual([2026])
    expect(rows.find((r) => r.calendarYear === 2024)?.isPast).toBe(true)
    expect(rows.find((r) => r.calendarYear === 2028)?.isFuture).toBe(true)
  })

  it('reports the default increment hint alongside any override', () => {
    const c = makeContract({
      increment: 'fixed', fixedPct: 5,
      startDate: '2020-07-01', endDate: '2022-06-30',
      yearOverrides: { 2: 8 },
    })
    const rows = contractYearRows(c, new Date('2021-01-01T12:00:00'))
    const row2021 = rows.find((r) => r.calendarYear === 2021)!
    expect(row2021.yearIndex).toBe(2)
    expect(row2021.defaultIncrementPct).toBe(5)
    expect(row2021.incrementPct).toBe(8)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `contractYearRows` not exported.

- [ ] **Step 3: Implement**

Modify `src/lib/finance.ts` — add directly after `rentOnDate`:

```ts
export interface ContractYearMonth {
  /** Rent for this calendar month, or null if it falls outside [startDate, endDate]. */
  rent: number | null
}

export interface ContractYearRow {
  calendarYear: number
  /** The contract-year active in the second half of this calendar year — used as the row's "Year N" label. */
  yearIndex: number
  months: ContractYearMonth[]
  /** Type-based increment %, ignoring any override (the "+X% default" hint). */
  defaultIncrementPct: number
  /** Increment % actually applied for `yearIndex` (override if set, else the default). */
  incrementPct: number
  /** Sum of this row's non-null months' rent. */
  annualTotal: number
  isPast: boolean
  isCurrent: boolean
  isFuture: boolean
}

/** One row per calendar year the contract touches, for the "Full contract" timeline view. */
export function contractYearRows(contract: Contract, today: Date): ContractYearRow[] {
  const start = new Date(`${contract.startDate}T12:00:00`)
  const end = new Date(`${contract.endDate}T12:00:00`)
  const rows: ContractYearRow[] = []
  const currentCalendarYear = today.getFullYear()

  for (let calendarYear = start.getFullYear(); calendarYear <= end.getFullYear(); calendarYear++) {
    const months: ContractYearMonth[] = []
    for (let m = 0; m < 12; m++) {
      const probe = new Date(calendarYear, m, 15, 12, 0, 0, 0)
      if (probe < start || probe > end) {
        months.push({ rent: null })
      } else {
        months.push({ rent: rentOnDate(contract, probe) })
      }
    }
    const labelProbeRaw = new Date(calendarYear, 11, 31, 12, 0, 0, 0)
    const labelProbe = labelProbeRaw > end ? end : labelProbeRaw
    const yearIndex = contractYearIndex(contract, labelProbe)
    const annualTotal = months.reduce((sum, m) => sum + (m.rent ?? 0), 0)
    rows.push({
      calendarYear,
      yearIndex,
      months,
      defaultIncrementPct: defaultIncrementPct(contract),
      incrementPct: effectiveIncrementPct(contract, yearIndex),
      annualTotal,
      isPast: calendarYear < currentCalendarYear,
      isCurrent: calendarYear === currentCalendarYear,
      isFuture: calendarYear > currentCalendarYear,
    })
  }
  return rows
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance.ts src/lib/finance.test.ts
git commit -m "feat(finance): add contractYearRows for the full-contract timeline view"
```

---

### Task 9: Wire escalated rent into `PortfolioPage.tsx`

**Files:**
- Modify: `src/pages/PortfolioPage.tsx`

Three sites (re-check exact line numbers before editing — they shift as earlier tasks touch other files, though none of those are `PortfolioPage.tsx`, so these should still be close to 2042/2066/2164):

- [ ] **Step 1: Import `rentOnDate`**

Find the existing import of finance helpers near the top of `PortfolioPage.tsx` (it already imports things like `contractForMonth`, `activeContract`, `calcAnnual` from `../lib/finance`) and add `rentOnDate` to that import list.

- [ ] **Step 2: Fix the "this month payments" panel**

Find (~L2042):

```ts
        const rent = monthData?.incomeOverride ?? contract.monthlyRent
```

This line appears twice — once in `thisMonthPayments` (using `now`/`calYear`/`calMonth`) and once in `overduePayments` (using `y`/`m`). Fix each with the date already in scope at that point:

In `thisMonthPayments` (~L2033-2046), replace:

```ts
        const rent = monthData?.incomeOverride ?? contract.monthlyRent
```

with:

```ts
        const rent = monthData?.incomeOverride ?? rentOnDate(contract, new Date(calYear, calMonth, 15))
```

In `overduePayments` (~L2049-2078), replace:

```ts
        const rent = monthData?.incomeOverride ?? contract.monthlyRent
```

with:

```ts
        const rent = monthData?.incomeOverride ?? rentOnDate(contract, new Date(y, m, 15))
```

- [ ] **Step 3: Fix `activeContractMap`**

Find (~L2160-2167):

```ts
  const activeContractMap = useMemo(() => {
    const m = new Map<number, { monthlyRent: number } | null>()
    for (const p of properties) {
      const ac = activeContract(p)
      m.set(p.id, ac ? { monthlyRent: ac.monthlyRent } : null)
    }
    return m
  }, [properties])
```

Replace with:

```ts
  const activeContractMap = useMemo(() => {
    const m = new Map<number, { monthlyRent: number } | null>()
    const now = new Date()
    for (const p of properties) {
      const ac = activeContract(p)
      m.set(p.id, ac ? { monthlyRent: rentOnDate(ac, now) } : null)
    }
    return m
  }, [properties])
```

`PropertyLeaderboardMap.tsx` reads `contract?.monthlyRent` from this same map's entries (shape `{ monthlyRent: number }`) — no change needed there since the map now already stores the escalated value under that same key.

- [ ] **Step 4: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 5: Manually verify**

Run: `npm run dev`, open the Portfolio page, find a property with a multi-year contract whose current contract-year has escalated (or temporarily set a seed contract's `startDate` a few years back with `increment: 'fixed'` and `fixedPct: 5` to force a visible change), and confirm the "This month" payments panel and any leaderboard rent figure show the escalated amount, not the flat signed rent.

- [ ] **Step 6: Commit**

```bash
git add src/pages/PortfolioPage.tsx
git commit -m "feat(portfolio): use escalated rent in payments panels and active-contract map"
```

---

### Task 10: Wire escalated rent into `MonthModal.tsx`

**Files:**
- Modify: `src/components/modals/MonthModal.tsx`

- [ ] **Step 1: Import `rentOnDate`**

Modify the existing import:

```ts
import { contractForMonth, expenseRowsForYear, yearMonths } from '../../lib/finance'
```

to:

```ts
import { contractForMonth, expenseRowsForYear, rentOnDate, yearMonths } from '../../lib/finance'
```

- [ ] **Step 2: Fix the income calculation**

Find (~L37):

```ts
  const income = !contract ? 0 : status === 'vacant' ? 0 : incOverride !== '' ? parseNum(incOverride) : contract.monthlyRent
```

Replace with:

```ts
  const income = !contract ? 0 : status === 'vacant' ? 0 : incOverride !== '' ? parseNum(incOverride) : rentOnDate(contract, new Date(prop.year, mIdx, 15))
```

- [ ] **Step 3: Fix the placeholder**

Find (~L118):

```ts
                    placeholder={fmt(contract.monthlyRent)}
```

Replace with:

```ts
                    placeholder={fmt(rentOnDate(contract, new Date(prop.year, mIdx, 15)))}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 5: Manually verify**

Run: `npm run dev`, open a month with an escalated contract (from Task 9's test setup) via the month grid on the Overview tab, and confirm the "Income override" placeholder shows the escalated amount.

- [ ] **Step 6: Commit**

```bash
git add src/components/modals/MonthModal.tsx
git commit -m "feat(month-modal): use escalated rent for income calc and override placeholder"
```

---

### Task 11: `ContractForm.tsx` — Fixed %, CPI estimate %, and relabeled extra %

**Files:**
- Modify: `src/components/modals/ContractForm.tsx`
- Modify: `src/components/modals/NewContractModal.tsx`
- Modify: `src/components/modals/EditContractModal.tsx`

- [ ] **Step 1: Add the new fields to `ContractFormState`**

Modify `src/components/modals/ContractForm.tsx` — in `ContractFormState`, after `ipcExtra: number`:

```ts
export type ContractFormState = {
  tenant: string
  contractManager: string
  monthlyRent: string | number
  startDate: string
  endDate: string
  paymentDay: number
  deposit: number
  increment: IncrementType | string
  ipcExtra: number
  fixedPct: number
  cpiEstimatePct: number
  adminFee: string | number
  notes: string
}
```

- [ ] **Step 2: Replace the increment extra-input block**

Find:

```tsx
      {(value.increment === 'ipc+' || !value.increment) && (
        <div className="field">
          <label>% over IPC</label>
          <input
            type="number"
            step={0.1}
            value={value.ipcExtra ?? 1}
            onChange={(e) => set('ipcExtra', parseFloat(e.target.value))}
          />
        </div>
      )}
```

Replace with:

```tsx
      {value.increment === 'fixed' && (
        <div className="field">
          <label>Fixed %</label>
          <input
            type="number"
            step={0.1}
            value={value.fixedPct ?? 0}
            onChange={(e) => set('fixedPct', parseFloat(e.target.value))}
          />
        </div>
      )}
      {value.increment === 'ipc' && (
        <div className="field">
          <label>IPC (estimate) %</label>
          <input
            type="number"
            step={0.1}
            value={value.cpiEstimatePct ?? 0}
            onChange={(e) => set('cpiEstimatePct', parseFloat(e.target.value))}
          />
        </div>
      )}
      {(value.increment === 'ipc+' || !value.increment) && (
        <>
          <div className="field">
            <label>IPC (estimate) %</label>
            <input
              type="number"
              step={0.1}
              value={value.cpiEstimatePct ?? 0}
              onChange={(e) => set('cpiEstimatePct', parseFloat(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Fixed extra %</label>
            <input
              type="number"
              step={0.1}
              value={value.ipcExtra ?? 1}
              onChange={(e) => set('ipcExtra', parseFloat(e.target.value))}
            />
          </div>
        </>
      )}
```

- [ ] **Step 3: Wire the new fields into `NewContractModal.tsx`**

Modify the initial form state (~L17-30) — add after `ipcExtra: 1,`:

```ts
    ipcExtra: 1,
    fixedPct: 0,
    cpiEstimatePct: 0,
```

Modify the `save` function's `Contract` literal (~L41-55) — add after `ipcExtra: form.ipcExtra,`:

```ts
      ipcExtra: form.ipcExtra,
      fixedPct: form.fixedPct,
      cpiEstimatePct: form.cpiEstimatePct,
```

- [ ] **Step 4: Wire the new fields into `EditContractModal.tsx`**

Modify the initial form state (~L15-27) — add after `ipcExtra: contract.ipcExtra,`:

```ts
    ipcExtra: contract.ipcExtra,
    fixedPct: contract.fixedPct,
    cpiEstimatePct: contract.cpiEstimatePct,
```

The `save` function already spreads `...form` over `...contract`, so `fixedPct`/`cpiEstimatePct` are included automatically — no further change needed there.

- [ ] **Step 5: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Manually verify**

Run: `npm run dev`. Open "+ New contract" on any property, pick each of the four increment options in turn, and confirm: `Fixed %` shows one input, `IPC only` shows one input, `IPC + fixed %` shows two inputs (IPC estimate % and Fixed extra %), `None` shows no extra input. Save a contract with `IPC + fixed %`, then reopen it via Edit and confirm both values round-trip correctly.

- [ ] **Step 7: Commit**

```bash
git add src/components/modals/ContractForm.tsx src/components/modals/NewContractModal.tsx src/components/modals/EditContractModal.tsx
git commit -m "feat(contract-form): add Fixed % and IPC estimate % inputs per increment type"
```

---

### Task 12: `ActiveContractCard.tsx` — current-year state (relocate the existing coverage bar)

**Files:**
- Create: `src/components/property/ActiveContractCard.tsx`
- Modify: `src/components/property/ContractsTab.tsx`
- Modify: `src/components/property/OverviewTab.tsx`

This task only relocates what already exists (today's Coverage bar) behind a toggle and swaps it into `OverviewTab`. The new "Full contract" state is Task 13.

- [ ] **Step 1: Create the component with just the current-year state**

Create `src/components/property/ActiveContractCard.tsx`:

```tsx
import { useState } from 'react'
import { MONTHS } from '../../lib/constants'
import type { Contract, Property } from '../../lib/types'
import { contractForMonth } from '../../lib/finance'
import { fmtCurrency } from '../../lib/format'

type Props = {
  prop: Property
  contract: Contract
  onUpdateProp: (fn: (p: Property) => Property) => void
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ActiveContractCard({ prop, contract, onUpdateProp }: Props) {
  const [tab, setTab] = useState<'year' | 'full'>('year')

  const coverage = MONTHS.map((name, i) => ({
    name,
    contract: contractForMonth(prop.contracts, prop.year, i),
  }))
  const coveredCount = coverage.filter((c) => c.contract).length

  return (
    <div className="card">
      <div className="card-inner">
        <div className="flex align-center" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="fw6" style={{ fontSize: '14px' }}>Active contract</div>
          <div className="flex" style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              type="button"
              className={tab === 'year' ? 'primary' : 'ghost'}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 0 }}
              onClick={() => setTab('year')}
            >
              {prop.year}
            </button>
            <button
              type="button"
              className={tab === 'full' ? 'primary' : 'ghost'}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 0 }}
              onClick={() => setTab('full')}
            >
              Full contract
            </button>
          </div>
        </div>

        <div className="fs12 text3 mb12">
          {formatDate(contract.startDate)} → {formatDate(contract.endDate)} · {fmtCurrency(contract.monthlyRent, prop.currency)}/mo base
        </div>

        {tab === 'year' ? (
          <>
            <div className="month-bar-row mb8">
              {coverage.map(({ name, contract: c }, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div className="month-bar-seg" style={{ background: c ? '#1A6B47' : '#E2DED6' }} />
                  <span className="fs11 text3">{name}</span>
                </div>
              ))}
            </div>
            <div className="flex gap16">
              <span className="fs11 text3 flex gap4 align-center">
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#1A6B47' }} />
                Covered
              </span>
              <span className="fs11 text3 flex gap4 align-center">
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#E2DED6' }} />
                Vacant / no contract
              </span>
              <span className="fs11 text3 mono" style={{ marginLeft: 'auto' }}>
                {coveredCount} / 12 months covered
              </span>
            </div>
          </>
        ) : (
          <div className="fs12 text3">Full contract view coming up next.</div>
        )}
      </div>
    </div>
  )
}
```

(`onUpdateProp` is unused for now — it's needed starting Task 13 for saving overrides, so keep it in the props signature but don't wire it yet. If your linter fails on unused props destructuring, that's fine since it's a named prop, not a local unused variable — but if it does complain, prefix with `_` temporarily: this will be used in the very next task, so don't delete it.)

- [ ] **Step 2: Remove the coverage bar from `ContractsTab.tsx`**

Find (~L64-94):

```tsx
      <div className="sec-hdr mb8">
        <span className="sec-title">Coverage — {prop.year}</span>
        <button type="button" className="primary" style={{ fontSize: '12px', padding: '5px 14px' }} onClick={() => setNewModal(true)}>
          + New contract
        </button>
      </div>
      <div className="card mb24">
        <div className="card-inner">
          <div className="month-bar-row mb8">
            {coverage.map(({ name, contract }, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div className="month-bar-seg" style={{ background: contract ? '#1A6B47' : '#E2DED6' }} />
                <span className="fs11 text3">{name}</span>
              </div>
            ))}
          </div>
          <div className="flex gap16">
            <span className="fs11 text3 flex gap4 align-center">
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#1A6B47' }} />
              Covered
            </span>
            <span className="fs11 text3 flex gap4 align-center">
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#E2DED6' }} />
              Vacant / no contract
            </span>
            <span className="fs11 text3 mono" style={{ marginLeft: 'auto' }}>
              {coverage.filter((c) => c.contract).length} / 12 months covered
            </span>
          </div>
        </div>
      </div>

      <div className="sec-hdr mb12">
        <span className="sec-title">Contract history</span>
      </div>
```

Replace with:

```tsx
      <div className="sec-hdr mb12">
        <span className="sec-title">Contract history</span>
        <button type="button" className="primary" style={{ fontSize: '12px', padding: '5px 14px' }} onClick={() => setNewModal(true)}>
          + New contract
        </button>
      </div>
```

The `coverage` local variable (built via `MONTHS.map(...)` near the top of the component) is now unused in `ContractsTab.tsx` — delete its declaration too:

Find:

```ts
  const coverage = MONTHS.map((name, i) => ({
    name,
    contract: contractForMonth(prop.contracts, prop.year, i),
  }))
```

Delete it. If `MONTHS` and `contractForMonth` are now unused imports in this file, remove them from the import statements at the top.

- [ ] **Step 3: Swap it into `OverviewTab.tsx`**

Find (~L316-349):

```tsx
        {active ? (
          <div className="card">
            <div className="card-inner">
              <div className="fw6 mb12" style={{ fontSize: '14px' }}>Active contract</div>
              <table className="contract-detail-table">
                <tbody>
                  <tr>
                    <td className="cdt-label">Tenant</td>
                    <td className="cdt-value">{active.tenant || '—'}</td>
                  </tr>
                  <tr>
                    <td className="cdt-label">Monthly rent</td>
                    <td className="cdt-value">{fmtCurrency(cx(active.monthlyRent ?? 0), displayCurrency ?? prop.currency)}</td>
                  </tr>
                  <tr>
                    <td className="cdt-label">Start date</td>
                    <td className="cdt-value">{formatDate(active.startDate)}</td>
                  </tr>
                  <tr>
                    <td className="cdt-label">End date</td>
                    <td className="cdt-value">{formatDate(active.endDate)}</td>
                  </tr>
                  <tr>
                    <td className="cdt-label">Annual increment</td>
                    <td className="cdt-value">{formatIncrement(active)}</td>
                  </tr>
                  <tr>
                    <td className="cdt-label">Security deposit</td>
                    <td className="cdt-value">{active.deposit} months</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : prop.occupant ? (
```

Replace with:

```tsx
        {active ? (
          <ActiveContractCard prop={prop} contract={active} onUpdateProp={onUpdateProp} />
        ) : prop.occupant ? (
```

Add the import near the top of `OverviewTab.tsx` (alongside the other component imports):

```ts
import { ActiveContractCard } from './ActiveContractCard'
```

`formatDate` and `formatIncrement` are still used elsewhere lower in `OverviewTab.tsx`? Check: `formatDate` was only used in the block just removed and in the Occupant card (`{prop.occupant.since && ... formatDate(prop.occupant.since)}`) — it's still used, keep it. `formatIncrement` was only used in the removed block — if nothing else in the file calls it, delete the `formatIncrement` function (~L25-30) to avoid an unused-function lint warning.

- [ ] **Step 4: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors. If `formatIncrement` or any import is now unused, either delete it (per Step 3) or the build will just warn via ESLint, not fail `tsc` — but clean it up anyway.

- [ ] **Step 5: Manually verify**

Run: `npm run dev`, open a property with an active contract, and confirm the Overview tab shows the new "Active contract" card with the `{year}` / `Full contract` toggle, and that the `{year}` tab looks identical to the old Coverage bar that used to be under the Contracts tab (same colors, same "X/12 months covered" text). Switch to the Contracts tab and confirm the Coverage bar is gone from there (history timeline still present) and "+ New contract" now sits next to "Contract history".

- [ ] **Step 6: Commit**

```bash
git add src/components/property/ActiveContractCard.tsx src/components/property/ContractsTab.tsx src/components/property/OverviewTab.tsx
git commit -m "feat(overview): relocate coverage bar into new ActiveContractCard with year/full-contract toggle"
```

---

### Task 13: `ActiveContractCard.tsx` — "Full contract" timeline with per-year overrides

**Files:**
- Modify: `src/components/property/ActiveContractCard.tsx`

Builds the multi-year rows using `contractYearRows` (Task 8) and lets the user edit `yearOverrides` inline.

- [ ] **Step 1: Add the row-saving handler and imports**

Modify `src/components/property/ActiveContractCard.tsx` — update imports:

```tsx
import { useState } from 'react'
import { MONTHS, MONTHS_FULL } from '../../lib/constants'
import type { Contract, Property } from '../../lib/types'
import { contractForMonth, contractYearRows } from '../../lib/finance'
import { fmtCurrency } from '../../lib/format'
```

Add inside the component, after the `coverage`/`coveredCount` block:

```tsx
  const setYearOverride = (yearIndex: number, pct: number) => {
    onUpdateProp((p) => ({
      ...p,
      contracts: p.contracts.map((c) =>
        c.id === contract.id
          ? { ...c, yearOverrides: { ...(c.yearOverrides ?? {}), [yearIndex]: pct } }
          : c,
      ),
    }))
  }

  const rows = contractYearRows(contract, new Date())
```

- [ ] **Step 2: Replace the "coming up next" placeholder**

Find:

```tsx
        ) : (
          <div className="fs12 text3">Full contract view coming up next.</div>
        )}
```

Replace with:

```tsx
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map((row) => {
              const rowStyle: React.CSSProperties = row.isCurrent
                ? { border: '1px solid #1A6B47', background: '#f0fdf4', borderRadius: 10, padding: 12 }
                : row.isFuture
                  ? { border: '1px solid #a78bfa', borderRadius: 10, padding: 12 }
                  : { border: '1px solid var(--border)', borderRadius: 10, padding: 12, opacity: 0.7 }
              return (
                <div key={row.calendarYear} style={rowStyle}>
                  <div className="flex align-center" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                    <div className="fw6 fs13">
                      {row.calendarYear} <span className="text3">Year {row.yearIndex}</span>
                    </div>
                    <div className="flex align-center gap8">
                      <label className="fs11 text3">Increment %</label>
                      <input
                        type="number"
                        step={0.1}
                        value={row.incrementPct}
                        onChange={(e) => setYearOverride(row.yearIndex, parseFloat(e.target.value) || 0)}
                        style={{ width: 60, fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)' }}
                      />
                      <span className="fs11 text3">+{row.defaultIncrementPct}% default</span>
                      <span className="fs12 fw5">= {fmtCurrency(row.annualTotal, prop.currency)} / yr</span>
                    </div>
                  </div>
                  <div className="flex" style={{ gap: 2 }}>
                    {row.months.map((month, i) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div
                          className="month-bar-seg"
                          title={month.rent != null ? fmtCurrency(month.rent, prop.currency) : 'No contract'}
                          style={{
                            background:
                              month.rent == null
                                ? '#E2DED6'
                                : row.isPast
                                  ? '#c8c2b6'
                                  : '#1A6B47',
                          }}
                        />
                        <span className="fs11 text3">{MONTHS[i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
```

`MONTHS_FULL` is imported but not directly used yet in this snippet (`title` uses formatted currency instead) — remove it from the import if you don't end up needing it, to keep the build warning-free.

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Manually verify**

Run: `npm run dev`. Open a property with a multi-year active contract (or edit one via "Edit contract" to stretch `endDate` several years out and set `increment: 'fixed'` with a nonzero `Fixed %`). On the Overview tab's Active Contract card, click "Full contract" and confirm:
- One row per calendar year the contract spans, with blank months before `startDate`/after `endDate`
- The current calendar year's row is highlighted (green border), a future year has a purple border, past years are muted
- Editing a row's "Increment %" input immediately changes that row's "= $X / yr" total and every later row's total (but not earlier rows)
- Switching back to `{year}` still shows the original single-year coverage bar unaffected

- [ ] **Step 5: Commit**

```bash
git add src/components/property/ActiveContractCard.tsx
git commit -m "feat(overview): add full-contract multi-year timeline with per-year increment overrides"
```

---

## Post-implementation check

- [ ] Run `npm test` — all finance.ts tests pass
- [ ] Run `npx tsc -b --noEmit` — no type errors
- [ ] Run `npm run lint` — no new lint errors introduced by this feature
- [ ] Manually walk through: create a new multi-year contract with `IPC + fixed %`, confirm the two-input form, confirm the Active Contract card's Full-contract view shows escalating rent, override one year, confirm later years recompute
