import { describe, it, expect } from 'vitest'
import { contractYearIndex, contractYearBounds } from './finance'
import { defaultIncrementPct, effectiveIncrementPct } from './finance'
import { rentForContractYear } from './finance'
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

  it('clamps start against contractEnd for an out-of-domain yearIndex past the last real year', () => {
    const c = makeContract({ startDate: '2020-07-01', endDate: '2022-06-30' })
    const b = contractYearBounds(c, 3)
    const contractEnd = new Date('2022-06-30T12:00:00')
    expect(b.start.getTime()).toBe(contractEnd.getTime())
    expect(b.end.getTime()).toBe(contractEnd.getTime())
    expect(b.start.getTime()).toBeLessThanOrEqual(b.end.getTime())
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
