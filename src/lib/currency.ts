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
const FX_OVERRIDE_KEY = 'proptracker-fx-overrides'
const EXCHANGE_RATE_API_URL = 'https://api.exchangerate-api.com/v4/latest/USD'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

const DEFAULT_RATES: FxRates = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.26,
  CHF: 1.13,
  COP: 0.000235,
  PEN: 0.267,
  updatedAt: '2026-03-25',
}

/** Rate overrides (partial, only overridden currencies) */
export type FxOverrides = Partial<Record<CurrencyCode, number>>

/** Load raw cached live rates from localStorage (no overrides applied) */
function loadCachedLiveRates(): FxRates | null {
  try {
    const raw = localStorage.getItem(FX_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.USD === 'number' && parsed._fetchedAt) {
        const age = Date.now() - parsed._fetchedAt
        if (age < CACHE_TTL_MS) {
          return { ...DEFAULT_RATES, ...parsed }
        }
      }
    }
  } catch { /* ignore */ }
  return null
}

/** Save live rates to localStorage cache (with timestamp) */
function saveLiveRatesToCache(rates: FxRates): void {
  localStorage.setItem(FX_STORAGE_KEY, JSON.stringify({ ...rates, _fetchedAt: Date.now() }))
}

/** Load user overrides from localStorage */
export function getRateOverrides(): FxOverrides {
  try {
    const raw = localStorage.getItem(FX_OVERRIDE_KEY)
    if (raw) {
      return JSON.parse(raw) as FxOverrides
    }
  } catch { /* ignore */ }
  return {}
}

/** Save a single rate override */
export function setRateOverride(code: CurrencyCode, rate: number): void {
  const overrides = getRateOverrides()
  overrides[code] = rate
  localStorage.setItem(FX_OVERRIDE_KEY, JSON.stringify(overrides))
}

/** Clear a single rate override (revert to live rate) */
export function clearRateOverride(code: CurrencyCode): void {
  const overrides = getRateOverrides()
  delete overrides[code]
  if (Object.keys(overrides).length === 0) {
    localStorage.removeItem(FX_OVERRIDE_KEY)
  } else {
    localStorage.setItem(FX_OVERRIDE_KEY, JSON.stringify(overrides))
  }
}

/** Clear all rate overrides */
export function clearAllRateOverrides(): void {
  localStorage.removeItem(FX_OVERRIDE_KEY)
}

/** Check if a currency has an active override */
export function hasRateOverride(code: CurrencyCode): boolean {
  return getRateOverrides()[code] !== undefined
}

/** Get updatedAt timestamp from cached rates */
export function getRatesUpdatedAt(): string {
  const cached = loadCachedLiveRates()
  return cached?.updatedAt ?? DEFAULT_RATES.updatedAt
}

/**
 * Fetch live FX rates from exchangerate-api.com.
 * 
 * API returns: { rates: { COP: 3105.8, EUR: 0.862, ... } }
 *   - These are "units of currency per 1 USD"
 * 
 * PropTracker uses: { COP: 0.000322, EUR: 1.16, ... }
 *   - These are "USD per 1 unit of currency" (for toUsd = amount * rates[from])
 * 
 * Conversion: propTrackerRate = 1 / apiRate
 * 
 * @param force - If true, bypass cache and fetch fresh rates
 * @returns FX rates with overrides merged in
 */
export async function fetchExchangeRates(force = false): Promise<FxRates> {
  if (!force) {
    const cached = loadCachedLiveRates()
    if (cached) {
      return mergeWithOverrides(cached)
    }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(EXCHANGE_RATE_API_URL, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.rates || typeof data.rates !== 'object') {
      throw new Error('Invalid API response: missing rates object')
    }

    const rates: FxRates = {
      USD: 1,
      EUR: DEFAULT_RATES.EUR,
      GBP: DEFAULT_RATES.GBP,
      CHF: DEFAULT_RATES.CHF,
      COP: DEFAULT_RATES.COP,
      PEN: DEFAULT_RATES.PEN,
      updatedAt: data.date || new Date().toISOString().slice(0, 10),
    }

    for (const code of CURRENCY_LIST) {
      const apiRate = data.rates[code]
      if (typeof apiRate === 'number' && apiRate > 0) {
        rates[code] = 1 / apiRate
      }
    }

    saveLiveRatesToCache(rates)
    return mergeWithOverrides(rates)
  } catch (err) {
    console.warn('FX rate fetch failed, using cached/default rates:', err instanceof Error ? err.message : err)
    const cached = loadCachedLiveRates()
    return mergeWithOverrides(cached ?? { ...DEFAULT_RATES })
  }
}

/**
 * Fetch the live rate for a single currency (bypasses overrides).
 * Useful for showing the current market rate in the override UI.
 */
export async function fetchLiveRate(code: CurrencyCode): Promise<number> {
  const rates = await fetchExchangeRates(true)
  const overrides = getRateOverrides()
  return overrides[code] !== undefined
    ? (loadCachedLiveRates()?.[code] ?? DEFAULT_RATES[code])
    : rates[code]
}

/** Merge live/cached rates with user overrides */
function mergeWithOverrides(rates: FxRates): FxRates {
  const overrides = getRateOverrides()
  return { ...rates, ...overrides } as FxRates
}

/**
 * Load effective FX rates (cached live + overrides, or defaults).
 * Synchronous — for initial render before async fetch completes.
 */
export function loadFxRates(): FxRates {
  const cached = loadCachedLiveRates()
  const base = cached ?? { ...DEFAULT_RATES }
  return mergeWithOverrides(base)
}

/**
 * Save FX rates to localStorage.
 * @deprecated - Use setRateOverride for overrides; live rates are auto-cached.
 */
export function saveFxRates(rates: FxRates): void {
  localStorage.setItem(FX_STORAGE_KEY, JSON.stringify({ ...rates, _fetchedAt: Date.now() }))
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
