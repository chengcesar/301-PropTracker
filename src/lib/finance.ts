import type { Contract, MonthData, Property, ServiceEntry } from './types'
import { type CurrencyCode, type FxRates, convert } from './currency'

export interface AnnualResult {
  gpi: number
  vacancy: number
  egi: number
  totalOpex: number
  noi: number
  totalCapex: number
  taxes: number
  /** Sum of one-time service/utility payments dated in prop.year */
  serviceOneTime: number
  /** Sum of maintenanceEvents dated in prop.year — already included in totalOpex/noi; exposed separately so breakdown views can itemize it. */
  maintenance: number
  netCf: number
}

export interface MonthDataResult {
  income: number
  manExp: Record<string, unknown>
  autoExp: Record<string, number>
  totalOpex: number
  noi: number
  status: 'rented' | 'vacant'
  incomeOverride: number | null | undefined
  contract: Contract | null
}

/* ── Year-scoped helpers ── */

/** Return the month map for the selected year */
export function yearMonths(prop: Property): Record<number, MonthData> {
  return prop.months[prop.year] ?? {}
}

/** Resolve services for a year — own bucket or inherited from nearest year */
export function resolveServices(prop: Property): ServiceEntry[] {
  const all = prop.services ?? {}
  if (all[prop.year]?.length) return all[prop.year]
  const years = Object.keys(all)
    .map(Number)
    .filter((y) => y !== prop.year && (all[y]?.length ?? 0) > 0)
  if (years.length === 0) return []
  years.sort((a, b) => Math.abs(a - prop.year) - Math.abs(b - prop.year))
  return all[years[0]]
}

export interface ExpenseRowDef {
  key: string
  label: string
  type: 'service' | 'custom'
}

/** Build expense-row definitions for a property's selected year */
export function expenseRowsForYear(prop: Property): ExpenseRowDef[] {
  const rows: ExpenseRowDef[] = []
  const hidden = new Set((prop.hiddenExpenseCats ?? {})[prop.year] ?? [])

  // Admin row (always present — filled from Services or manual entry)
  if (!hidden.has('admin')) rows.push({ key: 'admin', label: 'Admin / mgmt', type: 'service' })

  // Service-derived rows (deduplicated by type)
  const services = resolveServices(prop)
  const seen = new Set<string>(['admin'])
  for (const s of services) {
    const key = s.type.toLowerCase()
    if (seen.has(key) || hidden.has(key)) continue
    seen.add(key)
    rows.push({
      key,
      label: s.provider ? `${s.type} · ${s.provider}` : s.type,
      type: 'service',
    })
  }

  // Custom rows for this year
  for (const entry of (prop.customExpenseCats ?? {})[prop.year] ?? []) {
    const sep = entry.indexOf(':')
    const key = entry.slice(0, sep)
    const label = entry.slice(sep + 1)
    if (!hidden.has(key)) rows.push({ key, label, type: 'custom' })
  }

  return rows
}

/* ── Core finance functions ── */

function sumNumericExpenseValues(exp: Record<string, unknown>): number {
  return Object.values(exp).reduce((acc: number, v: unknown) => {
    if (typeof v === 'number') return acc + v
    if (v && typeof v === 'object' && 'amount' in v) {
      return acc + (Number((v as { amount: number }).amount) || 0)
    }
    return acc
  }, 0)
}

export function activeContract(prop: Property): Contract | null {
  return prop.contracts.find((c) => c.status === 'active') ?? null
}

/** Human-readable annual increment, e.g. "Fixed 5%", "IPC 5% + 1%", "None". */
export function incrementSummary(c: { increment: string; fixedPct: number; cpiEstimatePct: number; ipcExtra: number }): string {
  switch (c.increment) {
    case 'fixed':
      return `Fixed ${c.fixedPct}%`
    case 'ipc':
      return `IPC ${c.cpiEstimatePct}%`
    case 'ipc+':
      return `IPC ${c.cpiEstimatePct}% + ${c.ipcExtra}%`
    case 'none':
    default:
      return 'None'
  }
}

