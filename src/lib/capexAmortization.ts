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
