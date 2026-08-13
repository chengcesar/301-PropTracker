import { describe, it, expect } from 'vitest'
import { buildCapexAmortizationSchedule, capexDepreciationForMonth } from './capexAmortization'
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