/** Contract duration in whole days, from startDate to endDate. */
function contractDurationDays(contract: Contract): number {
  const start = new Date(`${contract.startDate}T12:00:00`)
  const end = new Date(`${contract.endDate}T12:00:00`)
  return (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
}

/** Contract duration rounded to whole years (average 365.25-day year). */
export function contractDurationYears(contract: Contract): number {
  return Math.round(contractDurationDays(contract) / 365.25)
}

/** Contract duration rounded to whole months (average 30.4368-day month). */
export function contractDurationMonths(contract: Contract): number {
  return Math.round(contractDurationDays(contract) / 30.4368)
}

/** Someone living there without an active lease (Overview → occupant). */
export function hasNonLeaseOccupant(prop: Property): boolean {
  return Boolean(prop.occupant?.name?.trim())
}

/**
 * Portfolio Occupancy column: fixed “Leased” when there is an active contract (compact + filterable);
 * otherwise non-lease relation / Vacant. Tenant name stays in tooltip on the row.
 */
export function nonLeaseOccupancyLabel(prop: Property): string {
  if (activeContract(prop)) return 'Leased'
  if (!hasNonLeaseOccupant(prop)) return 'Vacant'
  const r = prop.occupant!.relation
  return r === 'Owner' ? 'Owner' : r
}

/** Vacant | Leased | Occupied — “Occupied” is non-lease only (no active contract). */
export function occupancyFilterBucket(prop: Property): 'Vacant' | 'Leased' | 'Occupied' {
  if (activeContract(prop)) return 'Leased'
  if (hasNonLeaseOccupant(prop)) return 'Occupied'
  return 'Vacant'
}

/** CSV / copy — leased rows export as “Leased”; non-lease still includes name for detail. */
export function nonLeaseOccupancyExportValue(prop: Property): string {
  if (activeContract(prop)) return 'Leased'
  if (!hasNonLeaseOccupant(prop)) return 'Vacant'
  const name = prop.occupant!.name.trim()
  return `${nonLeaseOccupancyLabel(prop)} · ${name}`
}

/** 1-based contract-year containing `date`, anchored to startDate's anniversary (not calendar Jan 1). */
export function contractYearIndex(contract: Contract, date: Date): number {
  const start = new Date(`${contract.startDate}T12:00:00`)
  const probe = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0)
  let years = probe.getFullYear() - start.getFullYear()
  const anniversary = new Date(start.getFullYear() + years, start.getMonth(), start.getDate(), 12, 0, 0, 0)
  if (probe < anniversary) years -= 1
  return years + 1
}

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

/** Rent for contract-year `yearIndex`, compounding the effective increment from year 1's base monthlyRent. */
export function rentForContractYear(contract: Contract, yearIndex: number): number {
  let rent = contract.monthlyRent
  for (let y = 2; y <= yearIndex; y++) {
    rent = rent * (1 + effectiveIncrementPct(contract, y) / 100)
  }
  return rent
}

/** What this contract actually pays on `date` — the new source of truth for real rent, replacing raw monthlyRent reads. */
export function rentOnDate(contract: Contract, date: Date): number {
  return rentForContractYear(contract, contractYearIndex(contract, date))
}

export interface ContractYearMonth {
  /** Rent for this calendar month, or null if it falls outside [startDate, endDate]. */
  rent: number | null
  /** Contract-year this month belongs to, or null if it falls outside [startDate, endDate]. */
  yearIndex: number | null
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
        months.push({ rent: null, yearIndex: null })
      } else {
        const monthYearIndex = contractYearIndex(contract, probe)
        months.push({ rent: rentForContractYear(contract, monthYearIndex), yearIndex: monthYearIndex })
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

export function contractForMonth(
  contracts: Contract[],
  year: number,
  mIdx: number,
): Contract | null {
  const d = new Date(year, mIdx, 15)
  const found = contracts.find((c) => {
    if (c.status === 'draft') return false
    return d >= new Date(c.startDate) && d <= new Date(c.endDate)
  })
  return found ?? null
}

/**
 * The lease that covers `ref`’s calendar day (start ≤ ref ≤ end), non-draft.
 * If several overlap (e.g. old row still spans today after a renewal), prefers
 * `status === 'active'` so the progress / months-left strip matches the real tenancy.
 */
export function contractCoveringDate(contracts: Contract[], ref: Date): Contract | null {
  const probe = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 12, 0, 0, 0)
  const covering: Contract[] = []
  for (const c of contracts) {
    if (c.status === 'draft') continue
    const start = new Date(`${c.startDate}T12:00:00`)
    const end = new Date(`${c.endDate}T12:00:00`)
    if (probe >= start && probe <= end) covering.push(c)
  }
  if (covering.length === 0) return null
  const active = covering.find((c) => c.status === 'active')
  return active ?? covering[0]
}

