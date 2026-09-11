/**
 * Finance computation helpers for the Agent API.
 * Ported from src/lib/finance.ts and src/lib/currency.ts for serverless usage.
 */

// ── Currency ──

export const CURRENCY_LIST = ['USD', 'EUR', 'GBP', 'CHF', 'COP', 'PEN']

export const CURRENCIES = {
  USD: { code: 'USD', symbol: '$', locale: 'en-US', country: 'us', label: 'US Dollar', decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', locale: 'de-DE', country: 'eu', label: 'Euro', decimals: 2 },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB', country: 'gb', label: 'British Pound', decimals: 2 },
  CHF: { code: 'CHF', symbol: 'Fr.', locale: 'de-CH', country: 'ch', label: 'Swiss Franc', decimals: 2 },
  COP: { code: 'COP', symbol: '$', locale: 'es-CO', country: 'co', label: 'Colombian Peso', decimals: 0 },
  PEN: { code: 'PEN', symbol: 'S/', locale: 'es-PE', country: 'pe', label: 'Peruvian Sol', decimals: 2 },
}

export const DEFAULT_FX_RATES = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.26,
  CHF: 1.13,
  COP: 0.000235,
  PEN: 0.267,
  updatedAt: '2026-03-25',
}

export function toUsd(amount, from, rates) {
  return amount * rates[from]
}

export function fromUsd(amountUsd, to, rates) {
  if (rates[to] === 0) return 0
  return amountUsd / rates[to]
}

export function convert(amount, from, to, rates) {
  if (from === to) return amount
  return fromUsd(toUsd(amount, from, rates), to, rates)
}

export function normalizeCurrencyCode(raw) {
  if (raw == null || typeof raw !== 'string') return null
  const u = raw.trim().toUpperCase()
  if (!u) return null
  return CURRENCY_LIST.includes(u) ? u : null
}

// ── Contract helpers ──

export function contractForMonth(contracts, year, mIdx) {
  const d = new Date(year, mIdx, 15)
  const found = contracts.find((c) => {
    if (c.status === 'draft') return false
    return d >= new Date(c.startDate) && d <= new Date(c.endDate)
  })
  return found ?? null
}

export function activeContract(prop) {
  return prop.contracts.find((c) => c.status === 'active') ?? null
}

function finitePct(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0
}

export function defaultIncrementPct(contract) {
  switch (contract.increment) {
    case 'fixed':
      return finitePct(contract.fixedPct)
    case 'ipc':
      return finitePct(contract.cpiEstimatePct)
    case 'ipc+':
      return finitePct(contract.cpiEstimatePct) + finitePct(contract.ipcExtra)
    case 'none':
    default:
      return 0
  }
}

export function contractYearIndex(contract, date) {
  const start = new Date(`${contract.startDate}T12:00:00`)
  const probe = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0)
  let years = probe.getFullYear() - start.getFullYear()
  const anniversary = new Date(start.getFullYear() + years, start.getMonth(), start.getDate(), 12, 0, 0, 0)
  if (probe < anniversary) years -= 1
  return years + 1
}

export function effectiveIncrementPct(contract, yearIndex) {
  const override = contract.yearOverrides?.[yearIndex]
  return typeof override === 'number' && Number.isFinite(override) ? override : defaultIncrementPct(contract)
}

export function rentForContractYear(contract, yearIndex) {
  let rent = contract.monthlyRent
  for (let y = 2; y <= yearIndex; y++) {
    rent = rent * (1 + effectiveIncrementPct(contract, y) / 100)
  }
  return rent
}

export function rentOnDate(contract, date) {
  return rentForContractYear(contract, contractYearIndex(contract, date))
}

// ── Occupancy helpers ──

export function hasNonLeaseOccupant(prop) {
  return Boolean(prop.occupant?.name?.trim())
}

export function nonLeaseOccupancyLabel(prop) {
  if (activeContract(prop)) return 'Leased'
  if (!hasNonLeaseOccupant(prop)) return 'Vacant'
  const r = prop.occupant?.relation
  return r === 'Owner' ? 'Owner' : r
}

export function occupancyFilterBucket(prop) {
  if (activeContract(prop)) return 'Leased'
  if (hasNonLeaseOccupant(prop)) return 'Occupied'
  return 'Vacant'
}

// ── Year-scoped helpers ──

function yearMonths(prop) {
  return prop.months[prop.year] ?? {}
}

function resolveServices(prop) {
  const all = prop.services ?? {}
  if (all[prop.year]?.length) return all[prop.year]
  const years = Object.keys(all)
    .map(Number)
    .filter((y) => y !== prop.year && (all[y]?.length ?? 0) > 0)
  if (years.length === 0) return []
  years.sort((a, b) => Math.abs(a - prop.year) - Math.abs(b - prop.year))
  return all[years[0]]
}

// ── GPI helpers ──

function potentialMonthlyRentFromProp(prop) {
  const r = prop.factSheet?.potentialMonthlyRent
  if (r == null || !Number.isFinite(r) || r < 0) return 0
  return r
}

