/** COP and display helpers — es-CO locale per PROPFLOW_CONTEXT.md */

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

export function parseNum(s: unknown): number {
  const raw = String(s).replace(/[,.\s]/g, '')
  const a = parseFloat(raw)
  return Number.isFinite(a) ? a : 0
}