/**
 * Earliest non-draft lease that starts strictly after `current` ends (renewal signed but
 * still Archived until go-live does not need Reactivate for portfolio UI to see it).
 */
export function negotiatedFollowOnAfterContract(contracts: Contract[], current: Contract): Contract | null {
  const currentEnd = new Date(`${current.endDate}T12:00:00`)
  let best: Contract | null = null
  let bestStart = Infinity
  for (const c of contracts) {
    if (c.status === 'draft') continue
    if (c.id === current.id) continue
    const start = new Date(`${c.startDate}T12:00:00`)
    if (start.getTime() <= currentEnd.getTime()) continue
    if (start.getTime() < bestStart) {
      bestStart = start.getTime()
      best = c
    }
  }
  return best
}

/** Earliest non-draft lease whose start is still after `ref`’s calendar day (gap / pre-move-in). */
export function nextNegotiatedLeaseNotYetStarted(contracts: Contract[], ref: Date): Contract | null {
  const probe = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 12, 0, 0, 0)
  let best: Contract | null = null
  let bestStart = Infinity
  for (const c of contracts) {
    if (c.status === 'draft') continue
    const start = new Date(`${c.startDate}T12:00:00`)
    if (start.getTime() <= probe.getTime()) continue
    if (start.getTime() < bestStart) {
      bestStart = start.getTime()
      best = c
    }
  }
  return best
}

/** Fact Sheet value for GPI gap months; 0 if unset or invalid. */
export function potentialMonthlyRentFromProp(prop: Property): number {
  const r = prop.factSheet?.potentialMonthlyRent
  if (r == null || !Number.isFinite(r) || r < 0) return 0
  return r
}

/** Non-draft lease intersects any day of the calendar year. */
function contractOverlapsCalendarYear(c: Contract, year: number): boolean {
  if (c.status === 'draft') return false
  const start = new Date(c.startDate)
  const end = new Date(c.endDate)
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999)
  return start <= yearEnd && end >= yearStart
}

/**
 * Max monthly rent among non-draft contracts that overlap the year (any month).
 * Used to impute GPI/vacancy for unleased months when Fact Sheet potential is unset.
 */
export function maxMonthlyRentAmongContractsOverlappingYear(
  contracts: Contract[],
  year: number,
): number {
  let max = 0
  for (const c of contracts) {
    if (!contractOverlapsCalendarYear(c, year)) continue
    const start = new Date(`${c.startDate}T12:00:00`)
    const end = new Date(`${c.endDate}T12:00:00`)
    const yearStart = new Date(year, 0, 1, 12, 0, 0, 0)
    const probe = yearStart < start ? start : yearStart > end ? end : yearStart
    max = Math.max(max, rentOnDate(c, probe))
  }
  return max
}

/**
 * Monthly “full potential” rent for GPI / vacancy: lease rent when covered; otherwise
 * Fact Sheet potential, else the highest overlapping lease rent in the year (fills gaps between leases).
 */
export function monthlyPotentialRentForGpi(prop: Property, monthIdx: number): number {
  const c = contractForMonth(prop.contracts, prop.year, monthIdx)
  if (c) return rentOnDate(c, new Date(prop.year, monthIdx, 15))
  const fromSheet = potentialMonthlyRentFromProp(prop)
  if (fromSheet > 0) return fromSheet
  return maxMonthlyRentAmongContractsOverlappingYear(prop.contracts, prop.year)
}

/** Annual GPI if each month uses `monthlyPotentialRentForGpi` (full-year potential). */
export function projectedGpiAnnual(prop: Property): number {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += monthlyPotentialRentForGpi(prop, i)
  return sum
}

