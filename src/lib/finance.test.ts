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
