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
    max = Math.max(max, c.monthlyRent)
  }
  return max
}

/**
 * Monthly “full potential” rent for GPI / vacancy: lease rent when covered; otherwise
 * Fact Sheet potential, else the highest overlapping lease rent in the year (fills gaps between leases).
 */
export function monthlyPotentialRentForGpi(prop: Property, monthIdx: number): number {
  const c = contractForMonth(prop.contracts, prop.year, monthIdx)
  if (c) return c.monthlyRent
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

export function getMonthData(prop: Property, mIdx: number): MonthDataResult {
  const contract = contractForMonth(prop.contracts, prop.year, mIdx)
  const ym = yearMonths(prop)
  const m = ym[mIdx] ?? {
    status: 'rented' as const,
    incomeOverride: null,
    expenses: {},
  }
  const rent = contract ? contract.monthlyRent : 0
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
  const totalOpex = manualSum
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
  const noi = egi - totalOpex
  return {
    gpi,
    vacancy,
    egi,
    totalOpex,
    noi,
    totalCapex,
    taxes,
    netCf: noi - totalCapex - taxes,
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