/** Sum of projected annual GPI across properties, converted to display currency. */
export function calcPortfolioProjectedGpiIn(
  properties: Property[],
  to: CurrencyCode,
  rates: FxRates,
): number {
  return properties.reduce(
    (acc, p) => acc + convert(projectedGpiAnnual(p), p.currency, to, rates),
    0,
  )
}

/**
 * Sum of `maintenanceEvents` attributed to calendar month `monthIndex` (0–11)
 * when the event's start `date` falls in `prop.year`. Missing `date` contributes 0.
 */
export function sumMaintenanceForMonth(prop: Property, monthIndex: number): number {
  let sum = 0
  for (const item of prop.maintenanceEvents ?? []) {
    if (!item.date?.trim()) continue
    const d = new Date(item.date + 'T12:00')
    if (d.getFullYear() !== prop.year) continue
    if (d.getMonth() !== monthIndex) continue
    sum += item.amount ?? 0
  }
  return sum
}

export function getMonthData(prop: Property, mIdx: number): MonthDataResult {
  const contract = contractForMonth(prop.contracts, prop.year, mIdx)
  const ym = yearMonths(prop)
  const m = ym[mIdx] ?? {
    status: 'rented' as const,
    incomeOverride: null,
    expenses: {},
  }
  const rent = contract ? rentOnDate(contract, new Date(prop.year, mIdx, 15)) : 0
  const income = !contract
    ? 0
    : m.status === 'vacant'
      ? 0
      : m.incomeOverride !== null && m.incomeOverride !== undefined
        ? m.incomeOverride
        : rent
  const autoExp: Record<string, number> = {}
  const manExp = { ...m.expenses }
  const manualSum = sumNumericExpenseValues(manExp as Record<string, unknown>)
  const maintenance = sumMaintenanceForMonth(prop, mIdx)
  const totalOpex = manualSum + maintenance
  return {
    income,
    manExp,
    autoExp,
    totalOpex,
    noi: income - totalOpex,
    status: m.status,
    incomeOverride: m.incomeOverride,
    contract,
  }
}

/**
 * Sum of `serviceOneTimeItems` attributed to calendar month `monthIndex` (0–11)
 * when `paymentDate` falls in `prop.year`. Missing `paymentDate` contributes 0.
 */
export function sumServiceOneTimeForMonth(prop: Property, monthIndex: number): number {
  let sum = 0
  for (const item of prop.serviceOneTimeItems ?? []) {
    if (!item.paymentDate?.trim()) continue
    const d = new Date(item.paymentDate + 'T12:00')
    if (d.getFullYear() !== prop.year) continue
    if (d.getMonth() !== monthIndex) continue
    sum += item.amount ?? 0
  }
  return sum
}

export function sumServiceOneTimeAnnual(prop: Property): number {
  let sum = 0
  for (const item of prop.serviceOneTimeItems ?? []) {
    if (!item.paymentDate?.trim()) continue
    const d = new Date(item.paymentDate + 'T12:00')
    if (d.getFullYear() !== prop.year) continue
    sum += item.amount ?? 0
  }
  return sum
}

export function sumMaintenanceAnnual(prop: Property): number {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += sumMaintenanceForMonth(prop, i)
  return sum
}

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
  const totalCapex = prop.capex.reduce((a, b) => a + b.amount, 0)
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
    taxes,
    serviceOneTime,
    maintenance,
    netCf: noi - totalCapex - taxes - serviceOneTime,
  }
}

/** Months in the selected year where GPI for that month exceeds actual rent collected. */
export function vacancyLossMonthCount(prop: Property): number {
  let n = 0
  for (let i = 0; i < 12; i++) {
    const pot = monthlyPotentialRentForGpi(prop, i)
    if (pot > getMonthData(prop, i).income) n++
  }
  return n
}

export interface PortfolioTotals {
  gpi: number
  egi: number
  opex: number
  noi: number
  capex: number
  taxes: number
  net: number
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
      }
    },
    { gpi: 0, egi: 0, opex: 0, noi: 0, capex: 0, taxes: 0, net: 0 },
  )
}

