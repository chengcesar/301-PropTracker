/** Read design-token accent colors from computed styles (for canvas/WebGL APIs that cannot use CSS variables). */

export function parseCssColorToRgb(input: string): { r: number; g: number; b: number } | null {
  const s = input.trim()
  if (!s) return null
  if (s.startsWith('#')) {
    let h = s.slice(1)
    if (h.length === 3) {
      h = h
        .split('')
        .map((c) => c + c)
        .join('')
    }
    if (h.length === 6 && /^[0-9a-fA-F]+$/.test(h)) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
      }
    }
    return null
  }
  const m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i)
  if (m) {
    return { r: Math.round(Number(m[1])), g: Math.round(Number(m[2])), b: Math.round(Number(m[3])) }
  }
  return null
}

const FALLBACK_ACCENT = { r: 59, g: 130, b: 246 }
const FALLBACK_HOVER = { r: 37, g: 99, b: 235 }

export function getThemeAccentRgb(): { r: number; g: number; b: number } {
  if (typeof window === 'undefined') return FALLBACK_ACCENT
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--accent-bg').trim()
  return parseCssColorToRgb(raw) ?? FALLBACK_ACCENT
}

export function getThemeAccentHoverRgb(): { r: number; g: number; b: number } {
  if (typeof window === 'undefined') return FALLBACK_HOVER
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--accent-hover').trim()
  return parseCssColorToRgb(raw) ?? FALLBACK_HOVER
}
