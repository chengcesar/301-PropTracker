import { describe, it, expect } from 'vitest'
import { contractYearIndex } from './finance'
import { defaultIncrementPct, effectiveIncrementPct } from './finance'
import { rentForContractYear } from './finance'
import { incrementSummary, contractDurationYears, contractDurationMonths } from './finance'
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
    expect(rows[0].months[0].yearIndex).toBeNull()
    expect(rows[0].months[6].rent).toBe(1000) // July
    expect(rows[0].months[6].yearIndex).toBe(1) // July 2020 — contract-year 1
    // 2021: Jan-Jun tail of year 1, Jul-Dec start of year 2
    expect(rows[1].yearIndex).toBe(2)
    expect(rows[1].months[0].rent).toBe(1000) // January — still contract-year 1
    expect(rows[1].months[0].yearIndex).toBe(1) // January 2021 — still contract-year 1
    expect(rows[1].months[6].rent).toBe(1000) // July — contract-year 2 (0% increment, same value)
    expect(rows[1].months[6].yearIndex).toBe(2) // July 2021 — contract-year 2 starts here
    // 2022: only Jan-Jun in range (contract ends June 30), within contract-year 2
    expect(rows[2].yearIndex).toBe(2)
    expect(rows[2].months[0].rent).toBe(1000)
    expect(rows[2].months[6].rent).toBeNull() // July, after endDate
    expect(rows[2].months[6].yearIndex).toBeNull()
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

describe('incrementSummary', () => {
  it('formats fixed', () => {
    expect(incrementSummary(makeContract({ increment: 'fixed', fixedPct: 5 }))).toBe('Fixed 5%')
  })

  it('formats ipc', () => {
    expect(incrementSummary(makeContract({ increment: 'ipc', cpiEstimatePct: 5 }))).toBe('IPC 5%')
  })

  it('formats ipc+', () => {
    expect(incrementSummary(makeContract({ increment: 'ipc+', cpiEstimatePct: 5, ipcExtra: 1 }))).toBe('IPC 5% + 1%')
  })

  it('formats none', () => {
    expect(incrementSummary(makeContract({ increment: 'none' }))).toBe('None')
  })
})

describe('contractDurationYears / contractDurationMonths', () => {
  it('reports whole years and months for an exact 10-year contract', () => {
    const c = makeContract({ startDate: '2020-07-01', endDate: '2030-06-30' })
    expect(contractDurationYears(c)).toBe(10)
    expect(contractDurationMonths(c)).toBe(120)
  })

  it('reports whole years and months for a 2-year contract', () => {
    const c = makeContract({ startDate: '2020-07-01', endDate: '2022-06-30' })
    expect(contractDurationYears(c)).toBe(2)
    expect(contractDurationMonths(c)).toBe(24)
  })
})

import { sumMaintenanceForMonth } from './finance'
import type { MaintenanceEvent } from './types'

function makeMaintenanceEvent(overrides: Partial<MaintenanceEvent> = {}): MaintenanceEvent {
  return {
    id: 1,
    desc: 'Plumbing repair',
    cat: 'Repair',
    amount: 200,
    date: '2026-03-10',
    ...overrides,
  }
}

describe('sumMaintenanceForMonth', () => {
  it('sums events whose start date falls in the given month and year', () => {
    const p = makeProperty({
      year: 2026,
      maintenanceEvents: [
        makeMaintenanceEvent({ id: 1, amount: 200, date: '2026-03-10' }),
        makeMaintenanceEvent({ id: 2, amount: 50, date: '2026-03-25' }),
        makeMaintenanceEvent({ id: 3, amount: 999, date: '2026-04-01' }), // different month
        makeMaintenanceEvent({ id: 4, amount: 999, date: '2025-03-10' }), // different year
      ],
    })
    expect(sumMaintenanceForMonth(p, 2)).toBe(250) // March = month index 2
  })

  it('returns 0 when there are no maintenance events', () => {
    const p = makeProperty({ year: 2026 })
    expect(sumMaintenanceForMonth(p, 2)).toBe(0)
  })
})

describe('getMonthData includes maintenance events in totalOpex/noi', () => {
  it('reduces NOI by the maintenance amount booked to its start month', () => {
    const c = makeContract({
      monthlyRent: 1000, increment: 'none',
      startDate: '2020-01-01', endDate: '2030-12-31',
    })
    const p = makeProperty({
      year: 2026,
      contracts: [c],
      maintenanceEvents: [makeMaintenanceEvent({ amount: 300, date: '2026-06-15' })],
    })
    const june = getMonthData(p, 5) // June = month index 5
    expect(june.totalOpex).toBe(300)
    expect(june.noi).toBe(1000 - 300)

    const july = getMonthData(p, 6) // no maintenance event this month
    expect(july.totalOpex).toBe(0)
    expect(july.noi).toBe(1000)
  })

  it('combines manual expenses and a maintenance event in the same month', () => {
    const c = makeContract({
      monthlyRent: 1000, increment: 'none',
      startDate: '2020-01-01', endDate: '2030-12-31',
    })
    const p = makeProperty({
      year: 2026,
      contracts: [c],
      months: {
        2026: {
          5: { status: 'rented', incomeOverride: null, expenses: { admin: 100 } },
        },
      },
      maintenanceEvents: [makeMaintenanceEvent({ amount: 300, date: '2026-06-15' })],
    })
    const june = getMonthData(p, 5) // June = month index 5
    expect(june.totalOpex).toBe(400) // 100 manual + 300 maintenance
    expect(june.noi).toBe(1000 - 400)
  })
})

import { calcAnnual, sumMaintenanceAnnual } from './finance'

describe('sumMaintenanceAnnual', () => {
  it('sums maintenance events across all months of prop.year', () => {
    const p = makeProperty({
      year: 2026,
      maintenanceEvents: [
        makeMaintenanceEvent({ id: 1, amount: 200, date: '2026-03-10' }),
        makeMaintenanceEvent({ id: 2, amount: 300, date: '2026-11-02' }),
        makeMaintenanceEvent({ id: 3, amount: 999, date: '2025-03-10' }), // different year
      ],
    })
    expect(sumMaintenanceAnnual(p)).toBe(500)
  })
})

describe('calcAnnual exposes maintenance without double-subtracting it', () => {
  it('includes maintenance in totalOpex/noi exactly once, and reports it on ann.maintenance', () => {
    const c = makeContract({
      monthlyRent: 1000, increment: 'none',
      startDate: '2020-01-01', endDate: '2030-12-31',
    })
    const p = makeProperty({
      year: 2026,
      contracts: [c],
      maintenanceEvents: [makeMaintenanceEvent({ amount: 300, date: '2026-06-15' })],
    })
    const ann = calcAnnual(p)
    expect(ann.maintenance).toBe(300)
    expect(ann.totalOpex).toBe(300)
    expect(ann.noi).toBe(12000 - 300)
    // netCf must NOT subtract maintenance again — it's already inside noi via totalOpex
    expect(ann.netCf).toBe(ann.noi - ann.totalCapex - ann.taxes - ann.serviceOneTime)
  })
})

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
