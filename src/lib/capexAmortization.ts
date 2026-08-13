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
