/** Multi-currency support — config, FX rates, conversion helpers */

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CHF' | 'COP' | 'PEN'

export interface CurrencyConfig {
  code: CurrencyCode
  symbol: string
  locale: string
  /** 2-letter country code for flag image (ISO 3166-1 alpha-2, lowercase) */
  country: string
  label: string
  decimals: number
}

export const CURRENCY_LIST: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'CHF', 'COP', 'PEN']

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  USD: { code: 'USD', symbol: '$', locale: 'en-US', country: 'us', label: 'US Dollar', decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', locale: 'de-DE', country: 'eu', label: 'Euro', decimals: 2 },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB', country: 'gb', label: 'British Pound', decimals: 2 },
  CHF: { code: 'CHF', symbol: 'Fr.', locale: 'de-CH', country: 'ch', label: 'Swiss Franc', decimals: 2 },
  COP: { code: 'COP', symbol: '$', locale: 'es-CO', country: 'co', label: 'Colombian Peso', decimals: 0 },
  PEN: { code: 'PEN', symbol: 'S/', locale: 'es-PE', country: 'pe', label: 'Peruvian Sol', decimals: 2 },
}

/** Small flag image URL from flagcdn.com */
export function flagUrl(code: CurrencyCode, size: 20 | 40 = 20): string {
  return `https://flagcdn.com/w${size}/${CURRENCIES[code].country}.png`
}

/** FX rates: how many USD per 1 unit of each currency */
export type FxRates = Record<CurrencyCode, number> & { updatedAt: string }

const FX_STORAGE_KEY = 'proptracker-fx-rates'

const DEFAULT_RATES: FxRates = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.26,
  CHF: 1.13,
  COP: 0.000235,
  PEN: 0.267,
  updatedAt: '2026-03-25',
}

export function loadFxRates(): FxRates {
  try {
    const raw = localStorage.getItem(FX_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.USD === 'number') {
        // backfill any new currencies missing from stored rates
        return { ...DEFAULT_RATES, ...parsed }
      }
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_RATES }
}

export function saveFxRates(rates: FxRates): void {
  localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(rates))
}

/** Convert an amount to USD */
export function toUsd(amount: number, from: CurrencyCode, rates: FxRates): number {
  return amount * rates[from]
}

/** Convert an amount from USD to a target currency */
export function fromUsd(amountUsd: number, to: CurrencyCode, rates: FxRates): number {
  if (rates[to] === 0) return 0
  return amountUsd / rates[to]
}

/** Convert between any two currencies */
export function convert(amount: number, from: CurrencyCode, to: CurrencyCode, rates: FxRates): number {
  if (from === to) return amount
  return fromUsd(toUsd(amount, from, rates), to, rates)
}

/**
 * Normalize stored currency (e.g. localStorage) to a known code, or null if invalid.
 */
export function normalizeCurrencyCode(raw: unknown): CurrencyCode | null {
  if (raw == null || typeof raw !== 'string') return null
  const u = raw.trim().toUpperCase()
  if (!u) return null
  const code = u as CurrencyCode
  return CURRENCY_LIST.includes(code) ? code : null
}

/** Country name from Add property (display label) → default functional currency */
const COUNTRY_DEFAULT_CURRENCY: Record<string, CurrencyCode> = {
  Colombia: 'COP',
  Peru: 'PEN',
  'United States': 'USD',
  Switzerland: 'CHF',
  'United Kingdom': 'GBP',
  Germany: 'EUR',
  France: 'EUR',
  Spain: 'EUR',
  Italy: 'EUR',
  Netherlands: 'EUR',
  Belgium: 'EUR',
  Austria: 'EUR',
  Ireland: 'EUR',
  Portugal: 'EUR',
}

export function defaultCurrencyForCountryName(country: string | undefined): CurrencyCode | null {
  if (!country?.trim()) return null
  return COUNTRY_DEFAULT_CURRENCY[country.trim()] ?? null
}

/**
 * Functional (property) currency for forms: valid `currency` from the property, else infer from `country`, else USD.
 */
export function resolveFunctionalCurrency(prop: {
  currency?: string | null
  country?: string
}): CurrencyCode {
  const fromProp = normalizeCurrencyCode(prop.currency)
  if (fromProp) return fromProp
  return defaultCurrencyForCountryName(prop.country) ?? 'USD'
}
