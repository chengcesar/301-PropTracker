/** Display helpers — currency-aware formatting */

import { type CurrencyCode, CURRENCIES } from './currency'

export function fmt(n: number | null | undefined | string): string {
  if (n === null || n === undefined || n === '') return '—'
  const num = typeof n === 'string' ? Number(n) : n
  if (Number.isNaN(num)) return '—'
  return (num < 0 ? '−' : '') + Math.abs(Math.round(num)).toLocaleString('es-CO')
}

export function fmtM(n: number | null | undefined): string {
  if (!n && n !== 0) return '—'
  return `${Math.round((n / 1_000_000) * 10) / 10}M`
}

/** Format a number respecting the currency's locale and decimals */
export function fmtCurrency(n: number | null | undefined, currency: CurrencyCode): string {
  if (n === null || n === undefined) return '—'
  if (Number.isNaN(n)) return '—'
  const cfg = CURRENCIES[currency]
  const abs = Math.abs(n)
  const formatted = cfg.decimals === 0
    ? Math.round(abs).toLocaleString(cfg.locale)
    : abs.toLocaleString(cfg.locale, { minimumFractionDigits: cfg.decimals, maximumFractionDigits: cfg.decimals })
  return (n < 0 ? '−' : '') + cfg.symbol + ' ' + formatted
}

/** Millions/thousands shorthand respecting the currency */
export function fmtCurrencyM(n: number | null | undefined, currency: CurrencyCode): string {
  if (!n && n !== 0) return '—'
  const abs = Math.abs(n)
  const prefix = n < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${prefix}${Math.round((abs / 1_000_000) * 10) / 10}M`
  if (abs >= 1_000) return `${prefix}${Math.round((abs / 1_000) * 10) / 10}K`
  const cfg = CURRENCIES[currency]
  return `${prefix}${abs.toLocaleString(cfg.locale, { maximumFractionDigits: cfg.decimals })}`
}

export function parseNum(s: unknown): number {
  const raw = String(s).replace(/[,.\s]/g, '')
  const a = parseFloat(raw)
  return Number.isFinite(a) ? a : 0
}
