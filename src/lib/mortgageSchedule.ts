/**
 * Yearly amortization + equity helpers (aligned with Temp/RealEstateWidget logic).
 * Interest rate is treated as effective annual (E.A.) and converted to a monthly rate.
 */

export type AmortYearRow = {
  year: number
  beginBalance: number
  principalPaid: number
  interestPaid: number
  endBalance: number
  totalPaid: number
  propertyValue: number
  equity: number
  cumulativeInterest: number
}

/** Year-by-year property value when owned outright (appreciation + optional yearly overrides). */
export type PriceProjectionRow = {
  year: number
  value: number
  yoyPct: number | null
}

export function buildOutrightProjectionRows(
  purchaseDate: string,
  purchasePrice: number,
  appreciationAnnualPercent: number,
  projectionYears: number,
  priceHistoryOverrides: Record<number, number> | undefined,
): PriceProjectionRow[] {
  const purchaseYear = new Date(purchaseDate).getFullYear()
  if (Number.isNaN(purchaseYear) || purchasePrice <= 0 || projectionYears < 0) return []

  const rows: PriceProjectionRow[] = []
  let prev = purchasePrice
  let value = purchasePrice
  rows.push({ year: purchaseYear, value, yoyPct: null })

  for (let i = 1; i <= projectionYears; i++) {
    const y = purchaseYear + i
    if (priceHistoryOverrides?.[y] != null) value = priceHistoryOverrides[y]!
    else value = prev * (1 + appreciationAnnualPercent / 100)
    const yoyPct = prev > 0 ? ((value - prev) / prev) * 100 : null
    rows.push({ year: y, value, yoyPct })
    prev = value
  }
  return rows
}

/** E.A. % (e.g. 12.5) → equivalent monthly effective rate */
export function effectiveAnnualToMonthly(eaPercent: number): number {
  const i = eaPercent / 100
  if (i <= 0) return 0
  return (1 + i) ** (1 / 12) - 1
}

export function computeMonthlyPayment(principal: number, monthlyRate: number, nMonths: number): number {
  if (nMonths <= 0) return 0
  if (principal <= 0) return 0
  if (monthlyRate === 0) return principal / nMonths
  const factor = (1 + monthlyRate) ** nMonths
  return (principal * monthlyRate * factor) / (factor - 1)
}

export function buildAmortScheduleYearly(
  loanAmount: number,
  interestRateEaPercent: number,
  termMonths: number,
  purchasePrice: number,
  appreciationAnnualPercent: number,
  loanStartYear: number,
  purchaseYear: number,
  priceHistoryOverrides: Record<number, number> | undefined,
): { yearly: AmortYearRow[]; monthlyPayment: number } {
  const monthlyRate = effectiveAnnualToMonthly(interestRateEaPercent)
  const totalMonths = Math.max(0, Math.floor(termMonths))
  const pmt = computeMonthlyPayment(loanAmount, monthlyRate, totalMonths)
  const app = appreciationAnnualPercent / 100

  let balance = loanAmount
  const yearly: AmortYearRow[] = []
  let yearInterest = 0
  let yearPrincipal = 0

  for (let m = 1; m <= totalMonths; m++) {
    const interest = balance * monthlyRate
    const principal = pmt - interest
    balance -= principal
    if (balance < 0) balance = 0
    yearInterest += interest
    yearPrincipal += principal

    if (m % 12 === 0) {
      const yearNum = m / 12
      const year = loanStartYear + yearNum - 1
      const scheduledValue = purchasePrice * (1 + app) ** (year - purchaseYear)
      const propertyValue =
        priceHistoryOverrides?.[year] != null ? priceHistoryOverrides[year]! : scheduledValue
      const endB = Math.max(balance, 0)
      yearly.push({
        year,
        beginBalance: endB + yearPrincipal,
        principalPaid: yearPrincipal,
        interestPaid: yearInterest,
        endBalance: endB,
        totalPaid: yearPrincipal + yearInterest,
        propertyValue,
        equity: propertyValue - endB,
        cumulativeInterest: 0,
      })
      yearInterest = 0
      yearPrincipal = 0
    }
  }

  let cum = 0
  for (const r of yearly) {
    cum += r.interestPaid
    r.cumulativeInterest = cum
  }

  return { yearly, monthlyPayment: pmt }
}
