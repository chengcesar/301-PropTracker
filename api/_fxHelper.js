/**
 * FX Rate Helper for PropTracker Agent API.
 * 
 * Fetches live exchange rates from exchangerate-api.com and converts them
 * to PropTracker's FX rate format (USD per 1 unit of foreign currency).
 * Falls back to DEFAULT_FX_RATES on fetch failure.
 */

import { DEFAULT_FX_RATES, CURRENCY_LIST } from './_finance.js'

const EXCHANGE_RATE_API_URL = 'https://api.exchangerate-api.com/v4/latest/USD'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

let cachedRates = null
let cachedAt = 0

/**
 * Fetch live FX rates and convert to PropTracker format.
 * 
 * exchangerate-api returns: { rates: { COP: 3105.8, EUR: 0.862, ... } }
 *   - These are "units of currency per 1 USD"
 * 
 * PropTracker uses: { COP: 0.000322, EUR: 1.16, ... }
 *   - These are "USD per 1 unit of currency" (for toUsd = amount * rates[from])
 * 
 * Conversion: propTrackerRate = 1 / apiRate
 * 
 * @returns {Promise<{rates: Object, meta: Object}>}
 *   - rates: FX rates in PropTracker format (USD per 1 unit)
 *   - meta: { fxSource, fxRatesUpdatedAt, fxRateCopPerUsd, fxNote }
 */
export async function getFxRates() {
  const now = Date.now()

  // Return cached rates if still valid
  if (cachedRates && (now - cachedAt) < CACHE_TTL_MS) {
    return cachedRates
  }

  try {
    const response = await fetch(EXCHANGE_RATE_API_URL, {
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.rates || typeof data.rates !== 'object') {
      throw new Error('Invalid API response: missing rates object')
    }

    // Convert API rates (units per USD) to PropTracker rates (USD per unit)
    const rates = { updatedAt: data.date || new Date().toISOString().slice(0, 10) }

    for (const code of CURRENCY_LIST) {
      const apiRate = data.rates[code]
      if (typeof apiRate === 'number' && apiRate > 0) {
        rates[code] = 1 / apiRate
      } else if (code === 'USD') {
        rates[code] = 1
      } else {
        // Fall back to default rate if currency missing from API
        rates[code] = DEFAULT_FX_RATES[code] ?? 0
      }
    }

    const result = {
      rates,
      meta: {
        fxSource: 'live',
        fxRatesUpdatedAt: rates.updatedAt,
        fxRateCopPerUsd: data.rates.COP ?? null,
        fxNote: 'Live rates from exchangerate-api.com',
      },
    }

    // Cache the result
    cachedRates = result
    cachedAt = now

    return result
  } catch (err) {
    console.warn('FX rate fetch failed, using fallback rates:', err.message)

    const result = {
      rates: { ...DEFAULT_FX_RATES },
      meta: {
        fxSource: 'fallback',
        fxRatesUpdatedAt: DEFAULT_FX_RATES.updatedAt,
        fxRateCopPerUsd: DEFAULT_FX_RATES.COP > 0 ? Math.round(1 / DEFAULT_FX_RATES.COP) : null,
        fxNote: `Fallback to embedded rates (fetch failed: ${err.message})`,
      },
    }

    // Don't cache failure — allow retry on next request
    return result
  }
}

/**
 * Clear the FX rate cache. Useful for testing.
 */
export function clearFxCache() {
  cachedRates = null
  cachedAt = 0
}