/** Convert an AnnualResult from one currency to another */
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
    taxes: c(result.taxes),
    serviceOneTime: c(result.serviceOneTime),
    maintenance: c(result.maintenance),
    netCf: c(result.netCf),
  }
}

/** Portfolio totals converted to a common display currency */
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
      }
    },
    { gpi: 0, egi: 0, opex: 0, noi: 0, capex: 0, taxes: 0, net: 0 },
  )
}

/** Same rules as Value & Equity: purchase + appreciation + price history; otherwise manual appraisal. */
export type PropertyValueEstimate = { value: number | null; source: 'model' | 'appraisal' | null }

export function estimatedPropertyValueAtYear(property: Property, year: number): PropertyValueEstimate {
  const fs = property.factSheet
  if (!fs) return { value: null, source: null }

  const purchasePrice = fs.purchasePrice
  const purchaseDate = fs.purchaseDate
  const purchaseYear = purchaseDate ? new Date(purchaseDate).getFullYear() : NaN
  const canModel =
    purchasePrice != null && purchasePrice > 0 && Boolean(purchaseDate) && !Number.isNaN(purchaseYear)

  if (canModel && purchasePrice != null) {
    if (year < purchaseYear) return { value: null, source: 'model' }
    const appreciationRate = fs.appreciationRate ?? 5
    const priceHistory = fs.priceHistory ?? {}
    let prev = purchasePrice
    let value = purchasePrice
    for (let y = purchaseYear + 1; y <= year; y++) {
      if (priceHistory[y] != null) value = priceHistory[y]!
      else value = prev * (1 + appreciationRate / 100)
      prev = value
    }
    return { value, source: 'model' }
  }

  if (fs.currentValue != null) return { value: fs.currentValue, source: 'appraisal' }
  return { value: null, source: null }
}

/**
 * Compute IRR via Newton-Raphson.
 * cashFlows[0] is the initial outflow (negative), subsequent entries are inflows.
 * Returns null if the series has no sign change or doesn't converge.
 */
export function calcIrr(cashFlows: number[]): number | null {
  if (cashFlows.length < 2) return null
  // Need at least one sign change
  const hasNeg = cashFlows.some(cf => cf < 0)
  const hasPos = cashFlows.some(cf => cf > 0)
  if (!hasNeg || !hasPos) return null

  const npv = (r: number) =>
    cashFlows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + r, t), 0)
  const dnpv = (r: number) =>
    cashFlows.reduce((acc, cf, t) => acc - (t * cf) / Math.pow(1 + r, t + 1), 0)

  let rate = 0.1
  for (let i = 0; i < 150; i++) {
    const n = npv(rate)
    const d = dnpv(rate)
    if (Math.abs(d) < 1e-12) break
    const next = rate - n / d
    if (!Number.isFinite(next) || next < -0.9999) break
    if (Math.abs(next - rate) < 1e-9) return next
    rate = next
    if (rate > 10) break
  }
  return null
}

export interface PortfolioAssetKpis {
  totalValue: number
  valuedCount: number
  /** Mean YoY % for properties with a modeled series (excludes appraisal-only). */
  avgYoYpct: number | null
  yoyCount: number
}

export function calcPortfolioAssetKpis(
  properties: Property[],
  year: number,
  to: CurrencyCode,
  rates: FxRates,
): PortfolioAssetKpis {
  let totalValue = 0
  let valuedCount = 0
  const yoyPcts: number[] = []

  for (const p of properties) {
    const now = estimatedPropertyValueAtYear(p, year)
    if (now.value != null && now.value > 0) {
      totalValue += convert(now.value, p.currency, to, rates)
      valuedCount++
    }
    if (now.source === 'model') {
      const prevY = estimatedPropertyValueAtYear(p, year - 1)
      if (prevY.value != null && now.value != null && prevY.value > 0) {
        yoyPcts.push(((now.value - prevY.value) / prevY.value) * 100)
      }
    }
  }

  const avgYoYpct = yoyPcts.length > 0 ? yoyPcts.reduce((a, b) => a + b, 0) / yoyPcts.length : null
  return { totalValue, valuedCount, avgYoYpct, yoyCount: yoyPcts.length }
}