function contractOverlapsCalendarYear(c, year) {
  if (c.status === 'draft') return false
  const start = new Date(c.startDate)
  const end = new Date(c.endDate)
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999)
  return start <= yearEnd && end >= yearStart
}

function maxMonthlyRentAmongContractsOverlappingYear(contracts, year) {
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

export function monthlyPotentialRentForGpi(prop, monthIdx) {
  const c = contractForMonth(prop.contracts, prop.year, monthIdx)
  if (c) return rentOnDate(c, new Date(prop.year, monthIdx, 15))
  const fromSheet = potentialMonthlyRentFromProp(prop)
  if (fromSheet > 0) return fromSheet
  return maxMonthlyRentAmongContractsOverlappingYear(prop.contracts, prop.year)
}

export function projectedGpiAnnual(prop) {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += monthlyPotentialRentForGpi(prop, i)
  return sum
}

// ── Expense helpers ──

function sumNumericExpenseValues(exp) {
  return Object.values(exp).reduce((acc, v) => {
    if (typeof v === 'number') return acc + v
    if (v && typeof v === 'object' && 'amount' in v) {
      return acc + (Number(v.amount) || 0)
    }
    return acc
  }, 0)
}

function sumMaintenanceForMonth(prop, monthIndex) {
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

function sumServiceOneTimeAnnual(prop) {
  let sum = 0
  for (const item of prop.serviceOneTimeItems ?? []) {
    if (!item.paymentDate?.trim()) continue
    const d = new Date(item.paymentDate + 'T12:00')
    if (d.getFullYear() !== prop.year) continue
    sum += item.amount ?? 0
  }
  return sum
}

function sumMaintenanceAnnual(prop) {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += sumMaintenanceForMonth(prop, i)
  return sum
}

// ── Capex Amortization ──

function capexDepreciationForMonth(item, contracts, year, monthIdx) {
  if (item.treatment !== 'capitalize') return 0
  const itemDate = new Date(`${item.date}T12:00:00`)
  const probeDate = new Date(year, monthIdx, 15, 12, 0, 0, 0)
  if (probeDate < itemDate) return 0

  let totalMonths = item.amortizeMonths ?? 60
  if (item.amortizeBasis === 'contract' && item.contractId != null) {
    const linkedContract = contracts.find(c => c.id === item.contractId)
    if (linkedContract) {
      const start = new Date(`${linkedContract.startDate}T12:00:00`)
      const end = new Date(`${linkedContract.endDate}T12:00:00`)
      totalMonths = Math.max(1, Math.round((end.getTime() - start.getTime()) / (30.4368 * 24 * 60 * 60 * 1000)))
    }
  }
  if (totalMonths <= 0) totalMonths = 1

  const monthlyDep = item.amount / totalMonths
  const monthsSinceStart = (probeDate.getFullYear() - itemDate.getFullYear()) * 12 + (probeDate.getMonth() - itemDate.getMonth())
  if (monthsSinceStart < 0 || monthsSinceStart >= totalMonths) return 0
  return monthlyDep
}

function totalCapexAmortizedForYear(capex, contracts, year) {
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

// ── Month data ──

function getMonthData(prop, mIdx) {
  const contract = contractForMonth(prop.contracts, prop.year, mIdx)
  const ym = yearMonths(prop)
  const m = ym[mIdx] ?? {
    status: 'rented',
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
  const autoExp = {}
  const manExp = { ...m.expenses }
  const manualSum = sumNumericExpenseValues(manExp)
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

// ── Core finance ──

export function calcAnnual(prop) {
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
  const totalCapex = (prop.capex || [])
    .filter((c) => new Date(`${c.date}T12:00:00`).getFullYear() === prop.year)
    .reduce((a, b) => a + b.amount, 0)
  const totalCapexAmortized = totalCapexAmortizedForYear(prop.capex || [], prop.contracts || [], prop.year)
  const taxes = ((prop.taxes?.items) ?? []).reduce((a, t) => a + (t.amount ?? 0), 0)
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

export function convertAnnual(result, from, to, rates) {
  if (from === to) return result
  const c = (n) => convert(n, from, to, rates)
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

export function calcPortfolioTotals(properties) {
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

export function calcPortfolioTotalsIn(properties, to, rates) {
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

// ── Value estimation ──

export function estimatedPropertyValueAtYear(property, year) {
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
      if (priceHistory[y] != null) value = priceHistory[y]
      else value = prev * (1 + appreciationRate / 100)
      prev = value
    }
    return { value, source: 'model' }
  }

  if (fs.currentValue != null) return { value: fs.currentValue, source: 'appraisal' }
  return { value: null, source: null }
}

// ── Vacancy count ──

export function vacancyLossMonthCount(prop) {
  let n = 0
  for (let i = 0; i < 12; i++) {
    const pot = monthlyPotentialRentForGpi(prop, i)
    if (pot > getMonthData(prop, i).income) n++
  }
  return n
}
